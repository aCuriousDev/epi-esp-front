import {
  Scene,
  AbstractMesh,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  ShadowGenerator,
  HighlightLayer,
  Color3,
  Vector3,
  Animation,
  Animatable,
  TransformNode,
} from '@babylonjs/core';
import { Unit, UnitType, GridPosition } from '../../types';
import { gridToWorld } from '../../game';
import { ModelLoader } from '../ModelLoader';

/**
 * UnitRenderer - Handles 3D model rendering and animation for game units
 * 
 * ## GLB Model Structure
 * GLB models loaded via ModelLoader have a specific hierarchy:
 * - Root Mesh (e.g., "unit_player_warrior") - Container/transform node
 *   - Rig Node (e.g., "unit_player_warrior.Rig_Medium") - The actual model rig
 *     - Body parts (e.g., "Knight_Body", "Knight_ArmLeft", etc.) - Visible meshes
 * 
 * ## Critical Rotation Behavior
 * GLB models use `rotationQuaternion` by default, NOT Euler angles (`rotation.x/y/z`).
 * When `rotationQuaternion` is set, modifying `rotation.y` has NO EFFECT!
 * 
 * **Solution**: Always convert to Euler angles first:
 * ```typescript
 * if (node.rotationQuaternion) {
 *   node.rotation = node.rotationQuaternion.toEulerAngles();
 *   node.rotationQuaternion = null;
 * }
 * node.rotation.y = targetAngle; // Now this works!
 * ```
 * 
 * ## Rotation Target
 * For GLB models, rotation must be applied to the **Rig node**, not the root mesh.
 * The root mesh is just a container; the Rig node contains the actual visible model.
 * 
 * ## Initial vs Dynamic Rotation
 * - **Initial**: Units spawn facing the board center (calculated from their position)
 * - **Dynamic**: Units rotate to face their movement direction during gameplay
 * 
 * Both use the same principle: find Rig node → convert quaternion → apply rotation.
 */
export class UnitRenderer {
  private scene: Scene;
  private modelLoader: ModelLoader;
  private shadowGenerator: ShadowGenerator | null;
  private highlightLayer: HighlightLayer;
  private unitMeshes: Map<string, AbstractMesh> = new Map();
  private materials: Map<string, StandardMaterial>;
  private activeAnimations: Map<string, Animatable> = new Map();
  
  // Model configuration
  private readonly MODEL_PATHS: Record<string, string> = {
    // Player models
    [UnitType.WARRIOR]: '/models/characters/knight/knight.glb',
    [UnitType.MAGE]: '/models/characters/mage/mage.glb',
    [UnitType.ARCHER]: '/models/characters/ranger/ranger.glb',
    
    // Enemy models
    [UnitType.ENEMY_SKELETON]: '/models/enemies/skeleton_warrior/skeleton_warrior.glb',
    [UnitType.ENEMY_MAGE]: '/models/enemies/skeleton_mage/skeleton_mage.glb',
  };
  
  private readonly MODEL_CONFIG = {
    scale: 0.6,              // Model scale (0.6 = 60% of original size)
    playerYOffset: 0.1,      // Y position for player 3D models
    enemyYOffset: 0.1,       // Y position for enemy 3D models (was 0.5 for capsules)
  };

  constructor(
    scene: Scene,
    modelLoader: ModelLoader,
    shadowGenerator: ShadowGenerator | null,
    highlightLayer: HighlightLayer,
    materials: Map<string, StandardMaterial>
  ) {
    this.scene = scene;
    this.modelLoader = modelLoader;
    this.shadowGenerator = shadowGenerator;
    this.highlightLayer = highlightLayer;
    this.materials = materials;
  }

  /**
   * Create a unit mesh (3D model or fallback)
   * 
   * Now uses 3D models for both players and enemies!
   * Falls back to capsule mesh if model loading fails.
   */
  public async createUnit(unit: Unit): Promise<void> {
    console.log(`Creating unit: ${unit.id}, team: ${unit.team}, type: ${unit.type}, name: ${unit.name}`);
    const worldPosObj = gridToWorld(unit.position);
    const worldPos = new Vector3(worldPosObj.x, worldPosObj.y, worldPosObj.z);
    
    let mesh: AbstractMesh;
    
    // Determine model path (handle special case for Skeleton Archer)
    const modelPath = this.getModelPath(unit);
    
    if (modelPath) {
      console.log(`Loading 3D model for ${unit.id} (${unit.name}) from ${modelPath}`);
      try {
        mesh = await this.load3DModel(unit, worldPos, modelPath);
      } catch (error) {
        console.error(`Failed to load model for ${unit.id}, using fallback:`, error);
        mesh = this.createFallbackMesh(unit, worldPos);
      }
    } else {
      console.log(`No model path for ${unit.id}, creating fallback mesh`);
      mesh = this.createFallbackMesh(unit, worldPos);
    }
    
    // Enable shadows
    this.enableShadows(mesh);
    
    // Make pickable
    mesh.isPickable = true;
    
    this.unitMeshes.set(unit.id, mesh);
  }

