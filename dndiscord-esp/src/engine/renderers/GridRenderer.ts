import {
  Scene,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Color3,
  ActionManager,
  AbstractMesh,
  ShadowGenerator,
} from '@babylonjs/core';
import { Tile, TileType } from '../../types';
import { gridToWorld, TILE_SIZE, GRID_SIZE } from '../../game';
import { ModelLoader } from '../ModelLoader';

export class GridRenderer {
  private scene: Scene;
  private materials: Map<string, StandardMaterial>;
  private modelLoader: ModelLoader;
  private shadowGenerator: ShadowGenerator | null;
  private tileMeshes: Map<string, Mesh | AbstractMesh> = new Map();
  
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
   */
  public async createGrid(tileData: Record<string, Tile>): Promise<void> {
    // Clear existing tiles
    this.clearGrid();
    
    // Create tiles sequentially to ensure proper loading
    for (const [key, tile] of Object.entries(tileData)) {
      const mesh = await this.createTile(tile);
      this.tileMeshes.set(key, mesh);
    }
    
    // Create grid border
    this.createGridBorder();
    
    console.log(`Grid created with ${this.tileMeshes.size} tiles`);
  }

  /**
   * Create a single tile mesh
   */
  private async createTile(tile: Tile): Promise<Mesh | AbstractMesh> {
    const worldPos = gridToWorld(tile.position);
    const tileName = `tile_${tile.position.x}_${tile.position.z}`;
    
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

