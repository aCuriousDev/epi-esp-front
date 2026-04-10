/**
 * Tiles Store
 * 
 * Manages the game grid tiles and pathfinder
 */

import { createStore } from 'solid-js/store';
import { Tile } from '../../types';
import { Pathfinder } from '../../utils/pathfinding';

// ============================================
// TILES STORE
// ============================================

export const [tiles, setTiles] = createStore<Record<string, Tile>>({});

// ============================================
// PATHFINDER
// ============================================

export let pathfinder: Pathfinder | null = null;

export function initializePathfinder(tileMap: Map<string, Tile>, width: number, height: number): void {
  pathfinder = new Pathfinder(tileMap, width, height);
}

export function updatePathfinder(): void {
  // Rebuild pathfinder with current tiles
  const tileMap = new Map<string, Tile>();
  Object.entries(tiles).forEach(([key, tile]) => {
    tileMap.set(key, tile);
  });
  
  // Find grid dimensions from tiles
  let maxX = 0;
  let maxZ = 0;
  Object.values(tiles).forEach(tile => {
    if (tile.position.x > maxX) maxX = tile.position.x;
    if (tile.position.z > maxZ) maxZ = tile.position.z;
  });
  
  pathfinder = new Pathfinder(tileMap, maxX + 1, maxZ + 1);
}

// ============================================
// TILE MANAGEMENT
// ============================================

export function clearTiles(): void {
  setTiles({});
  pathfinder = null;
}

/**
 * Clear occupancy for any tile occupied by one of unitIds.
 * This keeps the grid consistent when a unit is removed (disconnect/leave).
 */
export function clearOccupancyByUnitIds(unitIds: string[]): void {
  if (unitIds.length === 0) return;
  const set = new Set(unitIds);
  for (const [key, tile] of Object.entries(tiles)) {
    if (tile.occupiedBy && set.has(tile.occupiedBy)) {
      setTiles(key, "occupiedBy", null);
    }
  }
}

