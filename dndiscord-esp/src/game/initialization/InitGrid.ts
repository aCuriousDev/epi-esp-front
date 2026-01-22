/**
 * Grid Initialization
 * 
 * Sets up the game grid with tiles and terrain
 * Can load a saved map if mapId is provided
 */

import { TileType } from '../../types';
import { GRID_SIZE } from '../constants';
import { posToKey } from '../utils/GridUtils';
import { setTiles, initializePathfinder } from '../stores/TilesStore';
import { loadMap, type SavedMapData, type SavedCellData } from '../../services/mapStorage';
import { getCollisionProperties } from '../utils/CollisionUtils';

export function initializeGrid(mapId: string | null = null): void {
  const newTiles: Record<string, any> = {};
  
  // If a map ID is provided, try to load it
  if (mapId) {
    const savedMap = loadMap(mapId);
    if (savedMap) {
      console.log('[initializeGrid] Loading saved map:', savedMap.name);
      loadMapToTiles(savedMap, newTiles);
    } else {
      console.warn('[initializeGrid] Map not found:', mapId, '- using default grid');
      createDefaultGrid(newTiles);
    }
  } else {
    // Create default grid
    createDefaultGrid(newTiles);
  }
  
  setTiles(newTiles);
  
  // Initialize pathfinder
  const tileMap = new Map<string, any>();
  Object.entries(newTiles).forEach(([key, tile]) => {
    tileMap.set(key, tile);
  });
  initializePathfinder(tileMap, GRID_SIZE, GRID_SIZE);
}

/**
 * Creates the default grid layout
 */
function createDefaultGrid(newTiles: Record<string, any>): void {
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
}

/**
 * Loads a saved map into the tiles
 * Maps saved assets to tile types based on asset type using collision utilities
 */
function loadMapToTiles(savedMap: SavedMapData, newTiles: Record<string, any>): void {
  // First, initialize all tiles as FLOOR
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let z = 0; z < GRID_SIZE; z++) {
      const key = posToKey({ x, z });
      newTiles[key] = {
        position: { x, z },
        type: TileType.FLOOR,
        elevation: 0,
        walkable: true,
        movementCost: 1,
        occupiedBy: null,
        effects: [],
      };
    }
  }
  
  // Then, process saved cells to update tile types based on assets
  savedMap.cells.forEach((cellData: SavedCellData) => {
    const key = posToKey({ x: cellData.x, z: cellData.z });
    const tile = newTiles[key];
    if (!tile) return;
    
    // Process ground (floor tiles) - ground determines base terrain
    if (cellData.ground) {
      const groundProps = getCollisionProperties(cellData.ground.assetType);
      tile.type = groundProps.tileType;
      tile.walkable = groundProps.walkable;
      tile.movementCost = groundProps.movementCost;
    }
    
    // Process stacked assets - the first blocking asset determines if the tile is blocked
    // We process from bottom to top, so the first blocking asset wins
    for (const asset of cellData.stackedAssets) {
      const assetProps = getCollisionProperties(asset.assetType);
      
      // If this asset blocks movement, update the tile accordingly
      if (assetProps.blocksMovement) {
        tile.type = assetProps.tileType;
        tile.walkable = assetProps.walkable;
        tile.movementCost = assetProps.movementCost;
        // Once we find a blocking asset, we stop (first blocking asset wins)
        break;
      }
      
      // If the asset doesn't block but has a higher movement cost, use that
      // (e.g., difficult terrain on top of floor)
      if (assetProps.movementCost > tile.movementCost) {
        tile.movementCost = assetProps.movementCost;
      }
    }
  });
}

