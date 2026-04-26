import {
  Scene,
  SceneLoader,
  AssetContainer,
  AbstractMesh,
  InstantiatedEntries,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';

/**
 * ModelLoader - Loads glTF/GLB assets into reusable AssetContainers and
 * instantiates per-use copies.
 *
 * Why AssetContainer (not SceneLoader.ImportMesh + clone):
 * - Templates live in an off-scene container. They are never rendered and
 *   cannot be accidentally disposed by scene cleanup passes.
 * - `instantiateModelsToScene(name, cloneMaterials=true)` gives each live
 *   instance its own root node, skeletons, and animation groups. Disposing an
 *   instance (e.g. when restarting a map) no longer risks corrupting the
 *   template it came from.
 *
 * Public surface kept compatible with the previous ModelLoader: callers still
 * call `loadModel(path, uniqueName)` and receive an `AbstractMesh`. Tracking
 * of skeletons and animation groups happens internally so `disposeInstance`
 * can release everything cleanly.
 */
export class ModelLoader {
  private scene: Scene;
  private containers: Map<string, AssetContainer> = new Map();
  private loadingPromises: Map<string, Promise<AssetContainer>> = new Map();
  private instanceEntries: Map<AbstractMesh, InstantiatedEntries> = new Map();

  constructor(scene: Scene) {
    this.scene = scene;
  }

  /**
   * Load a GLB/GLTF model and return a fresh, independent instance of it.
   *
   * @param modelPath - Absolute path served from the public/ folder.
   * @param uniqueName - Prefix applied to all nodes created for this instance.
   */
  async loadModel(modelPath: string, uniqueName: string): Promise<AbstractMesh> {
    const container = await this.getOrLoadContainer(modelPath);
    return this.instantiateRoot(container, uniqueName);
  }

  /**
   * Preload a set of models so later `loadModel` calls are synchronous.
   */
  async preloadModels(modelPaths: string[]): Promise<void> {
    await Promise.all(
      modelPaths.map(async (path) => {
        try {
          await this.getOrLoadContainer(path);
        } catch (error) {
          console.error(`[ModelLoader] Failed to preload ${path}:`, error);
        }
      })
    );
  }

  /**
   * Dispose a single instance (mesh hierarchy + its skeletons + animation groups).
   * Safe to call with a root returned by `loadModel`; no-op for unknown roots.
   */
  disposeInstance(root: AbstractMesh): void {
    const entries = this.instanceEntries.get(root);
    if (entries) {
      entries.animationGroups.forEach((ag) => ag.dispose());
      entries.skeletons.forEach((sk) => sk.dispose());
      entries.rootNodes.forEach((node) => {
        if (!node.isDisposed()) {
          node.dispose(false, true);
        }
      });
      this.instanceEntries.delete(root);
      return;
    }
    // Fallback: caller is managing lifetime manually.
    if (!root.isDisposed()) {
      root.dispose(false, true);
    }
  }

  /**
   * Dispose every live instance we created. Templates survive.
   * Called by SceneResetManager during map resets.
   */
  disposeAllInstances(): void {
    const roots = Array.from(this.instanceEntries.keys());
    roots.forEach((root) => this.disposeInstance(root));
  }

  /**
   * Drop cached AssetContainers (template geometry/materials). Call on full
   * engine teardown only — not on map resets.
   */
  clearCache(): void {
    this.disposeAllInstances();
    this.containers.forEach((container) => container.dispose());
    this.containers.clear();
  }

  dispose(): void {
    this.clearCache();
    this.loadingPromises.clear();
  }

  // -----------------------------------------------------------------
  // internals
  // -----------------------------------------------------------------

  private async getOrLoadContainer(modelPath: string): Promise<AssetContainer> {
    const cached = this.containers.get(modelPath);
    if (cached) return cached;

    const inFlight = this.loadingPromises.get(modelPath);
    if (inFlight) return inFlight;

    const promise = this.loadContainer(modelPath)
      .then((container) => {
        this.containers.set(modelPath, container);
        this.loadingPromises.delete(modelPath);
        return container;
      })
      .catch((error) => {
        this.loadingPromises.delete(modelPath);
        throw error;
      });

    this.loadingPromises.set(modelPath, promise);
    return promise;
  }

  private async loadContainer(modelPath: string): Promise<AssetContainer> {
    const lastSlash = modelPath.lastIndexOf('/');
    const rootUrl = modelPath.substring(0, lastSlash + 1);
    const filename = modelPath.substring(lastSlash + 1);

    const container = await SceneLoader.LoadAssetContainerAsync(
      rootUrl,
      filename,
      this.scene
    );
    return container;
  }

  private instantiateRoot(container: AssetContainer, uniqueName: string): AbstractMesh {
    const entries = container.instantiateModelsToScene(
      (name) => `${uniqueName}__${name}`,
      /* cloneMaterials */ true
    );
    if (entries.rootNodes.length === 0) {
      throw new Error(`[ModelLoader] Container produced no root nodes for ${uniqueName}`);
    }
    const root = entries.rootNodes[0] as AbstractMesh;
    this.instanceEntries.set(root, entries);
    return root;
  }
}
