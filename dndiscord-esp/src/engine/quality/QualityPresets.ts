/**
 * Quality Presets - concrete numeric values for each preset level.
 *
 * Changing a preset in the Graphics settings tab overwrites every tunable
 * field with the values defined here. Any subsequent manual toggle moves
 * the settings into 'custom' mode so they don't get silently re-overwritten
 * next time the preset reactor runs.
 */

export type QualityPreset = 'low' | 'medium' | 'high' | 'ultra' | 'custom';

export type ShadowResolution = 512 | 1024 | 2048 | 4096;
export type HardwareScaling = 0.5 | 0.75 | 1.0 | 1.5;
export type ParticleDensity = 0 | 0.5 | 1.0 | 1.5;

export interface EffectsToggles {
  bloom: boolean;
  fxaa: boolean;
  vignette: boolean;
  chromaticAberration: boolean;
  glow: boolean;
  ambientParticles: boolean;
  shadows: boolean;
}

export interface QualityValues {
  shadowResolution: ShadowResolution;
  hardwareScaling: HardwareScaling;
  particleDensity: ParticleDensity;
  effects: EffectsToggles;
}

export const QUALITY_PRESETS: Record<Exclude<QualityPreset, 'custom'>, QualityValues> = {
  low: {
    shadowResolution: 512,
    hardwareScaling: 1.5,
    particleDensity: 0.5,
    effects: {
      bloom: false,
      fxaa: true,
      vignette: true,
      chromaticAberration: false,
      glow: false,
      ambientParticles: false,
      shadows: false,
    },
  },
  medium: {
    shadowResolution: 1024,
    hardwareScaling: 1.0,
    particleDensity: 1.0,
    effects: {
      bloom: true,
      fxaa: true,
      vignette: true,
      chromaticAberration: false,
      glow: true,
      ambientParticles: true,
      shadows: true,
    },
  },
  high: {
    shadowResolution: 2048,
    hardwareScaling: 0.75,
    particleDensity: 1.0,
    effects: {
      bloom: true,
      fxaa: true,
      vignette: true,
      chromaticAberration: true,
      glow: true,
      ambientParticles: true,
      shadows: true,
    },
  },
  ultra: {
    shadowResolution: 4096,
    hardwareScaling: 0.5,
    particleDensity: 1.5,
    effects: {
      bloom: true,
      fxaa: true,
      vignette: true,
      chromaticAberration: true,
      glow: true,
      ambientParticles: true,
      shadows: true,
    },
  },
};

export const DEFAULT_PRESET: QualityPreset = 'medium';
