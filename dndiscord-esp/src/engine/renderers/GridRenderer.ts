import {
  Scene,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Color3,
  ActionManager,
  AbstractMesh,
  ShadowGenerator,
  Animation,
} from '@babylonjs/core';
import { setRotationYRadians } from '../../components/map-editor/rotation';
import { Tile, TileType } from '../../types';
import { gridToWorld, TILE_SIZE, GRID_SIZE } from '../../game';
import { posToKey } from '../../game/utils/GridUtils';
import { ModelLoader } from '../ModelLoader';
import { loadMap, type SavedMapData, type SavedCellData } from '../../services/mapStorage';
import { ASSET_PACKS } from '../../config/assetPacks';

export class GridRenderer {
  private scene: Scene;
  private materials: Map<string, StandardMaterial>;
  private modelLoader: ModelLoader;
  private shadowGenerator: ShadowGenerator | null;
  private tileMeshes: Map<string, Mesh | AbstractMesh> = new Map();
  private teleportOverlays: Mesh[] = [];
  private mapAssets: Map<string, SavedCellData> = new Map();
  
  // Model paths for dungeon tiles
  private readonly FLOOR_MODEL = '/models/dungeon/floor_tile_small.gltf';
  private readonly WALL_MODEL = '/models/blocks/bricks_B.gltf';
  private readonly WATER_MODEL = '/models/blocks/water.gltf';
  
  constructor(
    scene: Scene, 
    materials: Map<string, StandardMaterial>, 
    modelLoader: ModelLoader,
    shadowGenerator: ShadowGenerator | null
  ) {
    this.scene = scene;
    this.materials = materials;
    this.modelLoader = modelLoader;
    this.shadowGenerator = shadowGenerator;
  }

  /**
   * Preload dungeon models
   */
  public async preloadModels(): Promise<void> {
    console.log('Preloading dungeon models...');
    try {
      await this.modelLoader.preloadModels([
        this.FLOOR_MODEL, 
        this.WALL_MODEL, 
        this.WATER_MODEL
      ]);
      console.log('Dungeon models preloaded successfully (floor, walls, water)');
    } catch (error) {
      console.error('Error preloading dungeon models:', error);
    }
  }

  /**
   * Create the entire grid
   * @param tileData - The tile data to render
   * @param mapId - Optional map ID to load saved map assets
   */
  public async createGrid(tileData: Record<string, Tile>, mapId: string | null = null): Promise<void> {
    // Clear existing tiles
    this.clearGrid();
    this.mapAssets.clear();
    
    // Load map assets if mapId is provided
    if (mapId) {
      const savedMap = loadMap(mapId);
      if (savedMap) {
        console.log('[GridRenderer] Loading saved map assets:', savedMap.name);
        savedMap.cells.forEach((cell: SavedCellData) => {
          const key = posToKey({ x: cell.x, z: cell.z });
          this.mapAssets.set(key, cell);
        });
      }
    }
    
    // Create tiles sequentially to ensure proper loading
    for (const [key, tile] of Object.entries(tileData)) {
      const mesh = await this.createTile(tile, key);
      this.tileMeshes.set(key, mesh);
    }
    
    // Create grid border
    this.createGridBorder();

    // Create teleport cell overlays
    if (mapId) {
      this.createTeleportOverlays(mapId);
    }
    
    console.log(`Grid created with ${this.tileMeshes.size} tiles`);
  }

  /**
   * Find asset by path in asset packs
   */
  private findAssetByPath(path: string): { path: string; type: string } | null {
    // Check all asset packs
    for (const pack of Object.values(ASSET_PACKS)) {
      const fullPath = `${pack.basePath}/${path}`;
      if (pack.files.some(file => `${pack.basePath}/${file}` === path || file === path)) {
        return { path, type: pack.type };
      }
    }
    return null;
  }

