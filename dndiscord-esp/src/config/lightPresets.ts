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
  intensity: number;
  /** Babylon PointLight.range — how far the light reaches. */
  range: number;
  /** Sine-noise flicker applied at runtime if true. */
  flicker: boolean;
  particle: LightParticle;
}

/**
 * Small, curated set of placeable light presets. The editor exposes these
 * as click-to-place tools; the runtime (LightManager) materializes each
 * into `mesh + PointLight + optional particle system` in one call.
 */
export const LIGHT_PRESETS: Record<LightPresetId, LightPreset> = {
  torch: {
    id: 'torch',
    label: 'Torche',
    meshPath: '/assets/dungeon/torch_lit.gltf',
    lightYOffset: 0.8,
    lightColor: new Color3(1, 0.55, 0.2),
    intensity: 0.9,
    range: 4.5,
    flicker: true,
    particle: 'flame',
  },
  lantern: {
    id: 'lantern',
    label: 'Lanterne',
    meshPath: '/assets/halloween/lantern_standing.gltf',
    lightYOffset: 0.9,
    lightColor: new Color3(1, 0.78, 0.45),
    intensity: 0.7,
    range: 5,
    flicker: false,
    particle: 'spark',
  },
  magical_orb: {
    id: 'magical_orb',
    label: 'Orbe magique',
    meshPath: '/assets/dungeon/candle_triple.gltf',
    lightYOffset: 0.6,
    lightColor: new Color3(0.55, 0.4, 1),
    intensity: 1.0,
    range: 5,
    flicker: true,
    particle: 'magic',
  },
};

export const LIGHT_PRESET_IDS = Object.keys(LIGHT_PRESETS) as LightPresetId[];
