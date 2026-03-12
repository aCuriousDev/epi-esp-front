/**
 * Collision Utilities
 * 
 * Helper functions to determine collision properties from asset types
 */

import { TileType } from '../../types';

export interface CollisionProperties {
  walkable: boolean;
  movementCost: number;
  tileType: TileType;
  blocksMovement: boolean;
}

/**
 * Determines collision properties based on asset type
 * This is used both in MapEditor (for preview) and in game initialization
 */
export function getCollisionProperties(assetType: string): CollisionProperties {
  // Default properties (walkable floor)
  let walkable = true;
  let movementCost = 1;
  let tileType = TileType.FLOOR;
  let blocksMovement = false;

  switch (assetType) {
    // Walls and blocks - completely block movement
    case 'wall':
    case 'block':
      walkable = false;
      movementCost = Infinity;
      tileType = TileType.WALL;
      blocksMovement = true;
      break;

    // Obstacles - block movement
    case 'obstacle':
      walkable = false;
      movementCost = Infinity;
      tileType = TileType.OBSTACLE;
      blocksMovement = true;
      break;

    // Water - difficult terrain (higher movement cost)
    case 'water':
      walkable = true;
      movementCost = 2;
      tileType = TileType.WATER;
      blocksMovement = false;
      break;

    // Lava - dangerous terrain (very high movement cost or blocked)
    case 'lava':
      walkable = true; // Can walk but dangerous
      movementCost = 3;
      tileType = TileType.LAVA;
      blocksMovement = false;
      break;

    // Floor tiles - normal walkable
    case 'floor':
      walkable = true;
      movementCost = 1;
      tileType = TileType.FLOOR;
      blocksMovement = false;
      break;

    // Furniture and decorations - block movement if they're large enough
    // For now, we'll make them block movement by default
    // In the future, we could check the bounding box size
    case 'furniture':
    case 'decoration':
      // Most furniture blocks movement, but small decorations might not
      // For now, we'll make them block movement
      walkable = false;
      movementCost = Infinity;
      tileType = TileType.OBSTACLE;
      blocksMovement = true;
      break;

    // Nature elements - trees, rocks, etc. usually block movement
    case 'nature':
      walkable = false;
      movementCost = Infinity;
      tileType = TileType.OBSTACLE;
      blocksMovement = true;
      break;

    // Resources - usually small, don't block movement
    case 'resource':
      walkable = true;
      movementCost = 1;
      tileType = TileType.FLOOR;
      blocksMovement = false;
      break;

    // Characters and enemies - these are units, not terrain
    // They don't affect tile properties (handled separately via occupiedBy)
    case 'character':
    case 'enemy':
      walkable = true;
      movementCost = 1;
      tileType = TileType.FLOOR;
      blocksMovement = false;
      break;

    // Default - assume walkable floor
    default:
      walkable = true;
      movementCost = 1;
      tileType = TileType.FLOOR;
      blocksMovement = false;
      break;
  }

  return {
    walkable,
    movementCost,
    tileType,
    blocksMovement,
  };
}

/**
 * Determines if an asset should block movement based on its type
 */
export function doesAssetBlockMovement(assetType: string): boolean {
  return getCollisionProperties(assetType).blocksMovement;
}

/**
 * Gets the movement cost for walking on a tile with this asset type
 */
export function getMovementCost(assetType: string): number {
  return getCollisionProperties(assetType).movementCost;
}
