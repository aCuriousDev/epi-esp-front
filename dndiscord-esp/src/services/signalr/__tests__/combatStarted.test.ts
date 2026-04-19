import { describe, it, expect } from "vitest";
import { applyCombatStarted } from "../combatStarted";
import { GameMode, GamePhase } from "@/types";

describe("applyCombatStarted", () => {
  const allySpawns = [
    { x: 1, z: 1 },
    { x: 2, z: 1 },
  ];

  it("returns the combat-preparation transition when currently in free roam", () => {
    const result = applyCombatStarted({
      mode: GameMode.FREE_ROAM,
      phase: GamePhase.FREE_ROAM,
      allySpawnPositions: allySpawns,
    });
    expect(result).toEqual({
      mode: GameMode.COMBAT,
      phase: GamePhase.COMBAT_PREPARATION,
      highlightedTiles: allySpawns,
    });
  });

  it("propagates the ally spawn positions into highlightedTiles verbatim", () => {
    const result = applyCombatStarted({
      mode: GameMode.FREE_ROAM,
      phase: GamePhase.FREE_ROAM,
      allySpawnPositions: [{ x: 5, z: 7 }],
    });
    expect(result?.highlightedTiles).toEqual([{ x: 5, z: 7 }]);
  });

  it("no-ops (returns null) when already in combat preparation", () => {
    const result = applyCombatStarted({
      mode: GameMode.COMBAT,
      phase: GamePhase.COMBAT_PREPARATION,
      allySpawnPositions: allySpawns,
    });
    expect(result).toBeNull();
  });

  it("no-ops when a turn is underway (PLAYER_TURN)", () => {
    const result = applyCombatStarted({
      mode: GameMode.COMBAT,
      phase: GamePhase.PLAYER_TURN,
      allySpawnPositions: allySpawns,
    });
    expect(result).toBeNull();
  });

  it("no-ops when mode is not free roam even if phase claims to be", () => {
    // Defensive: paired preconditions catch a store whose mode/phase got out of sync.
    const result = applyCombatStarted({
      mode: GameMode.COMBAT,
      phase: GamePhase.FREE_ROAM,
      allySpawnPositions: allySpawns,
    });
    expect(result).toBeNull();
  });

  it("no-ops during enemy turn", () => {
    const result = applyCombatStarted({
      mode: GameMode.COMBAT,
      phase: GamePhase.ENEMY_TURN,
      allySpawnPositions: allySpawns,
    });
    expect(result).toBeNull();
  });

  it("accepts an empty allySpawnPositions list — caller is responsible for that fallback UX", () => {
    const result = applyCombatStarted({
      mode: GameMode.FREE_ROAM,
      phase: GamePhase.FREE_ROAM,
      allySpawnPositions: [],
    });
    expect(result).not.toBeNull();
    expect(result!.highlightedTiles).toEqual([]);
  });
});
