import {
  Engine,
  Scene,
  ArcRotateCamera,
  Color4,
  HighlightLayer,
  GlowLayer,
} from '@babylonjs/core';
import '@babylonjs/loaders';
import { GridPosition, Tile, Unit } from '../types';

// Core modules
import { SceneSetup } from './setup/SceneSetup';
import { MaterialManager } from './managers/MaterialManager';
import { InputHandler } from './input/InputHandler';
import { DebugController } from './debug/DebugController';

// Renderers
import { ModelLoader } from './ModelLoader';
import { UnitRenderer } from './renderers/UnitRenderer';
import { GridRenderer } from './renderers/GridRenderer';
import { HighlightRenderer } from './renderers/HighlightRenderer';

/**
 * BabylonEngine - Main orchestrator for the 3D rendering engine
 * 
 * Responsibilities:
 * - Initialize and manage Babylon.js engine and scene
 * - Coordinate between modules (scene setup, materials, input, debug)
 * - Coordinate between renderers (grid, units, highlights)
 * - Provide public API for game logic
 * - Manage render loop and cleanup
 */
export class BabylonEngine {
  // Core Babylon.js instances
  private canvas: HTMLCanvasElement;
  private engine: Engine;
  private scene: Scene;
  private highlightLayer: HighlightLayer;
  private glowLayer: GlowLayer;
  
  // Modules
  private sceneSetup: SceneSetup;
  private materialManager: MaterialManager;
  private inputHandler: InputHandler;
  private debugController: DebugController;
  
  // Renderers
  private modelLoader: ModelLoader;
  private unitRenderer: UnitRenderer;
  private gridRenderer: GridRenderer;
  private highlightRenderer: HighlightRenderer;
  
  // Unit position tracking for rotation
  private unitPreviousPositions: Map<string, GridPosition> = new Map();
  
