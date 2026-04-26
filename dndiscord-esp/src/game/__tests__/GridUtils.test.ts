import { posToKey, keyToPos, gridToWorld } from '../utils/GridUtils';

describe('GridUtils', () => {
  describe('posToKey', () => {
    it('converts position to "x,z" string', () => {
      expect(posToKey({ x: 3, z: 7 })).toBe('3,7');
    });

    it('handles zero coordinates', () => {
      expect(posToKey({ x: 0, z: 0 })).toBe('0,0');
    });
  });

  describe('keyToPos', () => {
    it('parses "x,z" string to position', () => {
      expect(keyToPos('3,7')).toEqual({ x: 3, z: 7 });
    });

    it('handles zero coordinates', () => {
      expect(keyToPos('0,0')).toEqual({ x: 0, z: 0 });
    });
  });

  describe('posToKey / keyToPos round-trip', () => {
    it('round-trips correctly', () => {
      const original = { x: 5, z: 9 };
      expect(keyToPos(posToKey(original))).toEqual(original);
    });
  });

  describe('gridToWorld', () => {
    // GRID_SIZE=10, TILE_SIZE=1
    // formula: x = (pos.x - 10/2 + 0.5) * 1 = pos.x - 4.5

    it('converts center grid position (5,5)', () => {
      const world = gridToWorld({ x: 5, z: 5 });
      expect(world.x).toBeCloseTo(0.5);
      expect(world.y).toBe(0);
      expect(world.z).toBeCloseTo(0.5);
    });

    it('converts origin grid position (0,0)', () => {
      const world = gridToWorld({ x: 0, z: 0 });
      expect(world.x).toBeCloseTo(-4.5);
      expect(world.y).toBe(0);
      expect(world.z).toBeCloseTo(-4.5);
    });

    it('converts edge grid position (9,9)', () => {
      const world = gridToWorld({ x: 9, z: 9 });
      expect(world.x).toBeCloseTo(4.5);
      expect(world.y).toBe(0);
      expect(world.z).toBeCloseTo(4.5);
    });
  });
});
