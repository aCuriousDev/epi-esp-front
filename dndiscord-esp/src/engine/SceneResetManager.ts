import type {
  Scene,
  Light,
  IParticleSystem,
  AbstractMesh,
} from '@babylonjs/core';
import type { ModelLoader } from './ModelLoader';
import type { VFXManager } from './vfx/VFXManager';

/**
 * Owns the per-map lifecycle on the 3D side. Anything created when a map
 * loads (cloned meshes, dynamically added lights, map-scoped particle
 * systems) should be handed to this manager via `trackMesh` / `trackLight`
 * / `trackParticles`. `resetForNewMap()` is then the single, deterministic
 * teardown step called before a new map loads.
 *
 * Templates (AssetContainers inside ModelLoader) and the base scene lights
 * are NOT tracked — they survive resets. Only map-scoped state is released.
 *
 * This replaces the old "nuclear cleanup" approach in BabylonEngine.clearAll
 * that filtered `scene.meshes` by name prefixes, which broke whenever new
 * prefixes were introduced.
 */
export class SceneResetManager {
  private scene: Scene;
  private modelLoader: ModelLoader;
  private vfxManager: VFXManager | null = null;

  private extraMeshes: Set<AbstractMesh> = new Set();
  private extraLights: Set<Light> = new Set();
  private extraParticles: Set<IParticleSystem> = new Set();

  constructor(scene: Scene, modelLoader: ModelLoader) {
    this.scene = scene;
    this.modelLoader = modelLoader;
  }

  /**
   * Late-binding the VFXManager avoids a circular construction dependency
   * (VFXManager needs the Scene; SceneResetManager needs VFXManager for
   * ambient pause/resume).
   */
  setVFXManager(vfx: VFXManager): void {
    this.vfxManager = vfx;
  }

  /**
   * Track a mesh that is NOT an instance owned by ModelLoader — e.g. a mesh
   * built directly with MeshBuilder as part of a map (grid borders,
   * teleport overlays, decorative planes).
   */
  trackMesh(mesh: AbstractMesh): void {
    this.extraMeshes.add(mesh);
  }

  trackLight(light: Light): void {
    this.extraLights.add(light);
  }

  trackParticles(system: IParticleSystem): void {
    this.extraParticles.add(system);
  }

  /**
   * Deterministic teardown of everything introduced for the current map.
   * Safe to call multiple times. Awaits a frame render to flush GPU state
   * so the next map loads against a clean framebuffer.
   */
  async resetForNewMap(): Promise<void> {
    // 1. Stop ambient VFX first — their emitters must not outlive the reset
    //    or we get the trail/ghost look across the transition.
    this.vfxManager?.pauseAmbient();

    // 2. Dispose tracked particle systems (map-scoped, not ambient).
    this.extraParticles.forEach((ps) => {
      try {
        ps.stop();
        ps.dispose();
      } catch (error) {
        console.warn('[SceneResetManager] Failed to dispose particle system:', error);
      }
    });
    this.extraParticles.clear();

    // 3. Dispose every instance the ModelLoader handed out. Templates stay.
    this.modelLoader.disposeAllInstances();

    // 4. Dispose extra meshes (non-instance helpers).
    this.extraMeshes.forEach((mesh) => {
      if (!mesh.isDisposed()) {
        try {
          mesh.dispose(false, true);
        } catch (error) {
          console.warn('[SceneResetManager] Failed to dispose mesh:', mesh.name, error);
        }
      }
    });
    this.extraMeshes.clear();

    // 5. Dispose map-scoped lights. Base scene lights are NOT tracked here.
    this.extraLights.forEach((light) => {
      try {
        light.dispose();
      } catch (error) {
        console.warn('[SceneResetManager] Failed to dispose light:', light.name, error);
      }
    });
    this.extraLights.clear();

    // 6. Render one frame against the cleared scene. This flushes the
    //    prior frame's GPU state so nothing from the old map appears as a
    //    ghost on the first frame of the new one.
    await this.renderOneFrame();
  }

  /**
   * After the new map is fully loaded, resume ambient VFX.
   */
  finishLoad(): void {
    this.vfxManager?.resumeAmbient();
  }

  private renderOneFrame(): Promise<void> {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        try {
          this.scene.render();
        } catch (error) {
          console.warn('[SceneResetManager] Render-frame during reset failed:', error);
        }
        resolve();
      });
    });
  }
}
