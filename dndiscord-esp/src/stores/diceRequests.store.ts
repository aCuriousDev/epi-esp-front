/**
 * Store for D20 roll requests — keyed by requestId (Guid string from server).
 * Holds per-request state for DM, players, and spectators.
 */

import { createStore } from "solid-js/store";
import { sessionState } from "./session.store";

export type RollStatus = "pending" | "completed" | "canceled";

export type MyParticipation = "not-target" | "waiting" | "submitted";

export interface DiceRequestResult {
  value: number;
  userName: string;
  rolledAt: number;
}

export interface DiceRequest {
  requestId: string;
  diceType: "d20";
  label: string | null;
  targetUserIds: string[];
  dmUserId: string;
  status: RollStatus;
  expectedCount: number;
  forcedValue: number | null;
  myParticipation: MyParticipation;
  results: Record<string, DiceRequestResult>;
  createdAt: number;
}

const [state, setState] = createStore<Record<string, DiceRequest>>({});

export const diceRequestsState = state;
export const setDiceRequestsState = setState;

/**
 * `setStore({})` on a Record-typed store MERGES, not clears — so every clear
 * path must iterate and delete keys explicitly (project convention).
 */
export function clearDiceRequests(): void {
  for (const k of Object.keys(state)) {
    setState(k, undefined!);
  }
}

export const myPendingRequests = (): DiceRequest[] => {
  const me = sessionState.hubUserId;
  if (!me) return [];
  return Object.values(state).filter(
    (r) =>
      r.status === "pending" &&
      r.myParticipation === "waiting" &&
      r.forcedValue != null &&
      r.targetUserIds.includes(me)
  );
};

export const pendingRequestsForDm = (): DiceRequest[] =>
  Object.values(state).filter((r) => r.status === "pending");

