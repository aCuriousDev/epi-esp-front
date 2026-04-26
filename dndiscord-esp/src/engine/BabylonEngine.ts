import {
  Engine,
  Scene,
  ArcRotateCamera,
  Color4,
  HighlightLayer,
  GlowLayer,
  Mesh,
  AbstractMesh,
} from '@babylonjs/core';
import '@babylonjs/loaders';
import { GridPosition, Tile, Unit, TileType } from '../types';
import { gridToWorld } from '../game';

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

// VFX & Post-processing
import { VFXManager, SpellVFXParams, ImpactVFXParams } from './vfx/VFXManager';
import { PostProcessingSetup } from './setup/PostProcessingSetup';
import { FpsOverlay } from './debug/FpsOverlay';

// Lifecycle & lights
import { SceneResetManager } from './SceneResetManager';
import { LightManager } from './managers/LightManager';
import { loadMap } from '../services/mapStorage';

// Reactive graphics settings
import { createRoot, createEffect } from 'solid-js';
import { graphicsSettings } from '../stores/graphics.store';

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
  
  // VFX & Post-processing
  private vfxManager: VFXManager;
  private postProcessing: PostProcessingSetup;
  private selectionPulseMesh: Mesh | null = null;

  // Lifecycle
  private sceneResetManager: SceneResetManager;
  private lightManager: LightManager;

  // Debug / metrics
  private fpsOverlay: FpsOverlay;

  // Dispose callback for the reactive settings subscription
  private graphicsSubscriptionDispose: (() => void) | null = null;
  
  // Unit position tracking for rotation
  private unitPreviousPositions: Map<string, GridPosition> = new Map();
  
  // Loading state
  private isReady: boolean = false;
  private readyPromise: Promise<void>;
  
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    
    // Initialize engine and scene.
    // preserveDrawingBuffer intentionally OFF — leaving it on keeps the prior
    // framebuffer around and causes visible ghost/trail artifacts on scene resets.
    this.engine = new Engine(canvas, true, {
      stencil: true,
    });
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.1, 0.1, 0.15, 1);
    this.scene.shadowsEnabled = true; // Enable shadow rendering
    
    // Setup visual effects
    this.highlightLayer = new HighlightLayer('highlights', this.scene);
    this.glowLayer = new GlowLayer('glow', this.scene);
    this.glowLayer.intensity = 0.8;
    this.glowLayer.blurKernelSize = 32;
    
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
    
    // Initialize VFX manager
    this.vfxManager = new VFXManager(this.scene, this.glowLayer);

    // Initialize scene-reset manager and bind VFX for ambient pause/resume
    this.sceneResetManager = new SceneResetManager(this.scene, this.modelLoader);
    this.sceneResetManager.setVFXManager(this.vfxManager);

    // Lights manager (torches/lanterns placed on saved maps)
    this.lightManager = new LightManager(this.scene, this.modelLoader, this.sceneResetManager);

    // Initialize debug controller (must be after unitRenderer)
    this.debugController = new DebugController(this.scene, this.unitRenderer);
    this.fpsOverlay = new FpsOverlay(this.engine, this.scene);
    
    // Initialize post-processing (after scene setup creates camera)
    this.postProcessing = new PostProcessingSetup(
      this.scene,
      this.sceneSetup.getCamera()
    );
    
    // Preload models asynchronously and track readiness
    this.readyPromise = this.preloadModels().then(() => {
      this.isReady = true;
      // Start ambient VFX. Respect the saved graphics setting — if ambient
      // particles are disabled in settings, don't start them.
      if (graphicsSettings.effects().ambientParticles) {
        this.vfxManager.startAmbientDust();
        this.vfxManager.startAmbientMagic();
      }
      console.log('BabylonEngine is ready!');
    });

    // Subscribe to graphics settings and reflect changes into the pipeline.
    this.subscribeToGraphicsSettings();

    // Handle window resize
    window.addEventListener('resize', () => {
      this.engine.resize();
    });
  }

  /**
   * Bind graphics.store signals to their engine-side effects. Uses
   * createRoot so we can tear the subscription down in dispose() without
   * relying on a component owner.
   */
  private subscribeToGraphicsSettings(): void {
    createRoot((dispose) => {
      this.graphicsSubscriptionDispose = dispose;

      createEffect(() => {
        this.engine.setHardwareScalingLevel(graphicsSettings.hardwareScaling());
      });

      createEffect(() => {
        const effects = graphicsSettings.effects();
        this.postProcessing.applyEffects(effects);
        this.glowLayer.isEnabled = effects.glow;
        this.sceneSetup.setShadowsEnabled(effects.shadows);
        this.scene.shadowsEnabled = effects.shadows;
        this.vfxManager.setAmbientEnabled(effects.ambientParticles);
      });

      createEffect(() => {
        this.sceneSetup.setShadowResolution(graphicsSettings.shadowResolution());
      });

      createEffect(() => {
        this.vfxManager.setAmbientDensity(graphicsSettings.particleDensity());
      });

      createEffect(() => {
        const debug = graphicsSettings.debug();
        if (debug.fpsMeter) this.fpsOverlay.show();
        else this.fpsOverlay.hide();
        this.debugController.setWireframe(debug.wireframe);
        this.debugController.setBoundingBoxes(debug.boundingBoxes);
        this.debugController.setCollisionCells(debug.collisionCells);
      });
    });
  }

  /**
   * Open the Babylon Inspector. Exposed so UI components (settings page)
   * can trigger it without simulating an F9 keystroke.
   */
  public showInspector(): void {
    this.debugController.showInspector();
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
    // Add torch effects near walls for ambiance
    this.addTorchesNearWalls(tileData);
    // Materialize saved user-placed lights for this map, if any.
    if (mapId) {
      const saved = loadMap(mapId);
      if (saved?.lights && saved.lights.length > 0) {
        await this.lightManager.materialize(saved.lights);
      }
    }
    // New map is on screen — resume ambient VFX that resetForNewMap paused.
    this.sceneResetManager.finishLoad();
  }

  /**
   * Automatically place torch particle effects near wall tiles
   */
  private addTorchesNearWalls(tileData: Record<string, Tile>): void {
    const wallPositions = Object.values(tileData)
      .filter(t => t.type === TileType.WALL);
    // Place torches on ~25% of walls for variety
    wallPositions.forEach((tile, i) => {
      if (i % 4 === 0) {
        const world = gridToWorld(tile.position);
        this.vfxManager.addTorchEffect(world.x, world.z);
      }
    });
  }
  
  // ============================================
  // UNIT API
  // ============================================
  
  public async createUnit(unit: Unit): Promise<void> {
    if (this.hasUnit(unit.id)) {
      console.warn(`[BabylonEngine] createUnit called for ${unit.id} but already exists — skipping`);
      return;
    }
    console.log(`[BabylonEngine] Creating unit ${unit.id} at (${unit.position.x}, ${unit.position.z})`);
    await this.unitRenderer.createUnit(unit);
    this.unitPreviousPositions.set(unit.id, { ...unit.position });
    
    // Add idle floating animation
    const mesh = this.unitRenderer.getUnitMesh(unit.id);
    if (mesh) {
      this.vfxManager.addIdleAnimation(mesh, unit.id);
    }
    
    console.log(`[BabylonEngine] Unit ${unit.id} created with idle VFX`);
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

  /** Every unit id the renderer currently has a mesh for. Used by the
   *  GameCanvas units effect to diff the store vs the engine and dispose
   *  meshes for units that were removed (e.g. Play Again cleared the store
   *  but the ghost skeleton mesh stuck around). */
  public getTrackedUnitIds(): string[] {
    return this.unitRenderer.getTrackedUnitIds();
  }
  
  public clearAllUnits(): void {
    console.log('[BabylonEngine] Clearing all units and position tracking');
    this.unitRenderer.clearAllUnits();
    this.unitPreviousPositions.clear();
  }
  
  /**
   * Deterministic reset of all map-scoped state. Safe to await before a
   * restart or map switch — templates in ModelLoader's AssetContainers
   * survive; only instances and map-owned extras are freed.
   */
  public async clearAll(): Promise<void> {
    console.log('[BabylonEngine] Resetting scene for new map');
    this.clearAllUnits();
    this.gridRenderer.clearGrid();
    this.clearHighlights();
    this.clearPathPreview();
    this.clearSelectionPulse();

    await this.sceneResetManager.resetForNewMap();

    console.log('[BabylonEngine] Scene reset complete, remaining meshes:', this.scene.meshes.length);
  }

  /**
   * Signal that a new map has finished loading. Resumes ambient VFX.
   */
  public finishMapLoad(): void {
    this.sceneResetManager.finishLoad();
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
  public async setEnemyVisibility(visible: boolean, enemyUnitIds: string[]): Promise<void> {
    await this.unitRenderer.setEnemyVisibility(visible, enemyUnitIds);
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
  // VFX API
  // ============================================
  
  /**
   * Play a spell VFX (fireball, ice shard, slash, etc.)
   */
  public async playSpellVFX(params: SpellVFXParams): Promise<void> {
    await this.vfxManager.playSpellVFX(params);
  }
  
  /**
   * Play an impact VFX at a position (damage sparks, heal glow, etc.)
   */
  public playImpactVFX(params: ImpactVFXParams): void {
    this.vfxManager.playImpactVFX(params);
  }
  
  /**
   * Play death VFX on a unit (fade + soul particles)
   */
  public async playDeathVFX(unitId: string, team: string): Promise<void> {
    const mesh = this.unitRenderer.getUnitMesh(unitId);
    if (mesh) {
      this.vfxManager.removeIdleAnimation(unitId, mesh);
      await this.vfxManager.playDeathVFX(mesh, team);
    }
  }

  /** DM revived a dead unit — upright the rig and restore idle animation so
   *  the body doesn't stay laid out on the tile. */
  public playReviveVFX(unitId: string): void {
    const mesh = this.unitRenderer.getUnitMesh(unitId);
    if (!mesh) return;
    this.vfxManager.playReviveVFX(mesh);
    this.vfxManager.addIdleAnimation(mesh, unitId);
  }
  
  /**
   * Show/hide selection pulse ring under a unit
   */
  public showSelectionPulse(position: GridPosition, team: string): void {
    this.clearSelectionPulse();
    this.selectionPulseMesh = this.vfxManager.createSelectionPulse(position, team);
  }
  
  public clearSelectionPulse(): void {
    if (this.selectionPulseMesh) {
      this.selectionPulseMesh.dispose();
      this.selectionPulseMesh = null;
    }
  }
  
  /**
   * Play turn start VFX burst
   */
  public playTurnStartVFX(unitPosition: GridPosition, team: string): void {
    this.vfxManager.playTurnStartVFX(unitPosition, team);
  }
  
  /**
   * Play hit reaction animation on a unit (knockback + squash)
   */
  public playHitReaction(unitId: string): void {
    const mesh = this.unitRenderer.getUnitMesh(unitId);
    if (mesh) {
      this.vfxManager.playHitReaction(mesh);
    }
  }
  
  /**
   * Play dust particles for unit movement
   */
  public playMovementDust(fromPos: GridPosition, toPos: GridPosition): void {
    const fromWorld = gridToWorld(fromPos);
    const toWorld = gridToWorld(toPos);
    this.vfxManager.playMovementDust(
      { x: fromWorld.x, z: fromWorld.z },
      { x: toWorld.x, z: toWorld.z }
    );
  }
  
  /**
   * Shake camera for dramatic impact
   */
  public shakeCamera(intensity?: number, durationMs?: number): void {
    this.vfxManager.shakeCamera(intensity, durationMs);
  }
  
  /**
   * Switch post-processing between combat and exploration modes
   */
  public setCombatMode(active: boolean): void {
    this.postProcessing.setCombatMode(active);
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
    if (this.graphicsSubscriptionDispose) {
      this.graphicsSubscriptionDispose();
      this.graphicsSubscriptionDispose = null;
    }
    this.fpsOverlay.dispose();
    this.lightManager.dispose();
    this.vfxManager.dispose();
    this.postProcessing.dispose();
    this.clearSelectionPulse();
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