  /**
   * Get the model path for a unit
   * Handles special cases like Skeleton Archer (uses rogue model)
   */
  private getModelPath(unit: Unit): string | null {
    // Special case: Skeleton Archer uses the rogue model variant
    if (unit.type === UnitType.ENEMY_SKELETON && unit.name.includes('Archer')) {
      return '/models/enemies/skeleton_rogue/skeleton_rogue.glb';
    }
    
    // Default: use type-based mapping
    return this.MODEL_PATHS[unit.type] || null;
  }

  /**
   * Load a 3D model for a unit and set up its initial state
   * 
   * Process:
   * 1. Load GLB model via ModelLoader (creates root mesh + Rig hierarchy)
   * 2. Scale to appropriate size
   * 3. Position at grid location (converted to world coordinates)
   * 4. Apply initial rotation to face board center (applied to Rig node)
   * 5. Make visible and enable all descendant nodes
   * 
   * @param unit - The unit data
   * @param worldPos - World position from gridToWorld conversion
   * @param modelPath - Path to the GLB model file
   * @returns The root mesh of the loaded model
   */
  private async load3DModel(unit: Unit, worldPos: Vector3, modelPath: string): Promise<AbstractMesh> {
    const mesh = await this.modelLoader.loadModel(
      modelPath,
      `unit_${unit.id}`
    );
    
    console.log(`Model loaded for ${unit.id}`, mesh);
    
    // Scale down the model to fit grid tiles
    mesh.scaling.setAll(this.MODEL_CONFIG.scale);
    
    // Position on grid (Y offset differs for players vs enemies)
    const yOffset = unit.team === 'player' 
      ? this.MODEL_CONFIG.playerYOffset 
      : this.MODEL_CONFIG.enemyYOffset;
    mesh.position.set(worldPos.x, yOffset, worldPos.z);
    console.log(`Positioned ${unit.id} at (${worldPos.x}, ${yOffset}, ${worldPos.z})`);
    
    // Initial rotation - face toward center of board
    // IMPORTANT: Must rotate the Rig node, not the root mesh!
    // See applyInitialRotation() for details on quaternion handling
    const initialRotation = this.calculateInitialRotation(worldPos.x, worldPos.z);
    this.applyInitialRotation(mesh, initialRotation, unit.id);
    
    // Ensure visibility for mesh and all descendants
    this.setMeshVisibility(mesh, true);
    
    return mesh;
  }

  /**
   * Create a fallback capsule mesh for a unit (used if model loading fails)
   */
  private createFallbackMesh(unit: Unit, worldPos: Vector3): Mesh {
    const mesh = MeshBuilder.CreateCapsule(
      `unit_${unit.id}`,
      { radius: 0.3, height: 0.8, tessellation: 16 },
      this.scene
    );
    
    const yOffset = 0.5; // Capsules are taller, need different Y offset
    mesh.position.set(worldPos.x, yOffset, worldPos.z);
    
    // Set material based on team
    const material = unit.team === 'player' 
      ? this.materials.get('player')!.clone(`unit_${unit.id}_mat`)
      : this.materials.get('enemy')!.clone(`unit_${unit.id}_mat`);
    mesh.material = material;
    
    mesh.isPickable = true;
    
    return mesh;
  }