  // Loading state
  private isReady: boolean = false;
  private readyPromise: Promise<void>;
  
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    
    // Initialize engine and scene
    this.engine = new Engine(canvas, true, { 
      preserveDrawingBuffer: true, 
      stencil: true 
    });
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.1, 0.1, 0.15, 1);
    this.scene.shadowsEnabled = true; // Enable shadow rendering
    
    // Setup visual effects
    this.highlightLayer = new HighlightLayer('highlights', this.scene);
    this.glowLayer = new GlowLayer('glow', this.scene);
    this.glowLayer.intensity = 0.5;
    
    // Initialize modules
    this.sceneSetup = new SceneSetup(this.scene, canvas);
    this.materialManager = new MaterialManager(this.scene);
    this.inputHandler = new InputHandler(this.scene);
    
    // Initialize model loader and renderers
    this.modelLoader = new ModelLoader(this.scene);
    this.unitRenderer = new UnitRenderer(
      this.scene,
      this.modelLoader,
      this.sceneSetup.getShadowGenerator(),
      this.highlightLayer,
      this.materialManager.getMaterials()
    );
    this.gridRenderer = new GridRenderer(
      this.scene,
      this.materialManager.getMaterials(),
      this.modelLoader,
      this.sceneSetup.getShadowGenerator() // Pass ShadowGenerator to GridRenderer
    );
    this.highlightRenderer = new HighlightRenderer(
      this.scene,
      this.materialManager.getMaterials()
    );
    
    // Initialize debug controller (must be after unitRenderer)
    this.debugController = new DebugController(this.scene, this.unitRenderer);
    
    // Preload models asynchronously and track readiness
    this.readyPromise = this.preloadModels().then(() => {
      this.isReady = true;
      console.log('BabylonEngine is ready!');
    });
    
    // Handle window resize
    window.addEventListener('resize', () => {
      this.engine.resize();
    });
  }
  
  /**
   * Preload all models (characters and dungeon tiles)
   */
  private async preloadModels(): Promise<void> {
    console.log('Preloading all models...');
    await Promise.all([
      this.unitRenderer.preloadModels(),
      this.gridRenderer.preloadModels()
    ]);
    console.log('All models preloaded');
  }
  
  /**
   * Wait for the engine to be ready (all models preloaded)
   */
  public async waitForReady(): Promise<void> {
    await this.readyPromise;
  }
  
  /**
   * Check if the engine is ready
   */
  public getIsReady(): boolean {
    return this.isReady;
  }
  
  // ============================================
  // GRID API
  // ============================================
  
  public async createGrid(tileData: Record<string, Tile>, mapId: string | null = null): Promise<void> {
    await this.gridRenderer.createGrid(tileData, mapId);
  }
  
  // ============================================
  // UNIT API
  // ============================================
  
  public async createUnit(unit: Unit): Promise<void> {
    console.log(`[BabylonEngine] Creating unit ${unit.id} at (${unit.position.x}, ${unit.position.z})`);
    await this.unitRenderer.createUnit(unit);
    this.unitPreviousPositions.set(unit.id, { ...unit.position });
    console.log(`[BabylonEngine] Unit ${unit.id} created, tracked position: (${unit.position.x}, ${unit.position.z})`);
  }
  
  public updateUnit(unit: Unit): void {
    const previousPosition = this.unitPreviousPositions.get(unit.id);
    const currentPosition = unit.position;
    
    console.log(`[BabylonEngine] updateUnit ${unit.id}:`);
    console.log(`  - Previous tracked position:`, previousPosition);
    console.log(`  - Current unit position: (${currentPosition.x}, ${currentPosition.z})`);
    console.log(`  - Has mesh:`, this.unitRenderer.getUnitMesh(unit.id) !== undefined);
    
    // Check if position actually changed
    const posChanged = previousPosition && 
      (previousPosition.x !== currentPosition.x || previousPosition.z !== currentPosition.z);
    console.log(`  - Position changed:`, posChanged);
    
    this.unitRenderer.updateUnit(unit, previousPosition);
    this.unitPreviousPositions.set(unit.id, { ...unit.position });
    console.log(`  - Updated tracked position to: (${unit.position.x}, ${unit.position.z})`);
  }
  
  public removeUnit(unitId: string): void {
    this.unitRenderer.removeUnit(unitId);
    this.unitPreviousPositions.delete(unitId);
  }
  
  public hasUnit(unitId: string): boolean {
    return this.unitRenderer.getUnitMesh(unitId) !== undefined;
  }
  
  public clearAllUnits(): void {
    console.log('[BabylonEngine] Clearing all units and position tracking');
    this.unitRenderer.clearAllUnits();
    this.unitPreviousPositions.clear();
  }
  
  public clearAll(): void {
    console.log('[BabylonEngine] Clearing all game objects (units + grid + highlights)');
    this.clearAllUnits();
    this.gridRenderer.clearGrid();
    this.clearHighlights();
    this.clearPathPreview();
    
    // Nuclear cleanup: dispose remaining ENABLED game meshes
    // Keep essential meshes (lights, camera, background) AND disabled meshes (cached templates)
    const safePatterns = ['ground', 'BackgroundPlane', 'BackgroundHelper', 'light', 'camera', 'default'];
    const meshesToDispose = this.scene.meshes.filter(m => {
      // Skip disabled meshes - they're cached model templates
      if (!m.isEnabled()) return false;
      
      const nameLower = m.name.toLowerCase();
      return !safePatterns.some(pattern => nameLower.includes(pattern.toLowerCase()));
    });
    
    if (meshesToDispose.length > 0) {
      console.log('[BabylonEngine] Nuclear cleanup: disposing', meshesToDispose.length, 'remaining enabled meshes');
      console.log('[BabylonEngine] Meshes to dispose:', meshesToDispose.map(m => m.name));
      
      // Dispose in reverse order to handle parent-child relationships
      for (let i = meshesToDispose.length - 1; i >= 0; i--) {
        const mesh = meshesToDispose[i];
        if (mesh && !mesh.isDisposed()) {
          try {
            mesh.dispose(false, true); // Don't dispose materials/textures, do dispose children
          } catch (e) {
            console.warn('[BabylonEngine] Failed to dispose mesh:', mesh.name, e);
          }
        }
      }
    }
    
    console.log('[BabylonEngine] All game objects cleared, remaining scene meshes:', this.scene.meshes.length);
  }
  
  // ============================================
  // HIGHLIGHT API
  // ============================================
  
  public showMovementRange(positions: GridPosition[]): void {
    this.highlightRenderer.showMovementRange(positions);
  }
  
  public showTargetRange(positions: GridPosition[]): void {
    this.highlightRenderer.showTargetRange(positions);
  }
  
  public showPathPreview(path: GridPosition[]): void {
    this.highlightRenderer.showPathPreview(path);
  }
  
  public clearHighlights(): void {
    this.highlightRenderer.clearHighlights();
  }
  
  public clearPathPreview(): void {
    this.highlightRenderer.clearPathPreview();
  }
  
  /**
   * Définit la visibilité des unités ennemies
   * @param visible - true pour rendre visibles, false pour invisibles
   * @param enemyUnitIds - Liste des IDs des unités ennemies
   */
  public setEnemyVisibility(visible: boolean, enemyUnitIds: string[]): void {
    this.unitRenderer.setEnemyVisibility(visible, enemyUnitIds);
  }

  /**
   * Met à jour l'indicateur de ping pour montrer quelle unité doit jouer
   * @param unitId - ID de l'unité dont c'est le tour, ou null pour cacher le ping
   */
  public updateTurnIndicator(unitId: string | null): void {
    this.unitRenderer.updateTurnIndicator(unitId);
  }

  /**
   * Affiche les dégâts flottants au-dessus d'une unité
   * @param unitId - ID de l'unité qui prend les dégâts
   * @param damage - Montant des dégâts à afficher
   */
  public showDamageNumber(unitId: string, damage: number): void {
    this.unitRenderer.showDamageNumber(unitId, damage);
  }
  
  // ============================================
  // INPUT CALLBACKS
  // ============================================
  
  public setOnTileClick(callback: (pos: GridPosition) => void): void {
    this.inputHandler.setOnTileClick(callback);
  }
  
  public setOnTileHover(callback: (pos: GridPosition) => void): void {
    this.inputHandler.setOnTileHover(callback);
  }
  
  public setOnUnitClick(callback: (unitId: string) => void): void {
    this.inputHandler.setOnUnitClick(callback);
  }
  
  // ============================================
  // RENDER LOOP
  // ============================================
  
  public startRenderLoop(): void {
    this.engine.runRenderLoop(() => {
      this.scene.render();
    });
  }
  
  public stopRenderLoop(): void {
    this.engine.stopRenderLoop();
  }
  
  // ============================================
  // CLEANUP
  // ============================================
  
  public dispose(): void {
    this.stopRenderLoop();
    this.modelLoader.dispose();
    this.highlightRenderer.clearHighlights();
    this.highlightRenderer.clearPathPreview();
    this.scene.dispose();
    this.engine.dispose();
  }
  
  // ============================================
  // GETTERS
  // ============================================
  
  public getScene(): Scene {
    return this.scene;
  }
  
  public getEngine(): Engine {
    return this.engine;
  }
  
  public getCamera(): ArcRotateCamera {
    return this.sceneSetup.getCamera();
  }
  
  /**
   * Reset camera to default position and rotation
   */
  public resetCamera(): void {
    this.sceneSetup.resetCamera();
  }
}
