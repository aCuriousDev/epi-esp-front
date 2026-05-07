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
import { sessionState, setSessionState, isHost, sessionHasDm, setSessionError } from "../../stores/session.store";
import { applyCombatStarted, applyAuthoritativeCombatStarted } from "./combatStarted";
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
import { TileType } from "../../types";
import { isSessionMapActive, requestSessionExit } from "../../stores/session-map.store";

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

/**
 * CONTRACT: `payload.units` must contain **every** occupant of the grid
 * (players, enemies, NPCs). Any unit absent from the payload will have its
 * tile cleared (occupiedBy → null) and become walkable for pathfinding, which
 * silently breaks collision for server-untracked units such as client-side NPCs.
 * If the backend ever omits a unit class, add it to the snapshot or guard here.
 */
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

    // Default to 0, not 1: a DM-driven free-move has apCost:0 and peers must
    // not silently deduct 1 AP, which would desync them from the server state.
    applyUnitMove(unitId, dest.x, dest.z, payload.apCost ?? 0);

    // ── Notification EXIT côté MJ ─────────────────────────────────────────
    // Le client qui contrôle l'unité appelle requestSessionExit localement
    // dans MovementActions. Le MJ reçoit UnitMoved via SignalR et n'exécute
    // pas MovementActions → il ne voit jamais le bandeau de confirmation.
    // On reproduit ici la même détection pour le MJ uniquement.
    if (isHost() && isSessionMapActive()) {
      const destTile = tiles[posToKey(dest)];
      if (destTile?.type === TileType.EXIT && unitData?.team === Team.PLAYER) {
        const portName: string = destTile.exitPortName ?? 'exit-0';
        requestSessionExit({ unitName: unitData.name, portName });
      }
    }

    // Only clear local preview/highlights if this is the unit I have selected.
    // Other clients may have a different unit selected — don't disrupt their UI.
    if (gameState.selectedUnit === unitId) {
      setGameState("pathPreview", []);
      setGameState("highlightedTiles", []);
    }
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

      // Legacy broadcast — server did not include nextUnitId/phase so
      // applyTurnEnded could not determine the new cursor position.
      // Apply the unit roster so AP / cooldowns / hasActed are at least in
      // sync, surface a visible log, then request a full resync from the
      // server so the turn cursor recovers server-authoritatively.
      // (The FullStateSync response is handled by the handler registered
      // below and will reconcile positions/HP without requiring a reload.)
      console.warn("[gameSync] TurnEnded legacy path — server did not emit nextUnitId/phase", payload);
      if (payload.units?.length) {
        applyUnitsSnapshot(payload.units, { decrementCooldowns: false, resetActivityFlags: true });
      }
      addCombatLog("[System] Resynchronizing turn…", "system");
      setGameState("selectedUnit", null);
      setGameState("turnPhase", "SELECT_UNIT" as any);
      // Fire-and-forget: failure is non-fatal — the DM can always force a
      // manual resync. The FullStateSync handler picks up the response.
      signalRService.invoke("RequestFullState").catch((err: unknown) => {
        console.warn("[gameSync] RequestFullState after legacy TurnEnded failed:", err);
      });
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

      if (gameState.selectedUnit === unitId) {
        setGameState("pathPreview", []);
        setGameState("highlightedTiles", []);
      }

      addCombatLog(
        `[DM] ${unitData.name} moved to (${dest.x}, ${dest.z})`,
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
        `[DM] ${unit.name} appears at (${pos.x}, ${pos.z})!`,
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
          "⚔️ Combat started — initiative rolled server-side.",
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
      addCombatLog("[DM] Combat imminent — place your units.", "system");
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
            `${target.name} takes ${effect.value} damage.`,
            "damage",
          );
        }
        if (wasAliveBefore[effect.targetId] && !target.isAlive) {
          addCombatLog(`${target.name} has been defeated!`, "system");
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
          `[DM] ${name} takes ${Math.abs(payload.delta)} damage.`,
          "damage",
        );
      } else if (payload.delta > 0) {
        addCombatLog(`[DM] ${name} healed for ${payload.delta} HP.`, "system");
      }
      if (payload.wasAlive && !payload.isAlive) {
        addCombatLog(`${name} has been defeated!`, "system");
        playDeathEffect(payload.unitId, unit.team as string);
        playDeathSound();
        playCameraShake(0.15, 300);
      } else if (revived) {
        addCombatLog(`[DM] ${name} resurrected.`, "system");
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
      addCombatLog("[DM] Combat ended — returning to exploration.", "system");
    },
  );

  // DM switched the session to a different map. SignalR's `on(...)` registers
  // a synchronous callback — if we made it `async` directly the returned
  // promise would be dropped and any failure in clearEngineState / JSON parse
  // / setGameState would surface as an unhandled rejection. Wrap the async
  // body in a named helper and attach an explicit .catch.
  signalRService.on("MapSwitched", (message: unknown) => {
    void handleMapSwitched(message).catch((err) => {
      console.error("[gameSync] MapSwitched handler threw", err);
      // Players whose map switch failed are left on the old map with no
      // indication — they see the DM succeed while they're stuck. Surface
      // both a combat-log entry (visible in the in-game feed) and a session
      // error toast so the player knows to reload.
      addCombatLog(
        "[DM] Map change failed — returning to previous map.",
        "system",
      );
      setSessionError(
        "Map change failed. If the problem persists, reload the page.",
      );
    });
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

  // Cache the new map so loadMap(parsed.mapId) resolves during re-init.
  // cacheMap with overrideId = parsed.mapId stores the blob under the DB UUID
  // regardless of the id embedded inside the blob — fixes BUG-J (initializeGrid
  // was falling through to the default grid because loadMap(UUID) found nothing).
  const { cacheMap } = await import("../mapRepository");
  cacheMap(parsed.parsedData as any, parsed.mapId);

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

  // Keep session-store mirror in sync so subsequent DmRestartGame calls
  // (post-Victory "Play Again" in GameOverScreen) pass the new UUID instead
  // of the lobby's original localStorage mapId — otherwise the server's
  // session.MapId gets clobbered and F5/rejoin returns the original map.
  if (sessionState.session) {
    setSessionState("session", "mapId", parsed.mapId);
  }

  addCombatLog(`[DM] New map: ${parsed.name}`, "system");
}