  /**
   * Update a unit's position, rotation, and state
   */
  public updateUnit(unit: Unit, previousPosition?: GridPosition): void {
    const mesh = this.unitMeshes.get(unit.id);
    if (!mesh) {
      console.warn(`[UnitRenderer] updateUnit called for ${unit.id} but mesh not found`);
      return;
    }
    
    const worldPosObj = gridToWorld(unit.position);
    const worldPos = new Vector3(worldPosObj.x, worldPosObj.y, worldPosObj.z);
    const currentY = mesh.position.y;
    
    // Use previous position if available, otherwise use current mesh position
    const fromPosObj = previousPosition 
      ? gridToWorld(previousPosition)
      : { x: mesh.position.x, z: mesh.position.z };
    
    const meshCurrentPos = { x: mesh.position.x, z: mesh.position.z };
    console.log(`[UnitRenderer] updateUnit ${unit.id}:`);
    console.log(`  - Previous grid position:`, previousPosition);
    console.log(`  - Current grid position: (${unit.position.x}, ${unit.position.z})`);
    console.log(`  - Mesh ACTUAL position: (${meshCurrentPos.x.toFixed(2)}, ${meshCurrentPos.z.toFixed(2)})`);
    console.log(`  - From world position: (${fromPosObj.x.toFixed(2)}, ${fromPosObj.z.toFixed(2)})`);
    console.log(`  - To world position: (${worldPos.x.toFixed(2)}, ${worldPos.z.toFixed(2)})`);
    
    const willAnimate = fromPosObj.x !== worldPos.x || fromPosObj.z !== worldPos.z;
    console.log(`  - Will animate movement:`, willAnimate);
    
    // Calculate rotation based on movement direction
    const targetRotation = this.calculateRotationTowards(
      { x: fromPosObj.x, z: fromPosObj.z },
      { x: worldPos.x, z: worldPos.z }
    );
    
    // Animate rotation FIRST if there's a direction change
    if (targetRotation !== null) {
      this.animateRotation(mesh, targetRotation);
    }
    
    // Then animate movement
    this.animateMovement(mesh, worldPos, currentY);
    
    // Update visibility
    this.updateVisibility(mesh, unit.isAlive);
    
    // Update selection highlight
    this.updateSelectionHighlight(mesh, unit.id);
  }

  /**
   * Calculate initial rotation to face the center of the board
   * 
   * The gridToWorld function centers the board in world space:
   * - Grid (0,0) -> World (-4.5, -4.5) for a 10x10 grid
   * - Grid (9,9) -> World (4.5, 4.5)
   * - Board center in world coordinates is (0, 0)
   */
  private calculateInitialRotation(worldX: number, worldZ: number): number {
    // Board center in world coordinates (grid is centered by gridToWorld)
    const centerX = 0;
    const centerZ = 0;
    
    // Calculate direction from unit position to center
    const dx = centerX - worldX;
    const dz = centerZ - worldZ;
    
    // Calculate angle (atan2 returns angle in radians)
    // Add Math.PI because models face backward by default
    const angle = Math.atan2(dx, dz) + Math.PI;
    
    return angle;
  }

  /**
   * Apply initial rotation to the correct node (Rig for GLB models, root for fallbacks)
   * 
   * This method handles the critical difference between GLB models and fallback meshes:
   * - GLB models: Must rotate the Rig node (contains visible mesh hierarchy)
   * - Fallback capsules: Rotate the root mesh directly
   * 
   * @param mesh - The root mesh of the unit
   * @param rotation - Target rotation in radians (Y-axis)
   * @param unitId - Unit identifier for logging
   */
  private applyInitialRotation(mesh: AbstractMesh, rotation: number, unitId: string): void {
    // Find the Rig node (where the actual model is)
    // GLB models have structure: Root → Rig → Body parts
    const descendants = mesh.getDescendants(false);
    const rigNode = descendants.find(node => node.name.includes('Rig')) as TransformNode | undefined;
    const nodeToRotate = (rigNode || mesh) as TransformNode;
    
    // CRITICAL: GLB models use rotationQuaternion by default - convert to Euler angles
    // Without this conversion, setting rotation.y has NO EFFECT!
    if (nodeToRotate.rotationQuaternion) {
      console.log(`Converting ${nodeToRotate.name} from quaternion to Euler for initial rotation`);
      nodeToRotate.rotation = nodeToRotate.rotationQuaternion.toEulerAngles();
      nodeToRotate.rotationQuaternion = null;
    }
    
    // Apply rotation around Y-axis (vertical axis in Babylon.js)
    nodeToRotate.rotation.y = rotation;
    console.log(`${unitId} initial rotation: ${rotation.toFixed(2)} rad applied to ${nodeToRotate.name}`);
  }

  /**
   * Calculate rotation angle to face a target position (used during movement)
   * 
   * Uses atan2 to calculate the angle from current position to target position.
   * 
   * **Important**: We add Math.PI because the KayKit models face backward (-Z) by default.
   * In Babylon.js, +Z is forward, so we add 180° (π radians) to correct the orientation.
   * 
   * @param from - Starting world position {x, z}
   * @param to - Target world position {x, z}
   * @returns Rotation angle in radians, or null if no movement detected
   */
  private calculateRotationTowards(from: { x: number; z: number }, to: { x: number; z: number }): number | null {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    
    // If no movement (or movement below threshold), don't change rotation
    if (Math.abs(dx) < 0.01 && Math.abs(dz) < 0.01) {
      return null;
    }
    
    // Calculate angle using atan2 (returns angle in radians from -PI to PI)
    // atan2(dx, dz) gives us the angle in the XZ plane
    // Add Math.PI because models face backward (-Z direction) by default
    const angle = Math.atan2(dx, dz) + Math.PI;
    
    return angle;
  }

