/**
 * Synchronisation état de jeu avec les événements SignalR.
 * Applique UnitMoved, TurnEnded, FullStateSync aux stores du jeu.
 */

import { signalRService } from "./SignalRService";
import type { GameMessage, MoveResult, TurnEndedPayload, GameStateSnapshotPayload, DmMoveTokenPayload, DmSpawnUnitPayload, CombatStartedPayload, CombatEndedPayload } from "../../types/multiplayer";
import type { GridPosition, Unit, UnitType } from "../../types";
import { GameMode, GamePhase, Team } from "../../types";
import { mapServerPhase } from "./serverPhase";
import { units, setUnits } from "../../game/stores/UnitsStore";
import { addUnit } from "../../game/stores/UnitsStore";
import { tiles, setTiles } from "../../game/stores/TilesStore";
import { gameState, setGameState } from "../../game/stores/GameStateStore";
import { updatePathfinder } from "../../game/stores/TilesStore";
import { posToKey } from "../../game/utils/GridUtils";
import { produce } from "solid-js/store";
import { sessionState, isHost, sessionHasDm } from "../../stores/session.store";
import { applyCombatStarted, applyAuthoritativeCombatStarted } from "./combatStarted";
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

    // Server-authoritative: the hub's CombatManager has already advanced the
    // cursor and told us who acts next. Apply verbatim. This closes BUG-C
    // (peers never advancing currentUnitIndex locally) and BUG-H (enemy-turn
    // state never reaching the player client).
    if (payload.nextUnitId !== undefined && gameState.turnOrder.length > 0) {
      const nextIdx = gameState.turnOrder.indexOf(payload.nextUnitId ?? "");
      const mapped = mapServerPhase(payload.phase);
      setGameState({
        currentUnitIndex: nextIdx >= 0 ? nextIdx : gameState.currentUnitIndex,
        currentTurn: payload.round ?? gameState.currentTurn,
        phase: mapped ?? gameState.phase,
        selectedUnit: null,
      });
      setGameState("turnPhase", "SELECT_UNIT" as any);

      if (payload.outcome) {
        addCombatLog(
          payload.outcome === "Victory"
            ? "🏆 Victoire !"
            : payload.outcome === "Defeat"
            ? "💀 Défaite…"
            : "🚪 Combat interrompu.",
          "system",
        );
      }
      return;
    }

    // Legacy broadcast (pre-rework server or solo play) — keep the minimal
    // local reset so the UI doesn't get stuck.
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

  // DM started combat. Post-rework the server seeds the combat state, rolls
  // initiative, and broadcasts the full turn order + current unit in the
  // payload — we apply it verbatim (closes BUG-C). Legacy payload (no turnOrder
  // field) falls back to the old free-roam → preparation transition.
  signalRService.on("CombatStarted", (message: GameMessage<CombatStartedPayload> | CombatStartedPayload | unknown) => {
    if (!sessionHasDm()) return;
    const payload = (message && typeof message === "object" && "payload" in (message as any))
      ? (message as GameMessage<CombatStartedPayload>).payload
      : (message as CombatStartedPayload);

    const authoritative = applyAuthoritativeCombatStarted(
      payload ?? {},
      getAllySpawnPositions(gameState.mapId),
    );
    if (authoritative) {
      setGameState({
        mode: authoritative.mode,
        phase: authoritative.phase,
        turnOrder: authoritative.turnOrder,
        currentUnitIndex: authoritative.currentUnitIndex,
        currentTurn: authoritative.currentTurn,
        highlightedTiles: authoritative.highlightedTiles,
      });
      addCombatLog("⚔️ Combat lancé — initiative roulée côté serveur.", "system");
      return;
    }

    // Legacy path
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

  // DM forcibly ended combat — clear the turn state, return to free roam.
  signalRService.on("CombatEnded", (_message: GameMessage<CombatEndedPayload> | CombatEndedPayload | unknown) => {
    if (!sessionHasDm()) return;
    setGameState({
      mode: GameMode.FREE_ROAM,
      phase: GamePhase.FREE_ROAM,
      turnOrder: [],
      currentUnitIndex: 0,
      selectedUnit: null,
      highlightedTiles: [],
    });
    setGameState("turnPhase", "SELECT_UNIT" as any);
    addCombatLog("[MJ] Combat terminé — retour en exploration.", "system");
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

  // Cache the new map locally so mapStorage.loadMap can resolve it by id
  // during the re-init below. The payload's `data.id` is the SavedMapData
  // id the DM generated in the Map Editor; `parsed.mapId` is the backend
  // campaign-map GUID. loadMap later keys off parsed.mapId, so normalise
  // the embedded id to match — otherwise initializeGrid falls through to
  // the default grid and the DM's chosen map never renders (BUG-J).
  try {
    const data = parsed.parsedData as { id?: string } | null;
    if (data && typeof data === "object") {
      data.id = parsed.mapId;
    }
    const { saveMap } = await import("../mapStorage");
    saveMap(data as any);
  } catch (err) {
    console.warn("[gameSync] Failed to cache switched map locally", err);
  }

  const { clearEngineState } = await import("../../components/GameCanvas");
  await clearEngineState();

  // Full re-init through startGame. The previous implementation only set
  // gameState.mapId and relied on the GameCanvas tiles effect to rebuild
  // the grid — but `tiles` and `units` were never cleared, so the effect
  // rebuilt from the old map's tile data and stacked any new units on top
  // of the stale ones (BUG-E: "default map + duplicate tokens"). Routing
  // through startGame reuses clearUnits + clearTiles + initializeGrid +
  // initializeFreeRoam, which repopulates tiles for the new map and
  // respawns players from the persisted GameStarted payload.
  //
  // POC tradeoff: mid-combat map switches always drop back to free roam;
  // the DM re-clicks Démarrer combat to respawn enemies. Preserving turn
  // order across a map switch is tracked in BUG-E's acceptance follow-ups
  // but is deferred — POC scope prefers a simple, correct reset.
  const assignments = sessionState.gameStartedPayload?.unitAssignments;
  const { startGame } = await import("../../game");
  startGame(GameMode.FREE_ROAM, parsed.mapId, null, assignments);

  addCombatLog(`[MJ] Nouvelle carte : ${parsed.name}`, "system");
}