  /**
   * Create a single tile mesh
   * @param tile - The tile data
   * @param tileKey - The tile key (e.g., "5,3")
   */
  private async createTile(tile: Tile, tileKey: string): Promise<Mesh | AbstractMesh> {
    const worldPos = gridToWorld(tile.position);
    const tileName = `tile_${tile.position.x}_${tile.position.z}`;
    
    // Check if we have saved map assets for this cell
    const cellData = this.mapAssets.get(tileKey);
    
    let mesh: Mesh | AbstractMesh;
    
    // If we have saved map assets, load them instead of default models
    if (cellData) {
      mesh = await this.loadMapAssetsForTile(tile, cellData, worldPos, tileName);
    } else {
      // Use default models based on tile type
      mesh = await this.createDefaultTile(tile, worldPos, tileName);
    }
    
    // Configure all tiles
    mesh.receiveShadows = true;
    mesh.isPickable = true;
    if (!mesh.actionManager) {
      mesh.actionManager = new ActionManager(this.scene);
    }
    
    // Enable shadow receiving for all child meshes
    mesh.getChildMeshes(true).forEach(child => {
      child.receiveShadows = true;
    });
    
    // Walls should cast shadows
    if (tile.type === TileType.WALL) {
      this.enableShadowCasting(mesh);
    }
    
    return mesh;
  }

  /**
   * Load assets from saved map for a tile
   */
  private async loadMapAssetsForTile(
    tile: Tile,
    cellData: SavedCellData,
    worldPos: { x: number; z: number },
    tileName: string
  ): Promise<Mesh | AbstractMesh> {
    // Create a parent container for all assets in this cell
    const container = MeshBuilder.CreateBox(
      `${tileName}_container`,
      { width: 0.01, height: 0.01, depth: 0.01 },
      this.scene
    );
    container.position.set(worldPos.x, 0, worldPos.z);
    container.isVisible = false; // Container is invisible
    container.isPickable = true;
    
    // Load ground asset if present
    if (cellData.ground) {
      try {
        const groundMesh = await this.modelLoader.loadModel(
          cellData.ground.assetPath,
          `${tileName}_ground`
        );
        groundMesh.position.set(0, cellData.ground.positionY, 0);
        groundMesh.scaling.setAll(cellData.ground.scale);
        setRotationYRadians(groundMesh, cellData.ground.rotationY);
        groundMesh.parent = container;
        groundMesh.computeWorldMatrix(true);
        groundMesh.getChildMeshes(false).forEach(child => child.computeWorldMatrix(true));
      } catch (error) {
        console.warn(`Failed to load ground asset for ${tileName}:`, error);
      }
    }
    
    // Load stacked assets
    for (let i = 0; i < cellData.stackedAssets.length; i++) {
      const assetData = cellData.stackedAssets[i];
      try {
        const assetMesh = await this.modelLoader.loadModel(
          assetData.assetPath,
          `${tileName}_asset_${i}`
        );
        assetMesh.position.set(0, assetData.positionY, 0);
        assetMesh.scaling.setAll(assetData.scale);
        setRotationYRadians(assetMesh, assetData.rotationY);
        assetMesh.parent = container;
        assetMesh.computeWorldMatrix(true);
        assetMesh.getChildMeshes(false).forEach(child => child.computeWorldMatrix(true));
        
        // Enable shadow casting for walls and blocks
        if (assetData.assetType === 'wall' || assetData.assetType === 'block') {
          this.enableShadowCasting(assetMesh);
        }
      } catch (error) {
        console.warn(`Failed to load asset ${i} for ${tileName}:`, error);
      }
    }
    
    return container;
  }

