import {
  getCollisionProperties,
  doesAssetBlockMovement,
  getMovementCost,
} from '../utils/CollisionUtils';
import { TileType } from '../../types';

describe('CollisionUtils', () => {
  describe('getCollisionProperties', () => {
    it('wall: not walkable, blocks movement, WALL type', () => {
      const props = getCollisionProperties('wall');
      expect(props.walkable).toBe(false);
      expect(props.blocksMovement).toBe(true);
      expect(props.tileType).toBe(TileType.WALL);
      expect(props.movementCost).toBe(Infinity);
    });

    it('block: same as wall', () => {
      const props = getCollisionProperties('block');
      expect(props.walkable).toBe(false);
      expect(props.blocksMovement).toBe(true);
      expect(props.tileType).toBe(TileType.WALL);
    });

    it('obstacle: not walkable, OBSTACLE type', () => {
      const props = getCollisionProperties('obstacle');
      expect(props.walkable).toBe(false);
      expect(props.blocksMovement).toBe(true);
      expect(props.tileType).toBe(TileType.OBSTACLE);
    });

    it('water: walkable, cost 2, WATER type', () => {
      const props = getCollisionProperties('water');
      expect(props.walkable).toBe(true);
      expect(props.movementCost).toBe(2);
      expect(props.tileType).toBe(TileType.WATER);
      expect(props.blocksMovement).toBe(false);
    });

    it('lava: walkable, cost 3, LAVA type', () => {
      const props = getCollisionProperties('lava');
      expect(props.walkable).toBe(true);
      expect(props.movementCost).toBe(3);
      expect(props.tileType).toBe(TileType.LAVA);
      expect(props.blocksMovement).toBe(false);
    });

    it('floor: walkable, cost 1, FLOOR type', () => {
      const props = getCollisionProperties('floor');
      expect(props.walkable).toBe(true);
      expect(props.movementCost).toBe(1);
      expect(props.tileType).toBe(TileType.FLOOR);
      expect(props.blocksMovement).toBe(false);
    });

    it('furniture: blocks movement, OBSTACLE type', () => {
      const props = getCollisionProperties('furniture');
      expect(props.walkable).toBe(false);
      expect(props.blocksMovement).toBe(true);
      expect(props.tileType).toBe(TileType.OBSTACLE);
    });

    it('decoration: blocks movement, OBSTACLE type', () => {
      const props = getCollisionProperties('decoration');
      expect(props.walkable).toBe(false);
      expect(props.blocksMovement).toBe(true);
      expect(props.tileType).toBe(TileType.OBSTACLE);
    });

    it('nature: blocks movement, OBSTACLE type', () => {
      const props = getCollisionProperties('nature');
      expect(props.walkable).toBe(false);
      expect(props.blocksMovement).toBe(true);
      expect(props.tileType).toBe(TileType.OBSTACLE);
    });

    it('resource: walkable, cost 1, FLOOR type', () => {
      const props = getCollisionProperties('resource');
      expect(props.walkable).toBe(true);
      expect(props.movementCost).toBe(1);
      expect(props.tileType).toBe(TileType.FLOOR);
      expect(props.blocksMovement).toBe(false);
    });

    it('character: walkable, FLOOR type', () => {
      const props = getCollisionProperties('character');
      expect(props.walkable).toBe(true);
      expect(props.tileType).toBe(TileType.FLOOR);
      expect(props.blocksMovement).toBe(false);
    });

    it('enemy: walkable, FLOOR type', () => {
      const props = getCollisionProperties('enemy');
      expect(props.walkable).toBe(true);
      expect(props.tileType).toBe(TileType.FLOOR);
      expect(props.blocksMovement).toBe(false);
    });

    it('unknown type: defaults to walkable floor', () => {
      const props = getCollisionProperties('something_random');
      expect(props.walkable).toBe(true);
      expect(props.movementCost).toBe(1);
      expect(props.tileType).toBe(TileType.FLOOR);
      expect(props.blocksMovement).toBe(false);
    });
  });

  describe('doesAssetBlockMovement', () => {
    it('returns true for wall', () => {
      expect(doesAssetBlockMovement('wall')).toBe(true);
    });

    it('returns false for floor', () => {
      expect(doesAssetBlockMovement('floor')).toBe(false);
    });

    it('returns false for water', () => {
      expect(doesAssetBlockMovement('water')).toBe(false);
    });
  });

  describe('getMovementCost', () => {
    it('returns 1 for floor', () => {
      expect(getMovementCost('floor')).toBe(1);
    });

    it('returns 2 for water', () => {
      expect(getMovementCost('water')).toBe(2);
    });

    it('returns 3 for lava', () => {
      expect(getMovementCost('lava')).toBe(3);
    });

    it('returns Infinity for wall', () => {
      expect(getMovementCost('wall')).toBe(Infinity);
    });
  });
});
