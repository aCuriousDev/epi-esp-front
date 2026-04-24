import { describe, expect, it, vi } from 'vitest';
import { resolveAllySpawns, LEGACY_FALLBACK_SPAWNS } from '../spawn/ResolveAllySpawns';
import type { Tile } from '../../types';
import { TileType } from '../../types';

function buildTiles(
  width: number,
  height: number,
  overrides: Partial<Record<string, Partial<Tile>>> = {},
): Record<string, Tile> {
  const tiles: Record<string, Tile> = {};
  for (let z = 0; z < height; z++) {
    for (let x = 0; x < width; x++) {
      const key = `${x},${z}`;
      const base: Tile = {
        position: { x, z },
        type: TileType.FLOOR,
        elevation: 0,
        walkable: true,
        movementCost: 1,
        occupiedBy: null,
        effects: [],
      };
      tiles[key] = { ...base, ...overrides[key] } as Tile;
    }
  }
  return tiles;
}

function blockAll(width: number, height: number): Record<string, Tile> {
  const ov: Record<string, Partial<Tile>> = {};
  for (let z = 0; z < height; z++) {
    for (let x = 0; x < width; x++) {
      ov[`${x},${z}`] = { walkable: false, type: TileType.WALL };
    }
  }
  return buildTiles(width, height, ov);
}

const LEGACY: typeof LEGACY_FALLBACK_SPAWNS = [
  { x: 0, z: 0 },
  { x: 1, z: 0 },
  { x: 2, z: 0 },
];

describe('resolveAllySpawns', () => {
  it('returns empty when count <= 0', () => {
    const tiles = buildTiles(10, 10);
    const out = resolveAllySpawns({
      count: 0,
      tiles,
      gridWidth: 10,
      gridHeight: 10,
      spawnPoint: { x: 5, z: 5 },
      seed: 1,
      legacyFallback: LEGACY,
    });
    expect(out).toEqual([]);
  });

  it('stage 1 wins when spawnPoint cluster fully covers count', () => {
    const tiles = buildTiles(10, 10);
    const warn = vi.fn();
    const out = resolveAllySpawns({
      count: 3,
      tiles,
      gridWidth: 10,
      gridHeight: 10,
      spawnPoint: { x: 5, z: 5 },
      seed: 1,
      legacyFallback: LEGACY,
      onDiagnostic: warn,
    });
    expect(out).toHaveLength(3);
    expect(out[0]).toEqual({ x: 5, z: 5 });
    expect(warn).not.toHaveBeenCalled();
  });

  it('stage 1 + stage 2: partial cluster, Placement fills remainder', () => {
    // Block 4 of 6 cluster cells (keep anchor + one neighbour walkable).
    const tiles = buildTiles(10, 10, {
      '6,5': { walkable: false, type: TileType.WALL },
      '5,6': { walkable: false, type: TileType.WALL },
      '6,6': { walkable: false, type: TileType.WALL },
      '4,5': { walkable: false, type: TileType.WALL },
    });
    const warn = vi.fn();
    const out = resolveAllySpawns({
      count: 4,
      tiles,
      gridWidth: 10,
      gridHeight: 10,
      spawnPoint: { x: 5, z: 5 },
      seed: 42,
      legacyFallback: LEGACY,
      onDiagnostic: warn,
    });
    expect(out).toHaveLength(4);
    expect(out.find((p) => p.x === 5 && p.z === 5)).toBeDefined();
    const keys = out.map((p) => `${p.x},${p.z}`);
    expect(new Set(keys).size).toBe(4);
    expect(warn).toHaveBeenCalled();
    const [msg] = warn.mock.calls[0];
    expect(msg).toContain('under-delivered');
  });

  it('stage 2 only when no spawnPoint', () => {
    const tiles = buildTiles(10, 10);
    const out = resolveAllySpawns({
      count: 3,
      tiles,
      gridWidth: 10,
      gridHeight: 10,
      spawnPoint: null,
      seed: 7,
      legacyFallback: LEGACY,
    });
    expect(out).toHaveLength(3);
    const keys = out.map((p) => `${p.x},${p.z}`);
    expect(new Set(keys).size).toBe(3);
    out.forEach((p) => expect(p.z).toBeLessThanOrEqual(2));
  });

  it('stage 3 LEGACY kicks in when spawnPoint + Placement both empty', () => {
    const tiles = blockAll(10, 10);
    const legacyWalkable: Record<string, Partial<Tile>> = {};
    LEGACY.forEach((p) => {
      legacyWalkable[`${p.x},${p.z}`] = { walkable: true };
    });
    const tilesWithLegacy = buildTiles(10, 10, {
      ...Object.fromEntries(
        Object.keys(blockAll(10, 10)).map((k) => [k, { walkable: false, type: TileType.WALL } as Partial<Tile>]),
      ),
      ...legacyWalkable,
    });
    const warn = vi.fn();
    const out = resolveAllySpawns({
      count: 2,
      tiles: tilesWithLegacy,
      gridWidth: 10,
      gridHeight: 10,
      spawnPoint: { x: 5, z: 5 },
      seed: 1,
      legacyFallback: LEGACY,
      onDiagnostic: warn,
    });
    expect(out).toHaveLength(2);
    out.forEach((p) =>
      expect(LEGACY.some((l) => l.x === p.x && l.z === p.z)).toBe(true),
    );
  });

  it('LEGACY fallback filters non-walkable entries (no unit-in-wall)', () => {
    const tiles = blockAll(10, 10);
    const warn = vi.fn();
    const out = resolveAllySpawns({
      count: 3,
      tiles,
      gridWidth: 10,
      gridHeight: 10,
      spawnPoint: null,
      seed: 1,
      legacyFallback: LEGACY,
      onDiagnostic: warn,
    });
    expect(out).toEqual([]);
    expect(warn).toHaveBeenCalled();
    const [msg] = warn.mock.calls[warn.mock.calls.length - 1];
    expect(msg).toContain('all sources exhausted');
  });

  it('dedup prevents same cell appearing twice across stages', () => {
    const tiles = buildTiles(10, 10);
    const spawnPointOnLegacy = { x: LEGACY[0].x, z: LEGACY[0].z };
    const out = resolveAllySpawns({
      count: 6,
      tiles,
      gridWidth: 10,
      gridHeight: 10,
      spawnPoint: spawnPointOnLegacy,
      seed: 1,
      legacyFallback: LEGACY,
    });
    const keys = out.map((p) => `${p.x},${p.z}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('returns short when every source is exhausted without meeting count', () => {
    const tiles = blockAll(10, 10);
    const out = resolveAllySpawns({
      count: 5,
      tiles,
      gridWidth: 10,
      gridHeight: 10,
      spawnPoint: { x: 5, z: 5 },
      seed: 1,
      legacyFallback: [],
    });
    expect(out.length).toBeLessThan(5);
  });
});
