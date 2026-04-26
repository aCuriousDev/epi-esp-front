import type { Tile, GridPosition } from '../../types';
import { buildSessionCluster } from './SessionSpawnCluster';
import { getSpawnPositions } from './Placement';

export const LEGACY_FALLBACK_SPAWNS: GridPosition[] = [
  { x: 1, z: 1 },
  { x: 1, z: 3 },
  { x: 3, z: 1 },
  { x: 3, z: 3 },
  { x: 5, z: 1 },
  { x: 5, z: 3 },
];

export interface ResolveAllySpawnsInput {
  count: number;
  tiles: Record<string, Tile>;
  gridWidth: number;
  gridHeight: number;
  spawnPoint?: { x: number; z: number } | null;
  /** Seed for rule-based Placement shuffle. Caller picks Date.now() or a session seed. */
  seed: number;
  /** Ordered fallback anchors used if spawnPoint + Placement both under-deliver. */
  legacyFallback: GridPosition[];
  /** Optional log hook (dev diagnostic); defaults to console.warn. */
  onDiagnostic?: (msg: string, data?: unknown) => void;
}

function posKey(p: GridPosition): string {
  return `${p.x},${p.z}`;
}

function isWalkableTile(tiles: Record<string, Tile>, p: GridPosition): boolean {
  const t = tiles[posKey(p)];
  return t !== undefined && t.walkable && !t.occupiedBy;
}

/**
 * Resolve ally spawn positions via a three-step priority chain:
 *   1. DM-authored `spawnPoint` → walkable-filtered cluster around the anchor.
 *   2. Rule-based `Placement.getSpawnPositions` (band + seeded shuffle + BFS).
 *   3. `legacyFallback` anchors (walkable-filtered to avoid unit-in-wall).
 *
 * Each step appends to the result until `count` is met or all sources are
 * exhausted; a short return signals the caller that the map is under-sized
 * for the requested roster.
 */
export function resolveAllySpawns(input: ResolveAllySpawnsInput): GridPosition[] {
  const {
    count,
    tiles,
    gridWidth,
    gridHeight,
    spawnPoint,
    seed,
    legacyFallback,
    onDiagnostic,
  } = input;
  const warn = onDiagnostic ?? ((msg: string, data?: unknown) => {
    console.warn(`[resolveAllySpawns] ${msg}`, data);
  });

  if (count <= 0) return [];

  const picked: GridPosition[] = [];
  const claimed = new Set<string>();
  const push = (p: GridPosition) => {
    const k = posKey(p);
    if (claimed.has(k)) return false;
    picked.push(p);
    claimed.add(k);
    return true;
  };

  if (spawnPoint) {
    const cluster = buildSessionCluster({
      point: spawnPoint,
      count,
      gridWidth,
      gridHeight,
      tiles,
    });
    cluster.forEach(push);
    if (cluster.length < count) {
      warn('spawnPoint cluster under-delivered — falling through to rule-based Placement', {
        anchor: spawnPoint,
        got: cluster.length,
        need: count,
      });
    }
  }

  if (picked.length < count) {
    const ruleBased = getSpawnPositions({
      tiles,
      team: 'ally',
      count: count - picked.length,
      gridWidth,
      gridHeight,
      seed,
    });
    ruleBased.forEach(push);
  }

  if (picked.length < count) {
    for (const p of legacyFallback) {
      if (picked.length >= count) break;
      if (!isWalkableTile(tiles, p)) continue;
      push(p);
    }
  }

  if (picked.length < count) {
    warn('all sources exhausted — returning under-count positions', {
      got: picked.length,
      need: count,
    });
  }

  return picked;
}
