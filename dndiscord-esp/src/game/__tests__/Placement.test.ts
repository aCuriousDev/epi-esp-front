import { describe, expect, it } from 'vitest';
import { getSpawnPositions } from '../spawn/Placement';
import type { Tile, GridPosition } from '../../types';
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

function inBand(pos: GridPosition, zMin: number, zMax: number): boolean {
  return pos.z >= zMin && pos.z <= zMax;
}

describe('getSpawnPositions', () => {
  it('returns distinct walkable positions inside the ally band on a clear grid', () => {
    const tiles = buildTiles(10, 10);
    const positions = getSpawnPositions({
      tiles,
      team: 'ally',
      count: 3,
      gridWidth: 10,
      gridHeight: 10,
      seed: 42,
    });

    expect(positions).toHaveLength(3);
    positions.forEach((p) => expect(inBand(p, 0, 2)).toBe(true));
    const keys = positions.map((p) => `${p.x},${p.z}`);
    expect(new Set(keys).size).toBe(3);
  });

  it('places enemy team in the bottom band', () => {
    const tiles = buildTiles(10, 10);
    const positions = getSpawnPositions({
      tiles,
      team: 'enemy',
      count: 3,
      gridWidth: 10,
      gridHeight: 10,
      seed: 42,
    });

    expect(positions).toHaveLength(3);
    positions.forEach((p) => expect(inBand(p, 7, 9)).toBe(true));
  });

  it('falls back to BFS outside the band when the band cannot fit the roster', () => {
    // Make only 2 cells walkable in the ally band (z=0..2); rest of band blocked.
    const overrides: Record<string, Partial<Tile>> = {};
    for (let z = 0; z <= 2; z++) {
      for (let x = 0; x < 10; x++) {
        overrides[`${x},${z}`] = { walkable: false };
      }
    }
    overrides['0,0'] = { walkable: true };
    overrides['1,0'] = { walkable: true };

    const tiles = buildTiles(10, 10, overrides);
    const positions = getSpawnPositions({
      tiles,
      team: 'ally',
      count: 3,
      gridWidth: 10,
      gridHeight: 10,
      seed: 42,
    });

    expect(positions).toHaveLength(3);
    const outsideBand = positions.filter((p) => p.z > 2);
    expect(outsideBand.length).toBe(1);
    positions.forEach((p) => expect(tiles[`${p.x},${p.z}`].walkable).toBe(true));
  });

  it('skips occupied tiles', () => {
    const overrides: Record<string, Partial<Tile>> = {};
    for (let z = 0; z <= 2; z++) {
      for (let x = 0; x < 10; x++) overrides[`${x},${z}`] = { occupiedBy: 'busy' };
    }
    overrides['4,1'] = { occupiedBy: null };

    const tiles = buildTiles(10, 10, overrides);
    const positions = getSpawnPositions({
      tiles,
      team: 'ally',
      count: 1,
      gridWidth: 10,
      gridHeight: 10,
      seed: 1,
    });

    expect(positions).toEqual([{ x: 4, z: 1 }]);
  });

  it('skips wall tiles', () => {
    const overrides: Record<string, Partial<Tile>> = {};
    for (let z = 0; z <= 2; z++) {
      for (let x = 0; x < 10; x++) overrides[`${x},${z}`] = { walkable: false };
    }
    overrides['7,2'] = { walkable: true };

    const tiles = buildTiles(10, 10, overrides);
    const positions = getSpawnPositions({
      tiles,
      team: 'ally',
      count: 1,
      gridWidth: 10,
      gridHeight: 10,
      seed: 1,
    });

    expect(positions).toEqual([{ x: 7, z: 2 }]);
  });

  it('is deterministic for the same seed', () => {
    const tiles = buildTiles(10, 10);
    const a = getSpawnPositions({
      tiles, team: 'ally', count: 4, gridWidth: 10, gridHeight: 10, seed: 123,
    });
    const b = getSpawnPositions({
      tiles, team: 'ally', count: 4, gridWidth: 10, gridHeight: 10, seed: 123,
    });
    const c = getSpawnPositions({
      tiles, team: 'ally', count: 4, gridWidth: 10, gridHeight: 10, seed: 124,
    });

    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('returns an empty array when given no tiles', () => {
    const positions = getSpawnPositions({
      tiles: {},
      team: 'ally',
      count: 3,
      gridWidth: 10,
      gridHeight: 10,
      seed: 1,
    });

    expect(positions).toEqual([]);
  });
});