  /**
   * Animate unit movement
   */
  private animateMovement(mesh: AbstractMesh, targetPos: Vector3, currentY: number): void {
    const startPos = mesh.position.clone();
    const endPos = new Vector3(targetPos.x, currentY, targetPos.z);
    
    console.log(`[UnitRenderer] animateMovement for ${mesh.name}:`);
    console.log(`  - Start: (${startPos.x.toFixed(2)}, ${startPos.y.toFixed(2)}, ${startPos.z.toFixed(2)})`);
    console.log(`  - End: (${endPos.x.toFixed(2)}, ${endPos.y.toFixed(2)}, ${endPos.z.toFixed(2)})`);
    
    Animation.CreateAndStartAnimation(
      `unitMove_${mesh.name}`,
      mesh,
      'position',
      30,
      15,
      startPos,
      endPos,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
  }

  /**
   * Animate unit rotation with smooth transition (used during movement)
   * 
   * This method applies the same Rig node rotation logic as initial rotation,
   * but with smooth animation and shortest-path calculation.
   * 
   * Key features:
   * - Finds and rotates the Rig node (not root mesh)
   * - Converts quaternion to Euler angles (critical for GLB models)
   * - Normalizes angle difference for shortest rotation path
   * - Animates over 8 frames (~0.27s) for smooth visual transition
   * 
   * @param mesh - The root mesh of the unit
   * @param targetRotation - Target rotation in radians (Y-axis)
   */
  private animateRotation(mesh: AbstractMesh, targetRotation: number): void {
    // For GLB models with rigs, we need to find the actual rig node to rotate
    // The root mesh is often just a container, and the actual model is in a child node
    const descendants = mesh.getDescendants(false);
    const rigNode = descendants.find(node => node.name.includes('Rig')) as TransformNode | undefined;
    const nodeToRotate = (rigNode || mesh) as TransformNode;
    
    // CRITICAL: GLB models often use rotationQuaternion instead of rotation (Euler angles)
    // When rotationQuaternion is set, changing rotation.y has NO EFFECT!
    // We must convert to Euler angles first (same as in applyInitialRotation)
    if (nodeToRotate.rotationQuaternion) {
      console.log(`⚠️ ${nodeToRotate.name} has rotationQuaternion - converting to Euler angles`);
      nodeToRotate.rotation = nodeToRotate.rotationQuaternion.toEulerAngles();
      nodeToRotate.rotationQuaternion = null;
    }
    
    // Normalize angles to prevent spinning the long way
    // Example: rotating from 350° to 10° should go 20° forward, not 340° backward
    let currentRotation = nodeToRotate.rotation.y;
    let diff = targetRotation - currentRotation;
    
    // Normalize to [-PI, PI] for shortest path rotation
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    
    const normalizedTarget = currentRotation + diff;
    
    console.log(`Rotating ${nodeToRotate.name} from ${currentRotation.toFixed(2)} to ${normalizedTarget.toFixed(2)} (diff: ${diff.toFixed(2)})`);
    
    // Create smooth rotation animation
    Animation.CreateAndStartAnimation(
      `unitRotate_${nodeToRotate.name}`,
      nodeToRotate,
      'rotation.y',
      30, // frames per second
      8,  // total frames (duration) - 8 frames = ~0.27 seconds at 30fps
      currentRotation,
      normalizedTarget,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
  }

  /**
   * Update visibility for mesh and children
   */
  private updateVisibility(mesh: AbstractMesh, isAlive: boolean): void {
    mesh.isVisible = isAlive;
    if (!isAlive) {
      mesh.setEnabled(false);
    }
    
    const children = mesh.getChildMeshes(true);
    children.forEach(child => {
      child.isVisible = isAlive;
    });
  }

  /**
   * Update selection highlight
   */
  private updateSelectionHighlight(mesh: AbstractMesh, unitId: string): void {
    const isSelected = this.isUnitSelected(unitId);
    const children = mesh.getChildMeshes(true);
    
    if (isSelected) {
      // Cast to Mesh for HighlightLayer compatibility
      if (mesh instanceof Mesh) {
        this.highlightLayer.addMesh(mesh, Color3.Yellow());
      }
      children.forEach(child => {
        if (child instanceof Mesh) {
          this.highlightLayer.addMesh(child, Color3.Yellow());
        }
      });
    } else {
      if (mesh instanceof Mesh) {
        this.highlightLayer.removeMesh(mesh);
      }
      children.forEach(child => {
        if (child instanceof Mesh) {
          this.highlightLayer.removeMesh(child);
        }
      });
    }
  }

  /**
   * Check if a unit is currently selected
   */
  private isUnitSelected(unitId: string): boolean {
    // Import game state dynamically to avoid circular dependencies
    try {
      const { gameState } = require('../../game');
      return gameState.selectedUnit === unitId;
    } catch {
      return false;
    }
  }

  /**
   * Set mesh and children visibility
   */
  private setMeshVisibility(mesh: AbstractMesh, visible: boolean): void {
    mesh.setEnabled(visible);
    mesh.isVisible = visible;
    
    const children = mesh.getChildMeshes(true);
    const descendants = mesh.getDescendants(false);
    console.log(`${mesh.name} has ${children.length} child meshes, ${descendants.length} total descendants`);
    console.log(`Root mesh class: ${mesh.getClassName()}, has parent: ${mesh.parent !== null}`);
    
    // Log first few descendants to see structure
    descendants.slice(0, 5).forEach(desc => {
      console.log(`  - Descendant: ${desc.name}, class: ${desc.getClassName()}, parent: ${desc.parent?.name}`);
    });
    
    // Set visibility on all descendants
    descendants.forEach(node => {
      if ('isVisible' in node) {
        (node as any).isVisible = visible;
      }
      node.setEnabled(visible);
    });
  }

  /**
   * Enable shadows for mesh and children
   */
  private enableShadows(mesh: AbstractMesh): void {
    if (!this.shadowGenerator) return;
    
    mesh.getChildMeshes(true).forEach((childMesh) => {
      this.shadowGenerator!.addShadowCaster(childMesh);
    });
    this.shadowGenerator.addShadowCaster(mesh);
  }

  /**
   * Remove a unit mesh
   */
  public removeUnit(unitId: string): void {
    const mesh = this.unitMeshes.get(unitId);
    if (mesh) {
      if (mesh instanceof Mesh) {
        this.highlightLayer.removeMesh(mesh);
      }
      mesh.dispose();
      this.unitMeshes.delete(unitId);
    }
  }

  /**
   * Clear all unit meshes - both tracked and any orphaned ones
   */
  public clearAllUnits(): void {
    console.log(`[UnitRenderer] Clearing ${this.unitMeshes.size} tracked units`);
    
    // First, clear all tracked units
    this.unitMeshes.forEach((mesh, unitId) => {
      if (mesh instanceof Mesh) {
        this.highlightLayer.removeMesh(mesh);
      }
      if (mesh && !mesh.isDisposed()) {
        mesh.dispose();
      }
    });
    this.unitMeshes.clear();
    this.activeAnimations.clear();
    
    // Also find and dispose any orphaned unit meshes in the scene
    // This catches meshes that might have been missed
    // IMPORTANT: Don't dispose disabled meshes - they're cached templates for model cloning!
    const orphanedUnitMeshes = this.scene.meshes.filter(m => 
      m.name.startsWith('unit_') && m.isEnabled()  // Only dispose enabled unit_ meshes (not templates)
    );
    
    if (orphanedUnitMeshes.length > 0) {
      console.log(`[UnitRenderer] Found ${orphanedUnitMeshes.length} orphaned unit meshes, disposing...`);
      orphanedUnitMeshes.forEach(mesh => {
        if (!mesh.isDisposed()) {
          mesh.dispose();
        }
      });
    }
    
    console.log('[UnitRenderer] All units cleared');
  }

  /**
   * Get a unit's mesh
   */
  public getUnitMesh(unitId: string): AbstractMesh | undefined {
    return this.unitMeshes.get(unitId);
  }

  /**
   * Preload all character models (player and enemy)
   * 
   * Preloads:
   * - Player models: Knight, Mage, Ranger
   * - Enemy models: Skeleton Warrior, Skeleton Mage
   * - Enemy variant: Skeleton Rogue (loaded separately for Skeleton Archer)
   */
  public async preloadModels(): Promise<void> {
    const modelPaths = [
      ...Object.values(this.MODEL_PATHS),
      '/models/enemies/skeleton_rogue/skeleton_rogue.glb', // For Skeleton Archer variant
    ];
    
    try {
      await this.modelLoader.preloadModels(modelPaths);
      console.log('All character models (player + enemy) preloaded successfully');
    } catch (error) {
      console.error('Error preloading models:', error);
    }
  }
}

