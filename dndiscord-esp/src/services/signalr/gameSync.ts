/**
 * Synchronisation état de jeu avec les événements SignalR.
 * Applique UnitMoved, TurnEnded, CombatStarted, CombatEnded, AbilityUsed,
 * DmTokenMoved, DmUnitSpawned, MapSwitched aux stores du jeu.
 */

import { signalRService } from "./SignalRService";
import type { GameMessage, MoveResult, TurnEndedPayload, DmMoveTokenPayload, DmSpawnUnitPayload, CombatStartedPayload, CombatEndedPayload, AbilityUsedPayload } from "../../types/multiplayer";
import type { GridPosition, Unit, UnitType } from "../../types";
import { GameMode, GamePhase, Team } from "../../types";
import { mapServerPhase } from "./serverPhase";
import { units, addUnit } from "../../game/stores/UnitsStore";
import { tiles, setTiles, updatePathfinder } from "../../game/stores/TilesStore";
import { gameState, setGameState } from "../../game/stores/GameStateStore";
import { posToKey } from "../../game/utils/GridUtils";
import { sessionState, isHost, sessionHasDm } from "../../stores/session.store";
import { applyCombatStarted, applyAuthoritativeCombatStarted } from "./combatStarted";
import { applyMapSwitched } from "./mapSwitched";
import { getAllySpawnPositions } from "../../game/initialization/InitUnits";
import { applyUnitsSnapshot, applyCombatStateSlice, applyUnitMove, applyAbilityOutcome } from "./applyState";

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

    // Mover's own client applied the move optimistically; skip the echo.
    const unitData = units[unitId];
    if (unitData?.ownerUserId && unitData.ownerUserId === sessionState.hubUserId) return;

    const path = payload.path.map((pos) => toFrontendPos(pos as { x: number; y: number }));
    const dest = path[path.length - 1];
    if (!dest || !unitData) return;

    // Tile grid not yet initialised (reconnection race) — skip; CombatStarted
    // replay on rejoin will reconcile.
    if (!tiles[posToKey(dest)]) return;

    applyUnitMove(unitId, dest.x, dest.z, payload.apCost ?? 1);

    setGameState("pathPreview", []);
    setGameState("highlightedTiles", []);
  });

  signalRService.on("TurnEnded", (message: GameMessage<TurnEndedPayload> | TurnEndedPayload) => {
    const payload = (message && typeof message === "object" && "payload" in message)
      ? (message as GameMessage<TurnEndedPayload>).payload
      : (message as TurnEndedPayload);
    if (!payload?.unitId) return;

    // Server-authoritative: the hub's CombatManager has already advanced the
    // cursor and told us who acts next. Apply verbatim through applyState
    // helpers — single source of truth, deterministic for all clients.
    if (payload.nextUnitId !== undefined && gameState.turnOrder.length > 0) {
      const nextIdx = gameState.turnOrder.indexOf(payload.nextUnitId ?? "");
      const mapped = mapServerPhase(payload.phase);
      const roundChanged = typeof payload.round === "number" && payload.round > gameState.currentTurn;

      applyCombatStateSlice({
        currentUnitIndex: nextIdx >= 0 ? nextIdx : gameState.currentUnitIndex,
        currentTurn: payload.round ?? gameState.currentTurn,
        phase: mapped ?? gameState.phase,
        selectedUnit: null,
      });
      setGameState("turnPhase", "SELECT_UNIT" as any);

      applyUnitsSnapshot(payload.units, {
        decrementCooldowns: roundChanged,
        resetActivityFlags: true,
      });

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

  // DM force-moved a token — apply to all clients except the DM (who already updated optimistically)
  signalRService.on("DmTokenMoved", (message: GameMessage<DmMoveTokenPayload>) => {
    if (isHost()) return;
    if (!sessionHasDm()) return;

    const payload = message?.payload ?? message;
    if (!payload?.unitId || !payload?.target) return;

    const unitId = payload.unitId;
    const dest = toFrontendPos(payload.target as { x: number; y: number });
    const unitData = units[unitId];
    if (!unitData || !tiles[posToKey(dest)]) return;

    applyUnitMove(unitId, dest.x, dest.z); // no AP deduction for DM force-move

    setGameState("pathPreview", []);
    setGameState("highlightedTiles", []);

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

  // A unit used an ability (attack or spell). Every client — including the
  // attacker — applies HP / AP / cooldown from this payload. Keeps HP in sync
  // across peers (was the root of the useAbility desync in CombatActions.ts).
  signalRService.on("AbilityUsed", (message: GameMessage<AbilityUsedPayload> | AbilityUsedPayload | unknown) => {
    const payload = (message && typeof message === "object" && "payload" in (message as any))
      ? (message as GameMessage<AbilityUsedPayload>).payload
      : (message as AbilityUsedPayload);
    if (!payload?.unitId || !Array.isArray(payload.effects)) return;

    applyAbilityOutcome(
      payload.unitId,
      payload.abilityId,
      payload.effects,
      payload.apCost,
      payload.cooldown,
    );

    // Combat-log lines are local presentation — each client logs for itself.
    for (const effect of payload.effects) {
      const target = units[effect.targetId];
      if (!target) continue;
      if ((effect.type ?? "").toLowerCase() === "damage") {
        addCombatLog(`${target.name} subit ${effect.value} dégâts.`, "damage");
      }
    }
  });

  // Silent ack for the server's peer-reconnect notice. No UI yet — suppresses
  // the "No client method with the name 'playerreconnected' found" warning.
  signalRService.on("PlayerReconnected", (_message: unknown) => { /* noop */ });

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
