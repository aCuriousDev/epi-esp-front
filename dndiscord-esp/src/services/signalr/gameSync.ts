/**
 * Synchronisation état de jeu avec les événements SignalR.
 * Applique UnitMoved, TurnEnded, FullStateSync aux stores du jeu.
 */

import { signalRService } from "./SignalRService";
import type { GameMessage, MoveResult, TurnEndedPayload, GameStateSnapshotPayload } from "../../types/multiplayer";
import type { GridPosition } from "../../types";
import { setUnits } from "../../game/stores/UnitsStore";
import { setTiles } from "../../game/stores/TilesStore";
import { setGameState } from "../../game/stores/GameStateStore";
import { updatePathfinder } from "../../game/stores/TilesStore";
import { posToKey } from "../../game/utils/GridUtils";
import { produce } from "solid-js/store";

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
    const path = payload.path.map((pos) => toFrontendPos(pos as { x: number; y: number }));
    const dest = path[path.length - 1];
    const start = path[0];
    if (!dest) return;

    if (start && (start.x !== dest.x || start.z !== dest.z)) {
      setTiles(posToKey(start), "occupiedBy", null);
    }
    setTiles(posToKey(dest), "occupiedBy", unitId);

    setUnits(unitId, produce((u) => {
      u.position = dest;
      u.stats.currentActionPoints = Math.max(0, u.stats.currentActionPoints - (payload.apCost ?? 1));
      u.hasMoved = true;
    }));

    setTiles(posToKey(dest), "occupiedBy", unitId);
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
    // Réappliquer les positions et HP des unités depuis le snapshot
    for (const u of payload.units) {
      const pos = toFrontendPos(u.position as { x: number; y: number });
      setUnits(u.unitId, produce((unit) => {
        unit.position = pos;
        unit.stats.currentHealth = u.hp;
        unit.stats.maxHealth = u.maxHp;
      }));
    }
    updatePathfinder();
  });
}
