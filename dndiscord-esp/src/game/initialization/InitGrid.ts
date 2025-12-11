/**
 * Grid Initialization
 * 
 * Sets up the game grid with tiles and terrain
 */

import { TileType } from '../../types';
import { GRID_SIZE } from '../constants';
import { posToKey } from '../utils/GridUtils';
import { setTiles, initializePathfinder } from '../stores/TilesStore';

export function initializeGrid(): void {
  const newTiles: Record<string, any> = {};
  
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let z = 0; z < GRID_SIZE; z++) {
      const key = posToKey({ x, z });
      
      // Create varied terrain
      let type = TileType.FLOOR;
      let walkable = true;
      let movementCost = 1;
      
      // Add some obstacles for interesting gameplay
      if ((x === 3 && z >= 2 && z <= 5) || (x === 6 && z >= 4 && z <= 7)) {
        type = TileType.WALL;
        walkable = false;
      }
      
      // Add some difficult terrain
      if ((x === 4 && z === 4) || (x === 5 && z === 5)) {
        type = TileType.WATER;
        movementCost = 2;
      }
      
      newTiles[key] = {
        position: { x, z },
        type,
        elevation: 0,
        walkable,
        movementCost,
        occupiedBy: null,
        effects: [],
      };
    }
  }
  
  setTiles(newTiles);
  
  // Initialize pathfinder
  const tileMap = new Map<string, any>();
  Object.entries(newTiles).forEach(([key, tile]) => {
    tileMap.set(key, tile);
  });
  initializePathfinder(tileMap, GRID_SIZE, GRID_SIZE);
}

