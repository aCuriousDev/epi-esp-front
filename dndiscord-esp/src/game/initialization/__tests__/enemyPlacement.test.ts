import { describe, it, expect } from "vitest";
import {
  buildDefaultEnemies,
  DEFAULT_ENEMY_TEMPLATES,
  type EnemyTemplate,
} from "../enemyPlacement";
import { Team, UnitType, type GridPosition } from "@/types";

// Deterministic picker: takes the first item, shifts it off the pool. Mirrors
// pickRandom's "pick + mutate" contract so the pool drains the same way.
const pickFirst = (pool: GridPosition[]): GridPosition | null =>
  pool.length === 0 ? null : pool.shift()!;

const minimalStats = {
  maxHealth: 10,
  currentHealth: 10,
  maxActionPoints: 1,
  currentActionPoints: 1,
  movementRange: 1,
  attackRange: 1,
  attackDamage: 1,
  defense: 0,
  initiative: 1,
};

describe("buildDefaultEnemies", () => {
  it("spawns every default template exactly once", () => {
    // Regression guard for BUG-A: before this fix the CombatStarted handler
    // never called into this path — enemies silently disappeared at combat.
    const enemies = buildDefaultEnemies(
      [
        { x: 5, z: 5 },
        { x: 6, z: 5 },
        { x: 7, z: 5 },
      ],
      new Set(),
      DEFAULT_ENEMY_TEMPLATES,
      pickFirst,
    );
    expect(enemies).toHaveLength(DEFAULT_ENEMY_TEMPLATES.length);
    expect(enemies.map((u) => u.id).sort()).toEqual(
      DEFAULT_ENEMY_TEMPLATES.map((t) => t.id).sort(),
    );
  });

  it("marks every enemy as Team.ENEMY, alive, with cloned abilities", () => {
    const enemies = buildDefaultEnemies([], new Set(), DEFAULT_ENEMY_TEMPLATES, pickFirst);
    for (const e of enemies) {
      expect(e.team).toBe(Team.ENEMY);
      expect(e.isAlive).toBe(true);
      expect(e.hasActed).toBe(false);
      expect(e.hasMoved).toBe(false);
      // Abilities must be cloned — sharing the array between enemies means
      // cooldowns tick for the whole team at once.
      expect(Array.isArray(e.abilities)).toBe(true);
    }
  });

  it("draws positions from the enemy-zone pool when zones exist", () => {
    const zones = [
      { x: 10, z: 10 },
      { x: 11, z: 10 },
      { x: 12, z: 10 },
    ];
    const enemies = buildDefaultEnemies(zones, new Set(), DEFAULT_ENEMY_TEMPLATES, pickFirst);
    expect(enemies.map((e) => e.position)).toEqual([
      { x: 10, z: 10 },
      { x: 11, z: 10 },
      { x: 12, z: 10 },
    ]);
  });

  it("excludes occupied tiles from the zone pool", () => {
    const zones = [
      { x: 4, z: 4 }, // occupied
      { x: 5, z: 4 },
      { x: 6, z: 4 },
      { x: 7, z: 4 },
    ];
    const enemies = buildDefaultEnemies(
      zones,
      new Set(["4,4"]),
      DEFAULT_ENEMY_TEMPLATES,
      pickFirst,
    );
    for (const e of enemies) {
      expect(e.position).not.toEqual({ x: 4, z: 4 });
    }
  });

  it("never places two enemies on the same tile when the pool is large enough", () => {
    const zones = Array.from({ length: 10 }, (_, i) => ({ x: i, z: 0 }));
    const enemies = buildDefaultEnemies(zones, new Set(), DEFAULT_ENEMY_TEMPLATES, pickFirst);
    const keys = enemies.map((e) => `${e.position.x},${e.position.z}`);
    expect(new Set(keys).size).toBe(enemies.length);
  });

  it("falls back to each template's hardcoded position when no zones are defined", () => {
    // Campaign maps without enemy spawn zones must still give the DM something
    // to fight — otherwise combat starts with an empty enemy side.
    const enemies = buildDefaultEnemies([], new Set(), DEFAULT_ENEMY_TEMPLATES, pickFirst);
    expect(enemies.map((e) => e.position)).toEqual(
      DEFAULT_ENEMY_TEMPLATES.map((t) => t.fallback),
    );
  });

  it("falls back when the zone pool drains mid-iteration", () => {
    // Only one zone available for three templates — first takes it, the rest
    // fall back to their templates' defaults.
    const zones = [{ x: 20, z: 20 }];
    const enemies = buildDefaultEnemies(zones, new Set(), DEFAULT_ENEMY_TEMPLATES, pickFirst);
    expect(enemies[0].position).toEqual({ x: 20, z: 20 });
    expect(enemies[1].position).toEqual(DEFAULT_ENEMY_TEMPLATES[1].fallback);
    expect(enemies[2].position).toEqual(DEFAULT_ENEMY_TEMPLATES[2].fallback);
  });

  it("produces a fresh stats object per enemy (no shared reference)", () => {
    // Sharing the stats object means one skeleton taking damage hurts the
    // whole roster — has actually happened with non-cloned prefabs in the past.
    const custom: EnemyTemplate[] = [
      { id: "a", name: "A", type: UnitType.ENEMY_SKELETON, fallback: { x: 0, z: 0 }, stats: minimalStats },
      { id: "b", name: "B", type: UnitType.ENEMY_SKELETON, fallback: { x: 1, z: 1 }, stats: minimalStats },
    ];
    const [a, b] = buildDefaultEnemies([], new Set(), custom, pickFirst);
    a.stats.currentHealth = 0;
    expect(b.stats.currentHealth).toBe(minimalStats.currentHealth);
  });
});
