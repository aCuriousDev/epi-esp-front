/**
 * Synchronisation état de jeu avec les événements SignalR.
 * Applique UnitMoved, TurnEnded, CombatStarted, CombatEnded, AbilityUsed,
 * DmTokenMoved, DmUnitSpawned, MapSwitched aux stores du jeu.
 */

import { signalRService } from "./SignalRService";
import type {
  GameMessage,
  MoveResult,
  TurnEndedPayload,
  DmMoveTokenPayload,
  DmSpawnUnitPayload,
  CombatStartedPayload,
  CombatEndedPayload,
  AbilityUsedPayload,
  UnitHpAdjustedPayload,
} from "../../types/multiplayer";
import type { GridPosition, Unit, UnitType } from "../../types";
import { GameMode, GamePhase, Team } from "../../types";
import { mapServerPhase } from "./serverPhase";
import { units, setUnits, addUnit } from "../../game/stores/UnitsStore";
import { produce } from "solid-js/store";
import {
  tiles,
  setTiles,
  updatePathfinder,
} from "../../game/stores/TilesStore";
import { gameState, setGameState } from "../../game/stores/GameStateStore";
import { posToKey } from "../../game/utils/GridUtils";
import { sessionState, isHost, sessionHasDm } from "../../stores/session.store";
import {
  applyCombatStarted,
  applyAuthoritativeCombatStarted,
} from "./combatStarted";
import { applyMapSwitched } from "./mapSwitched";
import { getAllySpawnPositions } from "../../game/initialization/InitUnits";
import {
  applyUnitsSnapshot,
  applyCombatStateSlice,
  applyUnitMove,
  applyAbilityOutcome,
} from "./applyState";
import { applyTurnEnded } from "./turnEndedLogic";
import {
  playDeathEffect,
  playCameraShake,
  playReviveEffect,
} from "../../game/vfx/VFXIntegration";
import { playDeathSound } from "../../game/audio/SoundIntegration";

import { addCombatLog } from "../../game/stores/GameStateStore";
import { addSpawnedEnemy } from "../../stores/dmTools.store";

/**
 * Payload minimal attendu par l'évènement `FullStateSync`.
 * Le backend envoie une liste d'unités avec position (x,y) + HP.
 */
type GameStateSnapshotPayload = {
  units?: Array<{
    unitId: string;
    position: { x: number; y: number };
    hp: number;
    maxHp: number;
  }>;
};

/** Backend envoie (x, y), le jeu utilise (x, z). */
function toFrontendPos(p: { x: number; y: number }): GridPosition {
  return { x: p.x, z: p.y };
}