  /**
   * Create default tile based on tile type
   */
  private async createDefaultTile(
    tile: Tile,
    worldPos: { x: number; z: number },
    tileName: string
  ): Promise<Mesh | AbstractMesh> {
    let mesh: Mesh | AbstractMesh;
    
    switch (tile.type) {
      case TileType.WALL:
        // Load 3D wall model
        console.log(`Loading wall model for ${tileName}`);
        try {
          mesh = await this.modelLoader.loadModel(this.WALL_MODEL, tileName);
          mesh.position.set(worldPos.x, 0.5, worldPos.z);
          // Scale down to fit within 1 tile (models are 2x2 units, we need 1x1)
          mesh.scaling.setAll(0.5);
          // Apply BlockBits texture to all child meshes
          this.applyMaterialToMesh(mesh, 'blockBits');
        } catch (error) {
          console.error(`Failed to load wall model for ${tileName}, using fallback:`, error);
          mesh = this.createFallbackWall(tileName, worldPos);
        }
        break;
        
      case TileType.WATER:
        // Load 3D water model
        console.log(`Loading water model for ${tileName}`);
        try {
          mesh = await this.modelLoader.loadModel(this.WATER_MODEL, tileName);
          // Position at floor level - water model extends from Y=-1 to Y=1.225 in its local space
          // After scaling by 0.5, that's -0.5 to 0.6125, so we offset to keep top at/below floor (Y=0)
          mesh.position.set(worldPos.x, -0.45, worldPos.z);
          // Scale down to fit within 1 tile (models are 2x2 units, we need 1x1)
          mesh.scaling.setAll(0.5);
          // Apply blue water material instead of the dark texture
          this.applyMaterialToMesh(mesh, 'water');
        } catch (error) {
          console.error(`Failed to load water model for ${tileName}, using fallback:`, error);
          mesh = this.createWaterTile(tileName, worldPos);
        }
        break;
        
      default:
        // Load 3D floor model
        console.log(`Loading floor model for ${tileName}`);
        try {
          mesh = await this.modelLoader.loadModel(this.FLOOR_MODEL, tileName);
          mesh.position.set(worldPos.x, 0, worldPos.z);
          // Scale down to fit within 1 tile (models are 2x2 units, we need 1x1)
          mesh.scaling.setAll(0.48);
          // Apply dungeon texture to all child meshes
          this.applyMaterialToMesh(mesh, 'dungeon');
        } catch (error) {
          console.error(`Failed to load floor model for ${tileName}, using fallback:`, error);
          mesh = this.createFallbackFloor(tileName, worldPos);
        }
    }
    
    // Configure all tiles
    mesh.receiveShadows = true;
    mesh.isPickable = true;
    if (!mesh.actionManager) {
      mesh.actionManager = new ActionManager(this.scene);
    }
    
    // Enable shadow receiving for all child meshes
    mesh.getChildMeshes(true).forEach(child => {
      child.receiveShadows = true;
    });
    
    // Walls should cast shadows
    if (tile.type === TileType.WALL) {
      this.enableShadowCasting(mesh);
    }
    
    return mesh;
  }
  
  /**
   * Apply material to a mesh and all its children
   */
  private applyMaterialToMesh(mesh: AbstractMesh | Mesh, materialName: string): void {
    const material = this.materials.get(materialName);
    if (!material) {
      console.warn(`Material ${materialName} not found`);
      return;
    }
    
    // Apply to root mesh if it's a Mesh
    if (mesh instanceof Mesh) {
      mesh.material = material;
    }
    
    // Apply to all child meshes
    const children = mesh.getChildMeshes(true);
    children.forEach(child => {
      if (child instanceof Mesh) {
        child.material = material;
      }
    });
    
    console.log(`Applied ${materialName} material to ${mesh.name} and ${children.length} children`);
  }

  /**
   * Create fallback floor tile (simple box)
   */
  private createFallbackFloor(name: string, worldPos: { x: number; z: number }): Mesh {
    const mesh = MeshBuilder.CreateBox(
      name,
      { width: TILE_SIZE * 0.95, height: TILE_SIZE * 0.1, depth: TILE_SIZE * 0.95 },
      this.scene
    );
    mesh.position.set(worldPos.x, TILE_SIZE * 0.05, worldPos.z);
    mesh.material = this.materials.get('floor')!;
    return mesh;
  }
  
  /**
   * Create fallback wall tile (simple box)
   */
  private createFallbackWall(name: string, worldPos: { x: number; z: number }): Mesh {
    const mesh = MeshBuilder.CreateBox(
      name,
      { width: TILE_SIZE * 0.95, height: TILE_SIZE, depth: TILE_SIZE * 0.95 },
      this.scene
    );
    mesh.position.set(worldPos.x, TILE_SIZE / 2, worldPos.z);
    mesh.material = this.materials.get('wall')!;
    return mesh;
  }
  
  /**
   * Create water tile (simple box with transparency)
   */
  private createWaterTile(name: string, worldPos: { x: number; z: number }): Mesh {
    const mesh = MeshBuilder.CreateBox(
      name,
      { width: TILE_SIZE * 0.95, height: TILE_SIZE * 0.1, depth: TILE_SIZE * 0.95 },
      this.scene
    );
    mesh.position.set(worldPos.x, TILE_SIZE * 0.05 - 0.1, worldPos.z);
    mesh.material = this.materials.get('water')!;
    return mesh;
  }

