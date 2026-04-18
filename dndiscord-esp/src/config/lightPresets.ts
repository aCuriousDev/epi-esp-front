import { Color3 } from '@babylonjs/core';

export type LightPresetId = 'torch' | 'lantern' | 'magical_orb';
export type LightParticle = 'flame' | 'spark' | 'magic' | 'none';

export interface LightPreset {
  id: LightPresetId;
  label: string;
  /** Mesh to spawn visually at the light's position. */
  meshPath: string;
  /** Y offset from the mesh base where the PointLight is placed. */
  lightYOffset: number;
  lightColor: Color3;
  /**
   * PointLight.intensity. Babylon point/spot lights use candela-ish units,
   * and the Babylon official lantern tutorial ships lanterns at 30. Values
   * below ~10 are imperceptible against any ambient baseline.
   */
  intensity: number;
  /** Soft-edge radius of the light source itself (not falloff distance). */
  radius: number;
  /** Babylon PointLight.range — falloff distance in world units. */
  range: number;
  /** Sine-noise flicker applied at runtime if true. */
  flicker: boolean;
  particle: LightParticle;
  /**
   * Emissive tint applied to the fixture mesh so it reads as "lit" even
   * before the PointLight contributes. Picked up by the GlowLayer for
   * bloom. Usually matches lightColor at reduced saturation.
   */
  fixtureEmissive: Color3;
}

/**
 * Small, curated set of placeable light presets. The editor exposes these
 * as click-to-place tools; the runtime (LightManager) materializes each
 * into `mesh + PointLight + optional particle system` in one call.
 *
 * Intensity values follow Babylon's recommended lantern/torch scale
 * (official Babylon lantern tutorial uses intensity=30). Anything below
 * ~10 reads as "the scene is slightly warmer", not "there's a torch".
 */
export const LIGHT_PRESETS: Record<LightPresetId, LightPreset> = {
  torch: {
    id: 'torch',
    label: 'Torche',
    meshPath: '/assets/dungeon/torch_lit.gltf',
    lightYOffset: 0.8,
    lightColor: new Color3(1, 0.55, 0.2),
    intensity: 30,
    radius: 2,
    range: 7,
    flicker: true,
    particle: 'flame',
    fixtureEmissive: new Color3(0.9, 0.45, 0.1),
  },
  lantern: {
    id: 'lantern',
    label: 'Lanterne',
    meshPath: '/assets/halloween/lantern_standing.gltf',
    lightYOffset: 0.9,
    lightColor: new Color3(1, 0.78, 0.45),
    intensity: 24,
    radius: 2,
    range: 8,
    flicker: false,
    particle: 'spark',
    fixtureEmissive: new Color3(0.85, 0.65, 0.3),
  },
  magical_orb: {
    id: 'magical_orb',
    label: 'Orbe magique',
    meshPath: '/assets/dungeon/candle_triple.gltf',
    lightYOffset: 0.6,
    lightColor: new Color3(0.55, 0.4, 1),
    intensity: 28,
    radius: 1.5,
    range: 7,
    flicker: true,
    particle: 'magic',
    fixtureEmissive: new Color3(0.5, 0.35, 1),
  },
};

export const LIGHT_PRESET_IDS = Object.keys(LIGHT_PRESETS) as LightPresetId[];