function applySnapshot(payload: GameStateSnapshotPayload): void {
  if (!payload?.units?.length) {
    console.warn("[gameSync] FullStateSync received empty units payload", payload);
    return;
  }

  for (const key of Object.keys(tiles)) {
    if (tiles[key]?.occupiedBy != null) {
      setTiles(key, "occupiedBy", null);
    }
  }

  for (const u of payload.units) {
    const pos = toFrontendPos(u.position as { x: number; y: number });
    const tileKey = posToKey(pos);

    // Always re-apply occupancy from server snapshot; if we don't know the unit
    // yet (join/reconnect race), still block pathing/collision on that tile.
    if (tiles[tileKey]) {
      setTiles(tileKey, "occupiedBy", u.unitId);
    }

    if (!units[u.unitId]) {
      console.warn(
        "[gameSync] applySnapshot: unit missing locally; occupancy applied only",
        { unitId: u.unitId, pos },
      );
      continue;
    }

    setUnits(
      u.unitId,
      produce((unit) => {
        unit.position = pos;
        unit.stats.currentHealth = u.hp;
        unit.stats.maxHealth = u.maxHp;
      }),
    );
  }

  updatePathfinder();
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
    if (
      unitData?.ownerUserId &&
      unitData.ownerUserId === sessionState.hubUserId
    )
      return;

    const path = payload.path.map((pos) =>
      toFrontendPos(pos as { x: number; y: number }),
    );
    const dest = path[path.length - 1];
    if (!dest || !unitData) return;

    // Tile grid not yet initialised (reconnection race) — skip; CombatStarted
    // replay on rejoin will reconcile.
    if (!tiles[posToKey(dest)]) return;

    applyUnitMove(unitId, dest.x, dest.z, payload.apCost ?? 1);

    setGameState("pathPreview", []);
    setGameState("highlightedTiles", []);
  });

  signalRService.on(
    "TurnEnded",
    (message: GameMessage<TurnEndedPayload> | TurnEndedPayload) => {
      const payload =
        message && typeof message === "object" && "payload" in message
          ? (message as GameMessage<TurnEndedPayload>).payload
          : (message as TurnEndedPayload);
      if (!payload?.unitId) return;

      // Server-authoritative: the hub's CombatManager has already advanced the
      // cursor. Compute the applied slice via the pure `applyTurnEnded` helper
      // (unit-tested), then route the store writes through `applyState`.
      const decision = applyTurnEnded({
        nextUnitId: payload.nextUnitId,
        phase: payload.phase,
        round: payload.round,
        outcome: payload.outcome,
        turnOrder: gameState.turnOrder,
        currentTurn: gameState.currentTurn,
        currentUnitIndex: gameState.currentUnitIndex,
        currentPhase: gameState.phase,
      });

      if (decision) {
        // On resolved outcome (Victory / Defeat / Fled) the turn is over; clear
        // the turn order + current-unit cursor so the TurnOrderDisplay strip
        // disappears immediately instead of displaying a stale round count +
        // dead-unit skulls after the GameOverScreen closes. mode flips back to
        // FREE_ROAM so DmPanel's Free-Roam-only controls (like Démarrer combat)
        // become available again without waiting for Play Again.
        const resolved = decision.outcomeText !== null;
        applyCombatStateSlice({
          currentUnitIndex: resolved ? 0 : decision.currentUnitIndex,
          currentTurn: decision.currentTurn,
          phase: decision.phase,
          turnOrder: resolved ? [] : undefined,
          mode: resolved ? GameMode.FREE_ROAM : undefined,
          selectedUnit: null,
        });
        setGameState("turnPhase", "SELECT_UNIT" as any);
        applyUnitsSnapshot(payload.units, {
          decrementCooldowns: decision.roundChanged,
          resetActivityFlags: true,
        });
        if (decision.outcomeText) addCombatLog(decision.outcomeText, "system");
        return;
      }

      // Legacy broadcast — minimal UI reset so the client doesn't hang.
      setGameState("selectedUnit", null);
      setGameState("turnPhase", "SELECT_UNIT" as any);
    },
  );

  // DM force-moved a token — apply to all clients except the DM (who already updated optimistically)
  signalRService.on(
    "DmTokenMoved",
    (message: GameMessage<DmMoveTokenPayload>) => {
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

      addCombatLog(
        `[MJ] ${unitData.name} déplacé en (${dest.x}, ${dest.z})`,
        "system",
      );
    },
  );

  // DM spawned a new enemy unit — materialise it on all clients
  signalRService.on(
    "DmUnitSpawned",
    (message: GameMessage<DmSpawnUnitPayload>) => {
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
      try {
        stats = JSON.parse(payload.statsJson);
      } catch (err) {
        console.error("[gameSync] DmUnitSpawned statsJson parse failed", {
          unitId: payload.unitId,
          name: payload.name,
          err,
        });
        return;
      }

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

      addCombatLog(
        `[MJ] ${unit.name} apparaît en (${pos.x}, ${pos.z}) !`,
        "system",
      );
      addSpawnedEnemy({ name: unit.name, x: pos.x, z: pos.z });
    },
  );

  // DM started combat. Post-rework the server seeds the combat state, rolls
  // initiative, and broadcasts the full turn order + current unit in the
  // payload — we apply it verbatim (closes BUG-C). Legacy payload (no turnOrder
  // field) falls back to the old free-roam → preparation transition.
  signalRService.on(
    "CombatStarted",
    (
      message:
        | GameMessage<CombatStartedPayload>
        | CombatStartedPayload
        | unknown,
    ) => {
      if (!sessionHasDm()) return;
      const payload =
        message && typeof message === "object" && "payload" in (message as any)
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
        addCombatLog(
          "⚔️ Combat lancé — initiative roulée côté serveur.",
          "system",
        );
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
    },
  );

  // A unit used an ability (attack or spell). Every client — including the
  // attacker — applies HP / AP / cooldown from this payload. Keeps HP in sync
  // across peers (was the root of the useAbility desync in CombatActions.ts).
  signalRService.on(
    "AbilityUsed",
    (
      message: GameMessage<AbilityUsedPayload> | AbilityUsedPayload | unknown,
    ) => {
      const payload =
        message && typeof message === "object" && "payload" in (message as any)
          ? (message as GameMessage<AbilityUsedPayload>).payload
          : (message as AbilityUsedPayload);
      if (!payload?.unitId || !Array.isArray(payload.effects)) return;

      // Snapshot of each target's "alive before apply" so we can detect the
      // alive→dead transition after applyAbilityOutcome mutates state. Death
      // VFX + sound fire once per actually-killing effect — not on every
      // damage tick, not if the target was already dead.
      const wasAliveBefore: Record<string, boolean> = {};
      for (const effect of payload.effects) {
        const u = units[effect.targetId];
        if (u) wasAliveBefore[effect.targetId] = u.isAlive;
      }

      applyAbilityOutcome(
        payload.unitId,
        payload.abilityId,
        payload.effects,
        payload.apCost,
        payload.cooldown,
      );

      // Combat log + death VFX run on every client so the death animation
      // plays regardless of who owns the target. (Solo path did this inline
      // in useAbility; moved here so the multiplayer path also gets it.)
      for (const effect of payload.effects) {
        const target = units[effect.targetId];
        if (!target) continue;
        if ((effect.type ?? "").toLowerCase() === "damage") {
          addCombatLog(
            `${target.name} subit ${effect.value} dégâts.`,
            "damage",
          );
        }
        if (wasAliveBefore[effect.targetId] && !target.isAlive) {
          addCombatLog(`${target.name} est vaincu·e !`, "system");
          playDeathEffect(effect.targetId, target.team as string);
          playDeathSound();
          playCameraShake(0.2, 400);
        }
      }
    },
  );

  // Silent ack for the server's peer-reconnect notice. No UI yet — suppresses
  // the "No client method with the name 'playerreconnected' found" warning.
  signalRService.on("PlayerReconnected", (_message: unknown) => {
    /* noop */
  });

  // DM used the heal/damage tool on a unit. Server broadcasts the clamped
  // result + isAlive transition; every client applies verbatim, plays death
  // VFX on alive->dead, revive VFX on dead->alive (DM resurrect), logs to
  // combat feed.
  signalRService.on(
    "UnitHpAdjusted",
    (
      message:
        | GameMessage<UnitHpAdjustedPayload>
        | UnitHpAdjustedPayload
        | unknown,
    ) => {
      const payload =
        message && typeof message === "object" && "payload" in (message as any)
          ? (message as GameMessage<UnitHpAdjustedPayload>).payload
          : (message as UnitHpAdjustedPayload);
      if (!payload?.unitId) return;
      const unit = units[payload.unitId];
      if (!unit) return;

      const revived = !payload.wasAlive && payload.isAlive;

      setUnits(
        payload.unitId,
        produce((u) => {
          u.stats.currentHealth = payload.hp;
          u.stats.maxHealth = payload.maxHp;
          u.isAlive = payload.isAlive;
          if (!payload.isAlive) {
            const key = posToKey(u.position);
            if (tiles[key]?.occupiedBy === u.id)
              setTiles(key, "occupiedBy", null);
          } else if (revived) {
            const key = posToKey(u.position);
            if (tiles[key] && !tiles[key]?.occupiedBy)
              setTiles(key, "occupiedBy", u.id);
          }
        }),
      );
      updatePathfinder();

      const name = unit.name;
      if (payload.delta < 0) {
        addCombatLog(
          `[MJ] ${name} subit ${Math.abs(payload.delta)} dégâts.`,
          "damage",
        );
      } else if (payload.delta > 0) {
        addCombatLog(`[MJ] ${name} soigné·e de ${payload.delta} PV.`, "system");
      }
      if (payload.wasAlive && !payload.isAlive) {
        addCombatLog(`${name} est vaincu·e !`, "system");
        playDeathEffect(payload.unitId, unit.team as string);
        playDeathSound();
        playCameraShake(0.15, 300);
      } else if (revived) {
        addCombatLog(`[MJ] ${name} ressuscité·e.`, "system");
        playReviveEffect(payload.unitId);
      }
    },
  );

  // DM forcibly ended combat — clear the turn state, return to free roam.
  signalRService.on(
    "CombatEnded",
    (
      _message: GameMessage<CombatEndedPayload> | CombatEndedPayload | unknown,
    ) => {
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
    },
  );

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

  signalRService.on(
    "FullStateSync",
    (message: GameMessage<GameStateSnapshotPayload>) => {
      const payload = message?.payload ?? message;
      applySnapshot(payload);
    },
  );
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
  const prevMapId = gameState.mapId;
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
  try {
    startGame(GameMode.FREE_ROAM, parsed.mapId, null, assignments);
  } catch (err) {
    console.error("[gameSync] startGame failed after MapSwitched", err);
    if (prevMapId) {
      console.warn("[gameSync] attempting recovery: restart previous map", {
        prevMapId,
      });
      try {
        startGame(GameMode.FREE_ROAM, prevMapId, null, assignments);
      } catch (err2) {
        console.error("[gameSync] recovery startGame failed", err2);
      }
    }
    throw err;
  }

  addCombatLog(`[MJ] Nouvelle carte : ${parsed.name}`, "system");
}
