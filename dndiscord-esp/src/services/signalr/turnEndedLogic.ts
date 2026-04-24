/**
 * Pure computation for the TurnEnded handler. Extracted so the logic can
 * be unit-tested without pulling in SolidJS stores.
 *
 * The SignalR handler in gameSync.ts calls this to derive what should be
 * applied, then routes the apply through `applyState.ts` helpers.
 */

import type { ServerCombatPhase, ServerCombatOutcome } from "../../types/multiplayer";
import type { GamePhase } from "../../types";
import { mapServerPhase } from "./serverPhase";

export interface TurnEndedInput {
  nextUnitId?: string | null;
  phase?: ServerCombatPhase;
  round?: number;
  outcome?: ServerCombatOutcome | null;
  turnOrder: string[];
  currentTurn: number;
  currentUnitIndex: number;
  currentPhase: GamePhase;
}

export interface TurnEndedOutput {
  currentUnitIndex: number;
  currentTurn: number;
  phase: GamePhase;
  roundChanged: boolean;
  /** True if the caller should apply the server's unit snapshot. Always true
   * when the payload carries a server-authoritative nextUnitId — the client
   * trusts the server's view verbatim. */
  applySnapshot: boolean;
  outcomeText: string | null;
}

/**
 * Compute the state transition implied by a TurnEnded payload. Returns null
 * when the payload is a legacy broadcast (no `nextUnitId` field, turnOrder
 * empty) — caller falls back to a minimal UI reset in that case.
 */
export function applyTurnEnded(input: TurnEndedInput): TurnEndedOutput | null {
  if (input.nextUnitId === undefined) return null;
  if (input.turnOrder.length === 0) return null;

  const nextIdx = input.turnOrder.indexOf(input.nextUnitId ?? "");
  const mapped = mapServerPhase(input.phase);
  const newRound = input.round ?? input.currentTurn;
  const roundChanged = typeof input.round === "number" && input.round > input.currentTurn;

  let outcomeText: string | null = null;
  if (input.outcome === "Victory") outcomeText = "🏆 Victoire !";
  else if (input.outcome === "Defeat") outcomeText = "💀 Défaite…";
  else if (input.outcome === "Fled") outcomeText = "🚪 Combat interrompu.";

  return {
    currentUnitIndex: nextIdx >= 0 ? nextIdx : input.currentUnitIndex,
    currentTurn: newRound,
    phase: mapped ?? input.currentPhase,
    roundChanged,
    applySnapshot: true,
    outcomeText,
  };
}
