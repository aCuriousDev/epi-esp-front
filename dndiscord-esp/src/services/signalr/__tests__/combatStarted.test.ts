import { describe, it, expect } from "vitest";
import { applyCombatStarted, applyAuthoritativeCombatStarted } from "../combatStarted";
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

describe("applyAuthoritativeCombatStarted", () => {
  it("returns null when server payload is missing turnOrder (legacy broadcast)", () => {
    const result = applyAuthoritativeCombatStarted({ phase: "PlayerTurn" }, []);
    expect(result).toBeNull();
  });

  it("returns null when phase is missing (payload not from rework back)", () => {
    const result = applyAuthoritativeCombatStarted({ turnOrder: ["a", "b"] }, []);
    expect(result).toBeNull();
  });

  it("maps server PlayerTurn → client PLAYER_TURN and resolves currentUnitIndex", () => {
    const result = applyAuthoritativeCombatStarted(
      {
        phase: "PlayerTurn",
        round: 1,
        currentUnitId: "u2",
        turnOrder: ["u1", "u2", "u3"],
      },
      [{ x: 0, z: 0 }],
    );
    expect(result).toEqual({
      mode: GameMode.COMBAT,
      phase: GamePhase.PLAYER_TURN,
      turnOrder: ["u1", "u2", "u3"],
      currentUnitIndex: 1,
      currentTurn: 1,
      // No prep highlights since we went straight to a turn.
      highlightedTiles: [],
    });
  });

  it("falls back to currentUnitIndex 0 when currentUnitId is absent", () => {
    const result = applyAuthoritativeCombatStarted(
      {
        phase: "PlayerTurn",
        turnOrder: ["a", "b"],
        currentUnitId: null,
      },
      [],
    );
    expect(result?.currentUnitIndex).toBe(0);
  });

  it("surfaces ally spawn positions only when phase maps to preparation", () => {
    const prep = applyAuthoritativeCombatStarted(
      { phase: "Preparation", turnOrder: ["a"] },
      [{ x: 3, z: 4 }],
    );
    expect(prep?.highlightedTiles).toEqual([{ x: 3, z: 4 }]);
  });
});
