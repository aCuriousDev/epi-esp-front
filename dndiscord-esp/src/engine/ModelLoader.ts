import { Scene, SceneLoader, AbstractMesh, Mesh } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';

/**
 * ModelLoader - Handles loading and caching of 3D models
 */
export class ModelLoader {
  private scene: Scene;
  private modelCache: Map<string, AbstractMesh[]> = new Map();
  private loadingPromises: Map<string, Promise<AbstractMesh[]>> = new Map();

  constructor(scene: Scene) {
    this.scene = scene;
  }

  /**
   * Load a GLB model from the given path
   * @param modelPath - Path to the GLB file (e.g., '/src/assets/models/characters/knight/knight.glb')
   * @param uniqueName - Unique identifier for this instance
   * @returns Promise that resolves to the root mesh of the loaded model
   */
  async loadModel(modelPath: string, uniqueName: string): Promise<AbstractMesh> {
    try {
      // Check if model is already cached
      if (this.modelCache.has(modelPath)) {
        return this.cloneFromCache(modelPath, uniqueName);
      }

      // Check if model is currently being loaded
      if (this.loadingPromises.has(modelPath)) {
        await this.loadingPromises.get(modelPath);
        return this.cloneFromCache(modelPath, uniqueName);
      }

      // Load the model
      const loadPromise = this.loadModelInternal(modelPath);
      this.loadingPromises.set(modelPath, loadPromise);

      const meshes = await loadPromise;
      
      // Cache the loaded meshes
      this.modelCache.set(modelPath, meshes);
      this.loadingPromises.delete(modelPath);

      // Return a clone for this instance
      return this.cloneFromCache(modelPath, uniqueName);
    } catch (error) {
      console.error(`Failed to load model from ${modelPath}:`, error);
      this.loadingPromises.delete(modelPath);
      throw error;
    }
  }

  /**
   * Internal method to load model from file
   */
  private async loadModelInternal(modelPath: string): Promise<AbstractMesh[]> {
    return new Promise((resolve, reject) => {
      // Extract directory and filename from path
      const lastSlash = modelPath.lastIndexOf('/');
      const rootUrl = modelPath.substring(0, lastSlash + 1);
      const filename = modelPath.substring(lastSlash + 1);

      console.log(`Loading model from: ${rootUrl}${filename}`);

      SceneLoader.ImportMesh(
        '',
        rootUrl,
        filename,
        this.scene,
        (meshes) => {
          console.log(`Successfully loaded ${meshes.length} meshes from ${filename}`);
          // Hide original meshes (they will be used as templates)
          meshes.forEach((mesh) => {
            mesh.isVisible = false;
            mesh.setEnabled(false);
          });
          resolve(meshes);
        },
        undefined,
        (scene, message, exception) => {
          console.error(`Model loading error for ${modelPath}: ${message}`, exception);
          reject(new Error(`Model loading error: ${message}`));
        }
      );
    });
  }

  /**
   * Clone a model from cache
   */
  private cloneFromCache(modelPath: string, uniqueName: string): AbstractMesh {
    const cachedMeshes = this.modelCache.get(modelPath);
    if (!cachedMeshes || cachedMeshes.length === 0) {
      throw new Error(`No cached model found for ${modelPath}`);
    }

    // Find the root mesh from the cached model
    const rootMesh = cachedMeshes.find(m => !m.parent) || cachedMeshes[0];
    
    // Clone the entire hierarchy (doNotCloneChildren = false to clone children)
    const clonedRoot = rootMesh.clone(uniqueName, null, false);
    
    if (!clonedRoot) {
      throw new Error(`Failed to clone model for ${uniqueName}`);
    }
    
    // Make root and all children visible and enabled
    clonedRoot.isVisible = true;
    clonedRoot.setEnabled(true);
    
    const allDescendants = clonedRoot.getDescendants(false);
    allDescendants.forEach((node) => {
      if ('isVisible' in node) {
        (node as any).isVisible = true;
      }
      node.setEnabled(true);
    });

    console.log(`Cloned ${uniqueName}: root + ${allDescendants.length} descendants`);
    
    return clonedRoot as AbstractMesh;
  }

  /**
   * Preload models to avoid loading delays during gameplay
   */
  async preloadModels(modelPaths: string[]): Promise<void> {
    const promises = modelPaths.map(path => {
      return this.loadModelInternal(path)
        .then(meshes => {
          this.modelCache.set(path, meshes);
        })
        .catch(error => {
          console.error(`Failed to preload model ${path}:`, error);
        });
    });

    await Promise.all(promises);
  }

  /**
   * Clear all cached models
   */
  clearCache(): void {
    this.modelCache.forEach((meshes) => {
      meshes.forEach(mesh => mesh.dispose());
    });
    this.modelCache.clear();
  }

  /**
   * Dispose of the model loader
   */
  dispose(): void {
    this.clearCache();
    this.loadingPromises.clear();
  }
}

