/**
 * Grid Utilities
 * 
 * Helper functions for grid position conversion and manipulation
 */

import { GridPosition } from '../../types';
import { GRID_SIZE, TILE_SIZE } from '../constants';

/**
 * Convert grid position to string key for storage
 */
export function posToKey(pos: GridPosition): string {
  return `${pos.x},${pos.z}`;
}

/**
 * Convert string key back to grid position
 */
export function keyToPos(key: string): GridPosition {
  const [x, z] = key.split(',').map(Number);
  return { x, z };
}

/**
 * Convert grid position to 3D world coordinates
 */
export function gridToWorld(pos: GridPosition): { x: number; y: number; z: number } {
  return {
    x: (pos.x - GRID_SIZE / 2 + 0.5) * TILE_SIZE,
    y: 0,
    z: (pos.z - GRID_SIZE / 2 + 0.5) * TILE_SIZE,
  };
}

