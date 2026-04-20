/**
 * Default-enemy placement for the FREE_ROAM → COMBAT_PREPARATION transition.
 *
 * Kept free of SolidJS store imports so it can be unit-tested directly.
 * The impure wiring (committing to the units/tiles stores + rebroadcasting
 * via dmSpawnUnit) lives in `services/signalr/gameSync.ts`.
 */

import { Team, UnitType, type GridPosition, type Unit, type UnitStats } from "@/types";
import { ENEMY_ABILITIES, cloneAbilities } from "../abilities/AbilityDefinitions";

export interface EnemyTemplate {
  id: string;
  name: string;
  type: UnitType;
  stats: UnitStats;
  /** Used when the map has no (or not enough) enemy spawn zones available. */
  fallback: GridPosition;
}

export const DEFAULT_ENEMY_TEMPLATES: EnemyTemplate[] = [
  {
    id: "enemy_skeleton_1",
    name: "Skeleton Warrior",
    type: UnitType.ENEMY_SKELETON,
    fallback: { x: 8, z: 8 },
    stats: {
      maxHealth: 60,
      currentHealth: 60,
      maxActionPoints: 5,
      currentActionPoints: 5,
      movementRange: 3,
      attackRange: 1,
      attackDamage: 12,
      defense: 5,
      initiative: 10,
    },
  },
  {
    id: "enemy_skeleton_2",
    name: "Skeleton Archer",
    type: UnitType.ENEMY_SKELETON,
    fallback: { x: 9, z: 8 },
    stats: {
      maxHealth: 50,
      currentHealth: 50,
      maxActionPoints: 5,
      currentActionPoints: 5,
      movementRange: 2,
      attackRange: 4,
      attackDamage: 10,
      defense: 3,
      initiative: 14,
    },
  },
  {
    id: "enemy_mage_1",
    name: "Skeleton Mage",
    type: UnitType.ENEMY_MAGE,
    fallback: { x: 8, z: 9 },
    stats: {
      maxHealth: 70,
      currentHealth: 70,
      maxActionPoints: 6,
      currentActionPoints: 6,
      movementRange: 2,
      attackRange: 5,
      attackDamage: 16,
      defense: 5,
      initiative: 12,
    },
  },
];

/**
 * Picks (and removes) one position from `pool` using Math.random. Split out so
 * tests can inject a deterministic picker.
 */
export function pickRandom(pool: GridPosition[]): GridPosition | null {
  if (pool.length === 0) return null;
  const idx = Math.floor(Math.random() * pool.length);
  const [picked] = pool.splice(idx, 1);
  return picked;
}

/**
 * Builds the default enemy roster placed on the map's enemy spawn zones,
 * skipping tiles already listed in `occupiedKeys` (posToKey format `"x,z"`).
 * When the zone pool runs dry every remaining template falls back to its
 * hardcoded coordinates — that path mirrors the single-player defaults so a
 * campaign map with no enemy zones still has something to fight.
 */
export function buildDefaultEnemies(
  enemySpawnZones: GridPosition[],
  occupiedKeys: Set<string>,
  templates: EnemyTemplate[] = DEFAULT_ENEMY_TEMPLATES,
  pick: (pool: GridPosition[]) => GridPosition | null = pickRandom,
): Unit[] {
  const pool = enemySpawnZones.filter((p) => !occupiedKeys.has(`${p.x},${p.z}`));
  return templates.map((template) => {
    const spawn = pick(pool) ?? template.fallback;
    return {
      id: template.id,
      name: template.name,
      type: template.type,
      team: Team.ENEMY,
      position: spawn,
      stats: { ...template.stats },
      abilities: cloneAbilities(ENEMY_ABILITIES),
      statusEffects: [],
      isAlive: true,
      hasActed: false,
      hasMoved: false,
    };
  });
}
