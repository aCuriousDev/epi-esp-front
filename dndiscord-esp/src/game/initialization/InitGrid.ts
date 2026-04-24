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
import { loadMap, type SavedMapData, type SavedCellData, type SavedAssetData } from '../../services/mapStorage';
import { getCollisionProperties } from '../utils/CollisionUtils';
import { getSessionMapConfig } from '../../stores/session-map.store';

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
  
  // Apply session map config (exitCells / trapCells defined in the MapNode)
  applySessionMapOverrides(newTiles);

  setTiles(newTiles);

  // Initialize pathfinder
  const tileMap = new Map<string, any>();
  Object.entries(newTiles).forEach(([key, tile]) => {
    tileMap.set(key, tile);
  });
  initializePathfinder(tileMap, GRID_SIZE, GRID_SIZE);
}

/**
 * Overlays EXIT / TRAP tile types defined in the active session's MapNode.
 * Called after the main map (or default grid) has been loaded so that
 * scenario-level annotations always win over asset collision data.
 */
function applySessionMapOverrides(newTiles: Record<string, any>): void {
  const cfg = getSessionMapConfig();
  if (!cfg) return;

  // ── Exit cells ───────────────────────────────────────────────────────────
  for (const cell of cfg.exitCells ?? []) {
    const key = posToKey(cell);
    if (newTiles[key]) {
      newTiles[key].type        = TileType.EXIT;
      newTiles[key].walkable    = true;   // players must be able to step on them
      newTiles[key].movementCost = 1;
    }
  }

  // ── Trap cells ───────────────────────────────────────────────────────────
  for (const cell of cfg.trapCells ?? []) {
    const key = posToKey(cell);
    if (newTiles[key]) {
      newTiles[key].type     = TileType.TRAP;
      newTiles[key].walkable = true;      // traps are hidden — walkable until triggered
      // Add a damage effect so the engine can fire it on entry
      newTiles[key].effects = [
        ...(newTiles[key].effects ?? []),
        { id: `trap_${cell.x}_${cell.z}`, type: 'damage', value: 10 },
      ];
    }
  }

  console.log(
    '[InitGrid] Session map overrides applied —',
    (cfg.exitCells?.length ?? 0), 'exit cells,',
    (cfg.trapCells?.length ?? 0), 'trap cells',
  );
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
 * Applique les propriétés de collision d'un asset à une tile
 * Retourne true si l'asset bloque le mouvement
 */
function applyCollisionToTile(tile: any, assetProps: ReturnType<typeof getCollisionProperties>): boolean {
  if (assetProps.blocksMovement) {
    tile.type = assetProps.tileType;
    tile.walkable = assetProps.walkable;
    tile.movementCost = assetProps.movementCost;
    return true;
  }
  
  if (assetProps.movementCost > tile.movementCost) {
    tile.movementCost = assetProps.movementCost;
  }
  return false;
}

/**
 * Applique les collisions d'un asset à toutes ses cellules affectées (multi-cases)
 */
function applyMultiTileCollision(asset: SavedAssetData, newTiles: Record<string, any>): void {
  if (!asset.affectedCells || asset.affectedCells.length <= 1) return;
  
  const assetProps = getCollisionProperties(asset.assetType);
  
  for (const pos of asset.affectedCells) {
    const key = posToKey(pos);
    const tile = newTiles[key];
    if (tile) {
      applyCollisionToTile(tile, assetProps);
    }
  }
}

/**
 * Loads a saved map into the tiles
 * Maps saved assets to tile types based on asset type using collision utilities
 * Supporte les assets multi-cases via affectedCells
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
  
  // Mark teleport cells as walkable with special handling
  const teleportCells = new Set<string>();
  if (savedMap.spawnZones) {
    Object.entries(savedMap.spawnZones).forEach(([key, type]) => {
      if (type === 'teleport') {
        teleportCells.add(key);
        const tile = newTiles[key];
        if (tile) {
          tile.walkable = true;
          tile.movementCost = 1;
        }
      }
    });
  }

  // Then, process saved cells to update tile types based on assets
  savedMap.cells.forEach((cellData: SavedCellData) => {
    const key = posToKey({ x: cellData.x, z: cellData.z });
    const tile = newTiles[key];
    if (!tile) return;
    
    // Process ground (floor tiles) - ground determines base terrain
    if (cellData.ground) {
      const groundProps = getCollisionProperties(cellData.ground.assetType);
      applyCollisionToTile(tile, groundProps);
      
      // Appliquer la collision sur toutes les cellules affectées (sol multi-cases)
      applyMultiTileCollision(cellData.ground, newTiles);
    }
    
    // Process stacked assets - the first blocking asset determines if the tile is blocked
    // We process from bottom to top, so the first blocking asset wins
    for (const asset of cellData.stackedAssets) {
      const assetProps = getCollisionProperties(asset.assetType);
      
      // Appliquer sur la cellule principale
      const blocks = applyCollisionToTile(tile, assetProps);
      
      // Appliquer la collision sur toutes les cellules affectées (assets multi-cases)
      applyMultiTileCollision(asset, newTiles);
      
      if (blocks) break;
    }

    // Ensure teleport cells remain walkable regardless of assets
    const cellKey = posToKey({ x: cellData.x, z: cellData.z });
    if (teleportCells.has(cellKey)) {
      tile.walkable = true;
      tile.movementCost = 1;
    }
  });
}

