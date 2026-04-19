/**
 * Synchronisation état de jeu avec les événements SignalR.
 * Applique UnitMoved, TurnEnded, FullStateSync aux stores du jeu.
 */

import { signalRService } from "./SignalRService";
import type { GameMessage, MoveResult, TurnEndedPayload, GameStateSnapshotPayload, DmMoveTokenPayload, DmSpawnUnitPayload } from "../../types/multiplayer";
import type { GridPosition, Unit, UnitType } from "../../types";
import { GameMode, GamePhase, Team } from "../../types";
import { units, setUnits } from "../../game/stores/UnitsStore";
import { addUnit } from "../../game/stores/UnitsStore";
import { tiles, setTiles } from "../../game/stores/TilesStore";
import { gameState, setGameState } from "../../game/stores/GameStateStore";
import { updatePathfinder } from "../../game/stores/TilesStore";
import { posToKey } from "../../game/utils/GridUtils";
import { produce } from "solid-js/store";
import { sessionState, isHost, sessionHasDm } from "../../stores/session.store";
import { applyCombatStarted } from "./combatStarted";
import { applyMapSwitched } from "./mapSwitched";
import { getAllySpawnPositions } from "../../game/initialization/InitUnits";

import { addCombatLog } from "../../game/stores/GameStateStore";
import { addSpawnedEnemy } from "../../stores/dmTools.store";

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

  // DM force-moved a token — apply to all clients except the DM (who already updated optimistically)
  signalRService.on("DmTokenMoved", (message: GameMessage<DmMoveTokenPayload>) => {
    if (isHost()) return; // DM already applied optimistically
    // Defence-in-depth: drop Dm* events when the session has no DM — the server
    // should already block them but we don't want to mutate state on a spoofed event.
    if (!sessionHasDm()) return;

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

  // DM spawned a new enemy unit — materialise it on all clients
  signalRService.on("DmUnitSpawned", (message: GameMessage<DmSpawnUnitPayload>) => {
    if (isHost()) return; // DM already added the unit locally before broadcasting
    if (!sessionHasDm()) return;

    const payload = message?.payload ?? message;
    if (!payload?.unitId || !payload?.target) return;

    // Extra guard: skip if unit already exists
    if (units[payload.unitId]) return;

    const pos = toFrontendPos(payload.target as { x: number; y: number });
    const tileKey = posToKey(pos);
    const tile = tiles[tileKey];
    if (!tile) return;

    let stats;
    try { stats = JSON.parse(payload.statsJson); } catch { return; }

    const unit: Unit = {
      id: payload.unitId,
      name: payload.name,
      type: payload.unitType as UnitType,
      team: Team.ENEMY,
      position: pos,
      stats,
      abilities: [],
      statusEffects: [],
      isAlive: true,
      hasActed: false,
      hasMoved: false,
    };

    addUnit(unit);
    setTiles(tileKey, "occupiedBy", unit.id);
    updatePathfinder();

    addCombatLog(`[MJ] ${unit.name} apparaît en (${pos.x}, ${pos.z}) !`, "system");
    addSpawnedEnemy({ name: unit.name, x: pos.x, z: pos.z });
  });

  // DM flipped the session from free roam into combat preparation.
  signalRService.on("CombatStarted", (_message: unknown) => {
    if (!sessionHasDm()) return;
    const next = applyCombatStarted({
      mode: gameState.mode,
      phase: gameState.phase,
      allySpawnPositions: getAllySpawnPositions(gameState.mapId),
    });
    if (!next) return;
    setGameState({
      mode: next.mode,
      phase: next.phase,
      highlightedTiles: next.highlightedTiles,
    });
    addCombatLog("[MJ] Combat imminent — placez vos unités.", "system");
  });

  // DM switched the session to a different map. SignalR's `on(...)` registers
  // a synchronous callback — if we made it `async` directly the returned
  // promise would be dropped and any failure in clearEngineState / JSON parse
  // / setGameState would surface as an unhandled rejection. Wrap the async
  // body in a named helper and attach an explicit .catch.
  signalRService.on("MapSwitched", (message: unknown) => {
    void handleMapSwitched(message).catch((err) =>
      console.error("[gameSync] MapSwitched handler threw", err),
    );
  });
}

async function handleMapSwitched(message: unknown): Promise<void> {
  if (!sessionHasDm()) return;

  const parsed = applyMapSwitched(message);
  if (!parsed) {
    console.warn("[gameSync] MapSwitched payload rejected by applyMapSwitched");
    return;
  }

  // Cache locally so the map editor / solo flow can pick it up too. Narrow
  // type to SavedMapData via the dynamic import — applyMapSwitched keeps the
  // parsed data as unknown so it can stay engine-free.
  try {
    const { saveMap } = await import("../mapStorage");
    saveMap(parsed.parsedData as any);
  } catch (err) {
    console.warn("[gameSync] Failed to cache switched map locally", err);
  }

  const { clearEngineState } = await import("../../components/GameCanvas");
  await clearEngineState();

  // Force the tiles effect to fire by setting mapId — this is the single
  // entry point the GameCanvas effect listens to. Never call createGrid
  // directly here (CLAUDE.md hard rule).
  setGameState("mapId", parsed.mapId);
  addCombatLog(`[MJ] Nouvelle carte : ${parsed.name}`, "system");
}
