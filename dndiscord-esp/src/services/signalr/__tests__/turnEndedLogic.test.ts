import { describe, it, expect } from "vitest";
import { applyTurnEnded } from "../turnEndedLogic";
import { GamePhase } from "@/types";

const base = {
  turnOrder: ["a", "b", "c"],
  currentTurn: 1,
  currentUnitIndex: 0,
  currentPhase: GamePhase.PLAYER_TURN,
};

describe("applyTurnEnded", () => {
  it("returns null when payload lacks nextUnitId (legacy broadcast)", () => {
    expect(applyTurnEnded({ ...base, nextUnitId: undefined })).toBeNull();
  });

  it("returns null when turnOrder is empty", () => {
    expect(applyTurnEnded({ ...base, turnOrder: [], nextUnitId: "a" })).toBeNull();
  });

  it("advances currentUnitIndex to the index of nextUnitId", () => {
    const result = applyTurnEnded({ ...base, nextUnitId: "c" });
    expect(result?.currentUnitIndex).toBe(2);
  });

  it("keeps previous currentUnitIndex when nextUnitId isn't in turnOrder", () => {
    const result = applyTurnEnded({ ...base, nextUnitId: "z" });
    expect(result?.currentUnitIndex).toBe(0);
  });

  it("flags roundChanged=true when round advances", () => {
    const result = applyTurnEnded({ ...base, nextUnitId: "a", round: 2 });
    expect(result?.roundChanged).toBe(true);
    expect(result?.currentTurn).toBe(2);
  });

  it("flags roundChanged=false when round is equal", () => {
    const result = applyTurnEnded({ ...base, nextUnitId: "b", round: 1 });
    expect(result?.roundChanged).toBe(false);
    expect(result?.currentTurn).toBe(1);
  });

  it("flags roundChanged=false when round is omitted", () => {
    const result = applyTurnEnded({ ...base, nextUnitId: "b" });
    expect(result?.roundChanged).toBe(false);
    expect(result?.currentTurn).toBe(base.currentTurn);
  });

  it("maps server phase to client phase", () => {
    const result = applyTurnEnded({ ...base, nextUnitId: "b", phase: "EnemyTurn" });
    expect(result?.phase).toBe(GamePhase.ENEMY_TURN);
  });

  it("keeps client phase when server phase can't be mapped", () => {
    const result = applyTurnEnded({ ...base, nextUnitId: "b", phase: undefined });
    expect(result?.phase).toBe(GamePhase.PLAYER_TURN);
  });

  it.each([
    ["Victory", "🏆 Victoire !"],
    ["Defeat", "💀 Défaite…"],
    ["Fled", "🚪 Combat interrompu."],
  ] as const)("surfaces outcome text for %s", (outcome, expected) => {
    const result = applyTurnEnded({ ...base, nextUnitId: "b", outcome });
    expect(result?.outcomeText).toBe(expected);
  });

  it("returns null outcomeText when no outcome", () => {
    const result = applyTurnEnded({ ...base, nextUnitId: "b" });
    expect(result?.outcomeText).toBeNull();
  });

  it("deterministic: same input → same output", () => {
    const input = { ...base, nextUnitId: "c", round: 2, phase: "EnemyTurn" as const };
    expect(applyTurnEnded(input)).toEqual(applyTurnEnded(input));
  });
});
