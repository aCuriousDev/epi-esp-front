/**
 * Centralised sync-state apply helpers.
 *
 * These functions are the ONLY path that writes sync-critical store fields
 * (units HP/AP/position/isAlive, gameState phase/turnOrder/currentUnitIndex).
 * Every SignalR broadcast handler in `gameSync.ts` calls into this module
 * instead of doing its own `setUnits` / `setGameState` — keeping the write
 * layer deterministic and single-source-of-truth means that two clients
 * processing the same payload produce identical store state.
 *
 * Local-only UI fields (selectedUnit, highlightedTiles, combatLog, etc.)
 * are intentionally NOT handled here — those are per-client presentation
 * state and may legitimately vary.
 */

import { produce } from "solid-js/store";
import type { GamePhase, GameMode } from "../../types";
import type { ServerUnitRuntimeState } from "../../types/multiplayer";
import { units, setUnits } from "../../game/stores/UnitsStore";
import { tiles, setTiles, updatePathfinder } from "../../game/stores/TilesStore";
import { setGameState } from "../../game/stores/GameStateStore";
import { posToKey } from "../../game/utils/GridUtils";

/**
 * Apply the server's per-unit snapshot to the UnitsStore. Every unit field
 * that the server owns (HP, AP, isAlive, position via the tiles store) is
 * overwritten verbatim. Silently skips units the client doesn't know about —
 * those will be added by a CombatStarted or DmUnitSpawned event.
 *
 * Options:
 * - `decrementCooldowns`: when true (round-wrap), tick every ability's
 *   cooldown down by 1. Matches the solo TurnManager.resetUnitForNewRound.
 * - `resetActivityFlags`: when true, clear hasActed/hasMoved — matches the
 *   round-wrap behaviour of the solo path.
 */
export function applyUnitsSnapshot(
  serverUnits: readonly ServerUnitRuntimeState[] | undefined,
  options: {
    decrementCooldowns?: boolean;
    resetActivityFlags?: boolean;
  } = {},
): void {
  if (!Array.isArray(serverUnits) || serverUnits.length === 0) return;

  const decrementCooldowns = options.decrementCooldowns ?? false;
  const resetActivityFlags = options.resetActivityFlags ?? true;

  for (const su of serverUnits) {
    if (!units[su.unitId]) continue;

    setUnits(
      su.unitId,
      produce((u) => {
        u.stats.currentActionPoints = su.currentAp;
        u.stats.currentHealth = su.currentHp;
        u.stats.maxHealth = su.maxHp;
        u.isAlive = su.isAlive;
        if (resetActivityFlags) {
          u.hasActed = false;
          u.hasMoved = false;
        }
        if (decrementCooldowns) {
          for (const ability of u.abilities) {
            if (ability.currentCooldown > 0) ability.currentCooldown--;
          }
        }
      }),
    );
  }
}

export interface CombatStateSlice {
  mode?: GameMode;
  phase?: GamePhase;
  turnOrder?: string[];
  currentUnitIndex?: number;
  currentTurn?: number;
  selectedUnit?: string | null;
  highlightedTiles?: Array<{ x: number; z: number }>;
}

/**
 * Apply a combat-state slice to the GameStateStore. Omitted fields are not
 * touched — pass only what the server broadcast authoritatively carried.
 */
export function applyCombatStateSlice(slice: CombatStateSlice): void {
  const patch: Record<string, unknown> = {};
  if (slice.mode !== undefined) patch.mode = slice.mode;
  if (slice.phase !== undefined) patch.phase = slice.phase;
  if (slice.turnOrder !== undefined) patch.turnOrder = slice.turnOrder;
  if (slice.currentUnitIndex !== undefined) patch.currentUnitIndex = slice.currentUnitIndex;
  if (slice.currentTurn !== undefined) patch.currentTurn = slice.currentTurn;
  if (slice.selectedUnit !== undefined) patch.selectedUnit = slice.selectedUnit;
  if (slice.highlightedTiles !== undefined) patch.highlightedTiles = slice.highlightedTiles;

  if (Object.keys(patch).length > 0) {
    setGameState(patch);
  }
}

/**
 * Apply a single unit's movement (position + optional AP deduction + tile
 * occupancy). Used by peer UnitMoved / DmTokenMoved handlers.
 */
export function applyUnitMove(
  unitId: string,
  destX: number,
  destZ: number,
  apDelta?: number,
): void {
  const unit = units[unitId];
  if (!unit) return;

  const oldKey = posToKey(unit.position);
  if (tiles[oldKey]?.occupiedBy === unitId) {
    setTiles(oldKey, "occupiedBy", null);
  }

  setUnits(
    unitId,
    produce((u) => {
      u.position = { x: destX, z: destZ };
      if (apDelta !== undefined && apDelta !== 0) {
        u.stats.currentActionPoints = Math.max(0, u.stats.currentActionPoints - apDelta);
      }
      u.hasMoved = true;
    }),
  );

  const newKey = posToKey({ x: destX, z: destZ });
  if (tiles[newKey]) {
    setTiles(newKey, "occupiedBy", unitId);
  }

  updatePathfinder();
}

/**
 * Apply damage/heal effects from an AbilityUsed broadcast. Loops each effect,
 * updates HP, marks dead units, clears tile occupancy on death. Also deducts
 * the attacker's AP + sets the ability cooldown.
 */
export function applyAbilityOutcome(
  attackerId: string,
  abilityId: string,
  effects: readonly { type: string; targetId: string; value: number }[],
  apCost?: number,
  cooldown?: number,
): void {
  // Damage / heal per target
  for (const effect of effects) {
    const target = units[effect.targetId];
    if (!target) continue;
    const kind = (effect.type ?? "").toLowerCase();
    const delta = kind === "heal" ? effect.value : -effect.value;

    setUnits(
      effect.targetId,
      produce((t) => {
        t.stats.currentHealth = Math.max(0, Math.min(t.stats.maxHealth, t.stats.currentHealth + delta));
        if (t.stats.currentHealth <= 0 && t.isAlive) {
          t.isAlive = false;
          const tileKey = posToKey(t.position);
          if (tiles[tileKey]?.occupiedBy === t.id) {
            setTiles(tileKey, "occupiedBy", null);
          }
        }
      }),
    );
  }

  // Attacker AP + cooldown
  if (units[attackerId]) {
    setUnits(
      attackerId,
      produce((u) => {
        if (typeof apCost === "number" && apCost > 0) {
          u.stats.currentActionPoints = Math.max(0, u.stats.currentActionPoints - apCost);
        }
        if (typeof cooldown === "number" && cooldown > 0) {
          const idx = u.abilities.findIndex((a) => a.id === abilityId);
          if (idx >= 0) u.abilities[idx].currentCooldown = cooldown;
        }
        u.hasActed = true;
      }),
    );
  }

  updatePathfinder();
}
