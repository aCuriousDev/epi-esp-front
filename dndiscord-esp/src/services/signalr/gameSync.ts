/**
 * Synchronisation état de jeu avec les événements SignalR.
 * Applique UnitMoved, TurnEnded, FullStateSync aux stores du jeu.
 */

import { signalRService } from "./SignalRService";
import type { GameMessage, MoveResult, TurnEndedPayload, GameStateSnapshotPayload, DmMoveTokenPayload } from "../../types/multiplayer";
import type { GridPosition } from "../../types";
import { units, setUnits } from "../../game/stores/UnitsStore";
import { tiles, setTiles } from "../../game/stores/TilesStore";
import { setGameState } from "../../game/stores/GameStateStore";
import { updatePathfinder } from "../../game/stores/TilesStore";
import { posToKey } from "../../game/utils/GridUtils";
import { produce } from "solid-js/store";
import { sessionState } from "../../stores/session.store";

import { addCombatLog } from "../../game/stores/GameStateStore";

/** Backend envoie (x, y), le jeu utilise (x, z). */
function toFrontendPos(p: { x: number; y: number }): GridPosition {
  return { x: p.x, z: p.y };
}

/**
 * Enregistre les handlers pour UnitMoved, TurnEnded, FullStateSync.
 * À appeler après connect() quand on est en session et en partie.
 */
export function registerGameSyncHandlers(): void {
  signalRService.on("UnitMoved", (message: GameMessage<MoveResult>) => {
    const payload = message?.payload ?? message;
    if (!payload.unitId || !payload.path?.length) return;
    const unitId = payload.unitId;

    const unitData = units[unitId];
    if (unitData?.ownerUserId && unitData.ownerUserId === sessionState.hubUserId) return;

    const path = payload.path.map((pos) => toFrontendPos(pos as { x: number; y: number }));
    const dest = path[path.length - 1];
    const start = path[0];
    if (!dest) return;

    // Tile grid may not be initialized yet (reconnection before game board mounts).
    // FullStateSync will reconcile once the board is ready.
    const destTile = tiles[posToKey(dest)];
    if (!destTile) return;

    if (start && (start.x !== dest.x || start.z !== dest.z)) {
      const startTile = tiles[posToKey(start)];
      if (startTile) {
        setTiles(posToKey(start), "occupiedBy", null);
      }
    }
    setTiles(posToKey(dest), "occupiedBy", unitId);

    if (!unitData) return;

    setUnits(unitId, produce((u) => {
      u.position = dest;
      u.stats.currentActionPoints = Math.max(0, u.stats.currentActionPoints - (payload.apCost ?? 1));
      u.hasMoved = true;
    }));

    setGameState("pathPreview", []);
    setGameState("highlightedTiles", []);
    updatePathfinder();
  });

  signalRService.on("TurnEnded", (message: GameMessage<TurnEndedPayload> | TurnEndedPayload) => {
    const payload = (message && typeof message === "object" && "payload" in message)
      ? (message as GameMessage<TurnEndedPayload>).payload
      : (message as TurnEndedPayload);
    if (!payload?.unitId) return;
    // Le tour est passé à l'unité suivante côté serveur ; on peut avancer l'index local
    // pour garder l'UI en phase (ou attendre un événement TurnChanged du backend)
    setGameState("selectedUnit", null);
    setGameState("turnPhase", "SELECT_UNIT" as any);
  });

  signalRService.on("FullStateSync", (message: GameMessage<GameStateSnapshotPayload>) => {
    const payload = message?.payload ?? message;
    if (!payload?.units?.length) return;

    for (const u of payload.units) {
      const pos = toFrontendPos(u.position as { x: number; y: number });
      if (!units[u.unitId]) continue;

      setUnits(u.unitId, produce((unit) => {
        unit.position = pos;
        unit.stats.currentHealth = u.hp;
        unit.stats.maxHealth = u.maxHp;
      }));

      const tileKey = posToKey(pos);
      if (tiles[tileKey]) {
        setTiles(tileKey, "occupiedBy", u.unitId);
      }
    }
    updatePathfinder();
  });

  // DM force-moved a token — apply to all clients
  signalRService.on("DmTokenMoved", (message: GameMessage<DmMoveTokenPayload>) => {
    const payload = message?.payload ?? message;
    if (!payload?.unitId || !payload?.target) return;

    const unitId = payload.unitId;
    const dest = toFrontendPos(payload.target as { x: number; y: number });
    const unitData = units[unitId];
    if (!unitData) return;

    const destTile = tiles[posToKey(dest)];
    if (!destTile) return;

    // Clear old tile
    const oldKey = posToKey(unitData.position);
    if (tiles[oldKey]) {
      setTiles(oldKey, "occupiedBy", null);
    }
    // Set new tile
    setTiles(posToKey(dest), "occupiedBy", unitId);

    setUnits(unitId, produce((u) => {
      u.position = dest;
    }));

    setGameState("pathPreview", []);
    setGameState("highlightedTiles", []);
    updatePathfinder();

    addCombatLog(`[MJ] ${unitData.name} déplacé en (${dest.x}, ${dest.z})`, "system");
  });
}
