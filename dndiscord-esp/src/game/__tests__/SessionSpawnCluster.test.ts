import { describe, expect, it } from 'vitest';
import { buildSessionCluster } from '../spawn/SessionSpawnCluster';
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

describe('buildSessionCluster', () => {
  it('returns anchor-first 6-cell cluster around an interior spawnPoint', () => {
    const tiles = buildTiles(10, 10);
    const picked = buildSessionCluster({
      point: { x: 5, z: 5 },
      count: 6,
      gridWidth: 10,
      gridHeight: 10,
      tiles,
    });
    expect(picked).toHaveLength(6);
    expect(picked[0]).toEqual({ x: 5, z: 5 });
    const keys = picked.map((p) => `${p.x},${p.z}`);
    expect(new Set(keys).size).toBe(6);
  });

  it('caps at count when count < 6', () => {
    const tiles = buildTiles(10, 10);
    const picked = buildSessionCluster({
      point: { x: 5, z: 5 },
      count: 4,
      gridWidth: 10,
      gridHeight: 10,
      tiles,
    });
    expect(picked).toHaveLength(4);
    expect(picked[0]).toEqual({ x: 5, z: 5 });
  });

  it('returns at most 6 even when caller asks for more (callers must fill remainder elsewhere)', () => {
    const tiles = buildTiles(10, 10);
    const picked = buildSessionCluster({
      point: { x: 5, z: 5 },
      count: 8,
      gridWidth: 10,
      gridHeight: 10,
      tiles,
    });
    expect(picked.length).toBeLessThanOrEqual(6);
    expect(picked.length).toBeGreaterThan(0);
  });

  it('filters out-of-bounds offsets when spawnPoint sits at a corner', () => {
    const tiles = buildTiles(10, 10);
    const picked = buildSessionCluster({
      point: { x: 0, z: 0 },
      count: 6,
      gridWidth: 10,
      gridHeight: 10,
      tiles,
    });
    picked.forEach((p) => {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.z).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThan(10);
      expect(p.z).toBeLessThan(10);
    });
    expect(picked.length).toBeLessThan(6);
  });

  it('drops blocked (wall / non-walkable) cells from the cluster', () => {
    const tiles = buildTiles(10, 10, {
      '6,5': { walkable: false, type: TileType.WALL },
    });
    const picked = buildSessionCluster({
      point: { x: 5, z: 5 },
      count: 6,
      gridWidth: 10,
      gridHeight: 10,
      tiles,
    });
    expect(picked.find((p) => p.x === 6 && p.z === 5)).toBeUndefined();
  });

  it('drops occupied cells from the cluster', () => {
    const tiles = buildTiles(10, 10, {
      '5,6': { occupiedBy: 'some_unit' },
    });
    const picked = buildSessionCluster({
      point: { x: 5, z: 5 },
      count: 6,
      gridWidth: 10,
      gridHeight: 10,
      tiles,
    });
    expect(picked.find((p) => p.x === 5 && p.z === 6)).toBeUndefined();
  });

  it('returns empty when count is zero', () => {
    const tiles = buildTiles(10, 10);
    const picked = buildSessionCluster({
      point: { x: 5, z: 5 },
      count: 0,
      gridWidth: 10,
      gridHeight: 10,
      tiles,
    });
    expect(picked).toEqual([]);
  });

  it('skips walkable filter when tiles is omitted (bounds-only mode)', () => {
    const picked = buildSessionCluster({
      point: { x: 5, z: 5 },
      count: 6,
      gridWidth: 10,
      gridHeight: 10,
    });
    expect(picked).toHaveLength(6);
  });
});
