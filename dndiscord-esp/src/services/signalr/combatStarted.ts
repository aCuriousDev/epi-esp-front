/**
 * Pure state transition for the `CombatStarted` SignalR event.
 *
 * Extracted from gameSync so it can be unit-tested without pulling in the
 * SolidJS stores. Returns the new mode/phase pair, or null when the current
 * state means the event should be ignored (already in combat, or mid-turn —
 * this guards against a reconnecting client receiving a stale broadcast).
 */

import { GameMode, GamePhase } from "../../types";

export interface CombatStartedInput {
  mode: GameMode;
  phase: GamePhase;
}

export interface CombatStartedOutput {
  mode: GameMode;
  phase: GamePhase;
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
  };
}
