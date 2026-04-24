import { Pathfinder } from '../pathfinding';
import { Tile, TileType, GridPosition } from '../../types';

function createGrid(width: number, height: number, overrides?: Map<string, Partial<Tile>>): Map<string, Tile> {
  const grid = new Map<string, Tile>();
  for (let x = 0; x < width; x++) {
    for (let z = 0; z < height; z++) {
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
      const override = overrides?.get(key);
      grid.set(key, override ? { ...base, ...override } : base);
    }
  }
  return grid;
}

describe('Pathfinder', () => {
  describe('findPath', () => {
    it('finds shortest path on open grid', () => {
      const grid = createGrid(5, 5);
      const pf = new Pathfinder(grid, 5, 5);
      const path = pf.findPath({ x: 0, z: 0 }, { x: 4, z: 0 });
      expect(path).not.toBeNull();
      // Manhattan distance = 4, so path length = 5 (including start)
      expect(path!.length).toBe(5);
      expect(path![0]).toEqual({ x: 0, z: 0 });
      expect(path![path!.length - 1]).toEqual({ x: 4, z: 0 });
    });

    it('returns null when blocked by walls', () => {
      const overrides = new Map<string, Partial<Tile>>();
      // Wall across column 2
      for (let z = 0; z < 5; z++) {
        overrides.set(`2,${z}`, { walkable: false, type: TileType.WALL });
      }
      const grid = createGrid(5, 5, overrides);
      const pf = new Pathfinder(grid, 5, 5);
      const path = pf.findPath({ x: 0, z: 0 }, { x: 4, z: 0 });
      expect(path).toBeNull();
    });

    it('respects maxCost', () => {
      const grid = createGrid(5, 5);
      const pf = new Pathfinder(grid, 5, 5);
      // Distance is 4, maxCost 2 should fail
      const path = pf.findPath({ x: 0, z: 0 }, { x: 4, z: 0 }, 2);
      expect(path).toBeNull();
    });

    it('finds path with sufficient maxCost', () => {
      const grid = createGrid(5, 5);
      const pf = new Pathfinder(grid, 5, 5);
      const path = pf.findPath({ x: 0, z: 0 }, { x: 2, z: 0 }, 3);
      expect(path).not.toBeNull();
      expect(path!.length).toBe(3);
    });
  });

  describe('getReachableTiles', () => {
    it('returns correct tiles within movement range', () => {
      const grid = createGrid(5, 5);
      const pf = new Pathfinder(grid, 5, 5);
      const reachable = pf.getReachableTiles({ x: 2, z: 2 }, 1);
      // 4 adjacent tiles at cost 1
      expect(reachable.size).toBe(4);
      expect(reachable.has('2,1')).toBe(true);
      expect(reachable.has('2,3')).toBe(true);
      expect(reachable.has('1,2')).toBe(true);
      expect(reachable.has('3,2')).toBe(true);
    });

    it('handles water tiles with higher movement cost', () => {
      const overrides = new Map<string, Partial<Tile>>();
      overrides.set('3,2', { movementCost: 2, type: TileType.WATER });
      const grid = createGrid(5, 5, overrides);
      const pf = new Pathfinder(grid, 5, 5);
      const reachable = pf.getReachableTiles({ x: 2, z: 2 }, 2);
      // (3,2) costs 2 so reachable, but tiles beyond it are not within budget
      expect(reachable.has('3,2')).toBe(true);
      const entry = reachable.get('3,2')!;
      expect(entry.cost).toBe(2);
    });

    it('does not include start position in results', () => {
      const grid = createGrid(5, 5);
      const pf = new Pathfinder(grid, 5, 5);
      const reachable = pf.getReachableTiles({ x: 2, z: 2 }, 2);
      expect(reachable.has('2,2')).toBe(false);
    });
  });

  describe('getTilesInRange', () => {
    it('returns correct Manhattan distance positions', () => {
      const grid = createGrid(5, 5);
      const pf = new Pathfinder(grid, 5, 5);
      const tiles = pf.getTilesInRange({ x: 2, z: 2 }, 1);
      expect(tiles.length).toBe(4);
      expect(tiles).toContainEqual({ x: 1, z: 2 });
      expect(tiles).toContainEqual({ x: 3, z: 2 });
      expect(tiles).toContainEqual({ x: 2, z: 1 });
      expect(tiles).toContainEqual({ x: 2, z: 3 });
    });

    it('includes center when includeCenter is true', () => {
      const grid = createGrid(5, 5);
      const pf = new Pathfinder(grid, 5, 5);
      const tiles = pf.getTilesInRange({ x: 2, z: 2 }, 1, true);
      expect(tiles).toContainEqual({ x: 2, z: 2 });
      expect(tiles.length).toBe(5);
    });

    it('clips positions to grid bounds', () => {
      const grid = createGrid(5, 5);
      const pf = new Pathfinder(grid, 5, 5);
      const tiles = pf.getTilesInRange({ x: 0, z: 0 }, 1);
      // Only (1,0) and (0,1) are in bounds
      expect(tiles.length).toBe(2);
    });
  });

  describe('hasLineOfSight', () => {
    it('returns true through open tiles', () => {
      const grid = createGrid(5, 5);
      const pf = new Pathfinder(grid, 5, 5);
      expect(pf.hasLineOfSight({ x: 0, z: 0 }, { x: 4, z: 0 })).toBe(true);
    });

    it('returns false when blocked by a wall', () => {
      const overrides = new Map<string, Partial<Tile>>();
      overrides.set('2,0', { walkable: false, type: TileType.WALL });
      const grid = createGrid(5, 5, overrides);
      const pf = new Pathfinder(grid, 5, 5);
      expect(pf.hasLineOfSight({ x: 0, z: 0 }, { x: 4, z: 0 })).toBe(false);
    });

    it('returns true for adjacent tiles', () => {
      const grid = createGrid(5, 5);
      const pf = new Pathfinder(grid, 5, 5);
      expect(pf.hasLineOfSight({ x: 0, z: 0 }, { x: 1, z: 0 })).toBe(true);
    });
  });
});
