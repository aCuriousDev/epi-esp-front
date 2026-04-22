/**
 * Pure state transition for the `CombatStarted` SignalR event.
 *
 * Extracted from gameSync so it can be unit-tested without pulling in the
 * SolidJS stores. Returns the new mode/phase/highlighted-tiles triple, or null
 * when the current state means the event should be ignored (already in combat,
 * or mid-turn — guards against a reconnecting client receiving a stale broadcast).
 */

import { GameMode, GamePhase } from "../../types";
import type { GridPosition } from "../../types";
import type { CombatStartedPayload } from "../../types/multiplayer";
import { mapServerPhase } from "./serverPhase";

export interface CombatStartedInput {
  mode: GameMode;
  phase: GamePhase;
  allySpawnPositions: GridPosition[];
}

export interface CombatStartedOutput {
  mode: GameMode;
  phase: GamePhase;
  highlightedTiles: GridPosition[];
}

export function applyCombatStarted(
  current: CombatStartedInput,
): CombatStartedOutput | null {
  // Only transition from FREE_ROAM. If we're already in combat preparation or
  // a turn is underway, silently no-op — the broadcast is stale.
  if (current.phase !== GamePhase.FREE_ROAM) return null;
  if (current.mode !== GameMode.FREE_ROAM) return null;

  return {
    mode: GameMode.COMBAT,
    phase: GamePhase.COMBAT_PREPARATION,
    // Surface ally spawn positions so the "Placement" UI has somewhere to
    // highlight — without this the player sees a blank grid and can't pick.
    highlightedTiles: current.allySpawnPositions,
  };
}

export interface AuthoritativeCombatStartedOutput {
  mode: GameMode;
  phase: GamePhase;
  turnOrder: string[];
  currentUnitIndex: number;
  currentTurn: number;
  highlightedTiles: GridPosition[];
}

/**
 * Server-authoritative variant used when the `CombatStarted` payload carries
 * the server-owned combat state (phase, turnOrder, currentUnitId). Bypasses
 * the "only from FREE_ROAM" gate because the server's word is final.
 *
 * Returns null if the payload doesn't carry the new fields — caller should
 * fall back to the legacy {@link applyCombatStarted}.
 */
export function applyAuthoritativeCombatStarted(
  payload: CombatStartedPayload,
  allySpawnPositions: GridPosition[],
): AuthoritativeCombatStartedOutput | null {
  if (!payload.turnOrder || !payload.phase) return null;

  const mappedPhase = mapServerPhase(payload.phase) ?? GamePhase.PLAYER_TURN;
  const currentUnitIndex = payload.currentUnitId
    ? Math.max(0, payload.turnOrder.indexOf(payload.currentUnitId))
    : 0;

  return {
    mode: GameMode.COMBAT,
    phase: mappedPhase,
    turnOrder: payload.turnOrder,
    currentUnitIndex,
    currentTurn: payload.round ?? 1,
    highlightedTiles:
      mappedPhase === GamePhase.COMBAT_PREPARATION ? allySpawnPositions : [],
  };
}