  /**
   * Create glowing purple overlays on teleport cells so players can see portals
   */
  private createTeleportOverlays(mapId: string): void {
    this.teleportOverlays.forEach(m => { if (!m.isDisposed()) m.dispose(); });
    this.teleportOverlays = [];

    const savedMap = loadMap(mapId);
    if (!savedMap?.spawnZones) return;

    const teleportMat = new StandardMaterial('teleportOverlayMat', this.scene);
    teleportMat.diffuseColor = new Color3(0.6, 0, 1);
    teleportMat.emissiveColor = new Color3(0.4, 0, 0.8);
    teleportMat.alpha = 0.5;
    teleportMat.disableLighting = true;

    Object.entries(savedMap.spawnZones).forEach(([key, type]) => {
      if (type !== 'teleport') return;
      const [x, z] = key.split(',').map(Number);
      const worldPos = gridToWorld({ x, z });

      const overlay = MeshBuilder.CreatePlane(
        `teleport_overlay_${x}_${z}`,
        { width: TILE_SIZE * 0.85, height: TILE_SIZE * 0.85 },
        this.scene
      );
      overlay.rotation.x = Math.PI / 2;
      overlay.position.set(worldPos.x, 0.12, worldPos.z);
      overlay.material = teleportMat;
      overlay.isPickable = false;

      const pulseAnim = new Animation(
        `teleportPulse_${x}_${z}`,
        'material.alpha',
        30,
        Animation.ANIMATIONTYPE_FLOAT,
        Animation.ANIMATIONLOOPMODE_CYCLE
      );
      pulseAnim.setKeys([
        { frame: 0, value: 0.3 },
        { frame: 30, value: 0.6 },
        { frame: 60, value: 0.3 },
      ]);
      overlay.animations.push(pulseAnim);
      this.scene.beginAnimation(overlay, 0, 60, true);

      this.teleportOverlays.push(overlay);
    });
  }

  /**
   * Create decorative border around the grid
   */
  private createGridBorder(): void {
    const borderMat = new StandardMaterial('borderMat', this.scene);
    borderMat.diffuseColor = new Color3(0.15, 0.15, 0.2);
    
    const halfSize = (GRID_SIZE * TILE_SIZE) / 2;
    const borderWidth = 0.2;
    const borderHeight = 0.15;
    
    const positions = [
      { x: 0, z: -halfSize - borderWidth / 2, scaleX: GRID_SIZE + borderWidth * 2, scaleZ: borderWidth },
      { x: 0, z: halfSize + borderWidth / 2, scaleX: GRID_SIZE + borderWidth * 2, scaleZ: borderWidth },
      { x: -halfSize - borderWidth / 2, z: 0, scaleX: borderWidth, scaleZ: GRID_SIZE },
      { x: halfSize + borderWidth / 2, z: 0, scaleX: borderWidth, scaleZ: GRID_SIZE },
    ];
    
    positions.forEach((pos, i) => {
      const border = MeshBuilder.CreateBox(
        `border_${i}`,
        { width: pos.scaleX, height: borderHeight, depth: pos.scaleZ },
        this.scene
      );
      border.position.set(pos.x, borderHeight / 2, pos.z);
      border.material = borderMat;
      border.isPickable = false;
    });
  }

  /**
   * Clear all tile meshes and borders
   */
  public clearGrid(): void {
    console.log(`[GridRenderer] Clearing ${this.tileMeshes.size} tracked tiles`);
    this.tileMeshes.forEach((mesh) => {
      if (mesh && !mesh.isDisposed()) {
        mesh.dispose();
      }
    });
    this.tileMeshes.clear();

    this.teleportOverlays.forEach(m => { if (!m.isDisposed()) m.dispose(); });
    this.teleportOverlays = [];
    
    // Also clear border meshes
    const borderMeshes = this.scene.meshes.filter(m => m.name.startsWith('border_'));
    console.log(`[GridRenderer] Clearing ${borderMeshes.length} border meshes`);
    borderMeshes.forEach(m => {
      if (!m.isDisposed()) {
        m.dispose();
      }
    });
    
    // Clear any orphaned tile meshes
    const orphanedTiles = this.scene.meshes.filter(m => m.name.startsWith('tile_'));
    if (orphanedTiles.length > 0) {
      console.log(`[GridRenderer] Found ${orphanedTiles.length} orphaned tile meshes, disposing...`);
      orphanedTiles.forEach(mesh => {
        if (!mesh.isDisposed()) {
          mesh.dispose();
        }
      });
    }
    
    console.log('[GridRenderer] Grid cleared');
  }

  /**
   * Enable shadow casting for mesh and children
   */
  private enableShadowCasting(mesh: AbstractMesh): void {
    if (!this.shadowGenerator) return;
    
    // Add the mesh itself
    this.shadowGenerator.addShadowCaster(mesh);
    
    // Add all child meshes
    mesh.getChildMeshes(true).forEach((childMesh) => {
      this.shadowGenerator!.addShadowCaster(childMesh);
    });
  }
}

