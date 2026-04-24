import { describe, it, expect } from "vitest";
import { mapServerPhase } from "../serverPhase";
import { GamePhase } from "@/types";

describe("mapServerPhase", () => {
  it.each([
    ["FreeRoam", GamePhase.FREE_ROAM],
    ["Preparation", GamePhase.COMBAT_PREPARATION],
    ["PlayerTurn", GamePhase.PLAYER_TURN],
    ["EnemyTurn", GamePhase.ENEMY_TURN],
    ["Resolved", GamePhase.GAME_OVER],
  ] as const)("maps server phase %s → client %s", (input, expected) => {
    expect(mapServerPhase(input)).toBe(expected);
  });

  it("returns null for undefined", () => {
    expect(mapServerPhase(undefined)).toBeNull();
  });

  it("returns null for null", () => {
    expect(mapServerPhase(null)).toBeNull();
  });

  it("returns null for an unknown string", () => {
    // deliberately cast — the type system catches most cases but the hub could
    // still send an unmapped value if the enum grows on the back before the front.
    expect(mapServerPhase("SomethingNew" as any)).toBeNull();
  });
});
