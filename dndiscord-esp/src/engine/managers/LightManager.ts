import {
  Scene,
  PointLight,
  Vector3,
  Color3,
  Color4,
  ParticleSystem,
  Texture,
  Observer,
  Nullable,
  AbstractMesh,
  StandardMaterial,
  PBRMaterial,
} from '@babylonjs/core';
import type { ModelLoader } from '../ModelLoader';
import type { SceneResetManager } from '../SceneResetManager';
import type { SavedLightData } from '../../services/mapStorage';
import { LIGHT_PRESETS, type LightPreset } from '../../config/lightPresets';
import { gridToWorld } from '../../game';

interface LiveLight {
  pointLight: PointLight;
  particle: ParticleSystem | null;
  baseIntensity: number;
  flickerObserver: Nullable<Observer<Scene>>;
}

/**
 * Materializes `SavedLightData[]` into the scene:
 *  - a glTF mesh for the fixture (via ModelLoader — so instances are
 *    tracked and disposed cleanly on map reset)
 *  - a PointLight with preset color/intensity/range (tracked by
 *    SceneResetManager so it's freed on reset)
 *  - an optional particle system (flame / spark / magic)
 *  - an optional flicker observer (sine-noise on intensity)
 */
export class LightManager {
  private scene: Scene;
  private modelLoader: ModelLoader;
  private sceneReset: SceneResetManager;
  private flareTexture: Texture;
  private live: LiveLight[] = [];

  constructor(scene: Scene, modelLoader: ModelLoader, sceneReset: SceneResetManager) {
    this.scene = scene;
    this.modelLoader = modelLoader;
    this.sceneReset = sceneReset;
    this.flareTexture = this.createFlareTexture();
  }

  async materialize(lights: SavedLightData[]): Promise<void> {
    this.clearLive();
    for (let i = 0; i < lights.length; i++) {
      await this.spawnLight(lights[i], i);
    }
  }

  private async spawnLight(data: SavedLightData, index: number): Promise<void> {
    const preset = LIGHT_PRESETS[data.presetId];
    if (!preset) {
      console.warn(`[LightManager] Unknown preset: ${data.presetId}`);
      return;
    }

    const world = gridToWorld({ x: data.x, z: data.z });
    const yBase = data.y ?? 0;
    const position = new Vector3(world.x, yBase, world.z);

    // Visual fixture mesh (torch/lantern etc). Tracked by ModelLoader so
    // disposeAllInstances() cleans it up on reset.
    try {
      const mesh = await this.modelLoader.loadModel(
        preset.meshPath,
        `light_${data.presetId}_${index}_${data.x}_${data.z}`
      );
      mesh.position.copyFrom(position);
      mesh.scaling.setAll(0.5);
      // Emissive tint — fixtures look lit even when the PointLight is
      // occluded. Picked up by the scene's GlowLayer for bloom.
      const tint = (m: AbstractMesh) => {
        const mat = m.material;
        if (mat instanceof StandardMaterial) {
          mat.emissiveColor = preset.fixtureEmissive.clone();
        } else if (mat instanceof PBRMaterial) {
          mat.emissiveColor = preset.fixtureEmissive.clone();
          mat.emissiveIntensity = 1.5;
        }
        m.getChildMeshes().forEach(tint);
      };
      tint(mesh);
    } catch (error) {
      console.warn(`[LightManager] Mesh load failed for ${preset.meshPath}:`, error);
    }

    // PointLight — the real light source.
    const pointLight = new PointLight(
      `point_${preset.id}_${data.x}_${data.z}_${index}`,
      position.add(new Vector3(0, preset.lightYOffset, 0)),
      this.scene
    );
    const color = data.colorOverride
      ? new Color3(data.colorOverride[0], data.colorOverride[1], data.colorOverride[2])
      : preset.lightColor;
    const intensity = data.intensityOverride ?? preset.intensity;
    pointLight.diffuse = color;
    pointLight.specular = color;
    pointLight.intensity = intensity;
    pointLight.radius = preset.radius;
    pointLight.range = preset.range;
    this.sceneReset.trackLight(pointLight);

    // Particle fx
    const particle = this.buildParticle(preset, pointLight.position);
    if (particle) {
      this.sceneReset.trackParticles(particle);
    }

    // Flicker — applied via onBeforeRenderObservable. Observer is tracked
    // locally so we can detach it at clearLive() time even though the
    // PointLight itself is disposed by SceneResetManager.
    let flickerObserver: Nullable<Observer<Scene>> = null;
    if (preset.flicker) {
      const baseIntensity = intensity;
      const phase = Math.random() * Math.PI * 2;
      flickerObserver = this.scene.onBeforeRenderObservable.add(() => {
        if (pointLight.isDisposed()) return;
        const t = performance.now() * 0.004 + phase;
        const noise = Math.sin(t) * 0.12 + Math.sin(t * 2.7) * 0.06;
        pointLight.intensity = Math.max(0.1, baseIntensity * (1 + noise));
      });
    }

    this.live.push({ pointLight, particle, baseIntensity: intensity, flickerObserver });
  }

  private buildParticle(preset: LightPreset, origin: Vector3): ParticleSystem | null {
    if (preset.particle === 'none') return null;

    const system = new ParticleSystem(`light_particle_${preset.id}_${this.live.length}`, 60, this.scene);
    system.particleTexture = this.flareTexture;
    system.emitter = origin.clone();
    system.minSize = 0.04;
    system.maxSize = 0.11;
    system.minLifeTime = 0.3;
    system.maxLifeTime = 0.9;
    system.emitRate = 22;
    system.direction1 = new Vector3(-0.1, 0.6, -0.1);
    system.direction2 = new Vector3(0.1, 1.2, 0.1);
    system.gravity = new Vector3(0, 0.4, 0);

    switch (preset.particle) {
      case 'flame':
        system.color1 = new Color4(1, 0.72, 0.2, 1);
        system.color2 = new Color4(1, 0.4, 0, 0.8);
        system.colorDead = new Color4(0.3, 0.1, 0, 0);
        break;
      case 'spark':
        system.color1 = new Color4(1, 0.9, 0.6, 0.9);
        system.color2 = new Color4(1, 0.8, 0.4, 0.6);
        system.colorDead = new Color4(0.2, 0.15, 0.05, 0);
        system.emitRate = 10;
        system.minLifeTime = 0.15;
        system.maxLifeTime = 0.4;
        break;
      case 'magic':
        system.color1 = new Color4(0.6, 0.4, 1, 0.9);
        system.color2 = new Color4(0.4, 0.2, 1, 0.7);
        system.colorDead = new Color4(0.2, 0.1, 0.6, 0);
        system.gravity = new Vector3(0, 0.15, 0);
        break;
    }
    system.addSizeGradient(0, 0.08);
    system.addSizeGradient(0.5, 0.06);
    system.addSizeGradient(1, 0);
    system.start();
    return system;
  }

  private clearLive(): void {
    this.live.forEach((entry) => {
      if (entry.flickerObserver) {
        this.scene.onBeforeRenderObservable.remove(entry.flickerObserver);
      }
    });
    this.live = [];
  }

  dispose(): void {
    this.clearLive();
    if (this.flareTexture) {
      this.flareTexture.dispose();
    }
  }

  /**
   * Procedural radial-gradient particle texture. Avoids shipping an extra
   * PNG and stays inside the Discord Activity CSP (no external flare.png).
   */
  private createFlareTexture(): Texture {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.6)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const dataUrl = canvas.toDataURL('image/png');
    return new Texture(dataUrl, this.scene, true, false);
  }
}
