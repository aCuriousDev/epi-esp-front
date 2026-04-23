/**
 * Rule-based spawn placement. Pure data-in / positions-out helper shared by
 * solo free-roam init and the zone-less fallback paths in multiplayer init.
 *
 * Keeps the map editor's curated `spawnZones` authoritative when present —
 * this only fires when no zones were authored for the current map.
 */

import type { Tile, GridPosition } from '../../types';

export type SpawnTeam = 'ally' | 'enemy';

export interface GetSpawnPositionsInput {
  tiles: Record<string, Tile>;
  team: SpawnTeam;
  count: number;
  gridWidth: number;
  gridHeight: number;
  seed: number;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function posKey(p: GridPosition): string {
  return `${p.x},${p.z}`;
}

function isEligible(tile: Tile | undefined): boolean {
  return tile !== undefined && tile.walkable && !tile.occupiedBy;
}

function bandRange(team: SpawnTeam, gridHeight: number): { zMin: number; zMax: number } {
  const band = Math.max(1, Math.floor(gridHeight * 0.3));
  if (team === 'ally') return { zMin: 0, zMax: band - 1 };
  return { zMin: gridHeight - band, zMax: gridHeight - 1 };
}

export function getSpawnPositions(input: GetSpawnPositionsInput): GridPosition[] {
  const { tiles, team, count, gridWidth, gridHeight, seed } = input;
  if (count <= 0) return [];
  if (gridWidth <= 0 || gridHeight <= 0) return [];
  if (Object.keys(tiles).length === 0) return [];

  const { zMin, zMax } = bandRange(team, gridHeight);

  const candidates: GridPosition[] = [];
  for (let z = zMin; z <= zMax; z++) {
    for (let x = 0; x < gridWidth; x++) {
      if (isEligible(tiles[posKey({ x, z })])) candidates.push({ x, z });
    }
  }

  const rng = mulberry32(seed);
  const picked: GridPosition[] = shuffle(candidates, rng).slice(0, count);
  if (picked.length >= count) return picked;

  const claimed = new Set(picked.map(posKey));
  const centerX = Math.floor(gridWidth / 2);
  const centerZ = Math.floor((zMin + zMax) / 2);
  const visited = new Set<string>();
  const queue: GridPosition[] = [{ x: centerX, z: centerZ }];
  while (queue.length > 0 && picked.length < count) {
    const cur = queue.shift()!;
    const key = posKey(cur);
    if (visited.has(key)) continue;
    visited.add(key);
    if (cur.x < 0 || cur.x >= gridWidth || cur.z < 0 || cur.z >= gridHeight) continue;
    if (isEligible(tiles[key]) && !claimed.has(key)) {
      picked.push(cur);
      claimed.add(key);
    }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const next = { x: cur.x + dx, z: cur.z + dz };
      if (!visited.has(posKey(next))) queue.push(next);
    }
  }

  return picked;
}
