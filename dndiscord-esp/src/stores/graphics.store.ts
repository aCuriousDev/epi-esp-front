/**
 * Graphics Settings Store
 *
 * Reactive, localStorage-backed graphics configuration consumed by the 3D
 * engine. Mirrors the pattern used by sound.store.ts. The engine subscribes
 * to `graphicsSettings.*` via Solid `createEffect` and reflects every change
 * into the live Babylon pipeline.
 */

import { createSignal, createMemo } from 'solid-js';
import {
  QUALITY_PRESETS,
  DEFAULT_PRESET,
  type QualityPreset,
  type ShadowResolution,
  type HardwareScaling,
  type ParticleDensity,
  type EffectsToggles,
  type QualityValues,
} from '../engine/quality/QualityPresets';

const STORAGE_KEY = 'dnd-graphics-settings';

export interface DebugToggles {
  fpsMeter: boolean;
  wireframe: boolean;
  boundingBoxes: boolean;
  collisionCells: boolean;
}

export interface GraphicsSettingsSnapshot extends QualityValues {
  preset: QualityPreset;
  debug: DebugToggles;
}

const DEFAULT_DEBUG: DebugToggles = {
  fpsMeter: false,
  wireframe: false,
  boundingBoxes: false,
  collisionCells: false,
};

function defaults(): GraphicsSettingsSnapshot {
  const preset = DEFAULT_PRESET as Exclude<QualityPreset, 'custom'>;
  return {
    preset: DEFAULT_PRESET,
    ...QUALITY_PRESETS[preset],
    effects: { ...QUALITY_PRESETS[preset].effects },
    debug: { ...DEFAULT_DEBUG },
  };
}

function loadSettings(): GraphicsSettingsSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw) as Partial<GraphicsSettingsSnapshot>;
    const base = defaults();
    return {
      preset: parsed.preset ?? base.preset,
      shadowResolution: (parsed.shadowResolution ?? base.shadowResolution) as ShadowResolution,
      hardwareScaling: (parsed.hardwareScaling ?? base.hardwareScaling) as HardwareScaling,
      particleDensity: (parsed.particleDensity ?? base.particleDensity) as ParticleDensity,
      effects: { ...base.effects, ...(parsed.effects ?? {}) },
      debug: { ...base.debug, ...(parsed.debug ?? {}) },
    };
  } catch {
    return defaults();
  }
}

function saveSnapshot(snapshot: GraphicsSettingsSnapshot): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* ignore quota errors */
  }
}

const initial = loadSettings();

const [preset, setPresetRaw] = createSignal<QualityPreset>(initial.preset);
const [shadowResolution, setShadowResolutionRaw] = createSignal<ShadowResolution>(initial.shadowResolution);
const [hardwareScaling, setHardwareScalingRaw] = createSignal<HardwareScaling>(initial.hardwareScaling);
const [particleDensity, setParticleDensityRaw] = createSignal<ParticleDensity>(initial.particleDensity);
const [effects, setEffectsRaw] = createSignal<EffectsToggles>({ ...initial.effects });
const [debug, setDebugRaw] = createSignal<DebugToggles>({ ...initial.debug });

function snapshot(): GraphicsSettingsSnapshot {
  return {
    preset: preset(),
    shadowResolution: shadowResolution(),
    hardwareScaling: hardwareScaling(),
    particleDensity: particleDensity(),
    effects: effects(),
    debug: debug(),
  };
}

function persist() {
  saveSnapshot(snapshot());
}

/**
 * Apply a quality preset. This overwrites every tunable field so the
 * visual outcome always matches the preset. Pass 'custom' to do nothing
 * (used by the UI layer when reverting to saved custom values).
 */
export function setPreset(next: QualityPreset): void {
  setPresetRaw(next);
  if (next !== 'custom') {
    const values = QUALITY_PRESETS[next];
    setShadowResolutionRaw(values.shadowResolution);
    setHardwareScalingRaw(values.hardwareScaling);
    setParticleDensityRaw(values.particleDensity);
    setEffectsRaw({ ...values.effects });
  }
  persist();
}

function dropToCustomIfNeeded() {
  if (preset() !== 'custom') setPresetRaw('custom');
}

export function setShadowResolution(v: ShadowResolution): void {
  setShadowResolutionRaw(v);
  dropToCustomIfNeeded();
  persist();
}

export function setHardwareScaling(v: HardwareScaling): void {
  setHardwareScalingRaw(v);
  dropToCustomIfNeeded();
  persist();
}

export function setParticleDensity(v: ParticleDensity): void {
  setParticleDensityRaw(v);
  dropToCustomIfNeeded();
  persist();
}

export function setEffect<K extends keyof EffectsToggles>(key: K, value: EffectsToggles[K]): void {
  setEffectsRaw({ ...effects(), [key]: value });
  dropToCustomIfNeeded();
  persist();
}

export function setDebug<K extends keyof DebugToggles>(key: K, value: DebugToggles[K]): void {
  setDebugRaw({ ...debug(), [key]: value });
  persist();
}

export function resetGraphicsDefaults(): void {
  const d = defaults();
  setPresetRaw(d.preset);
  setShadowResolutionRaw(d.shadowResolution);
  setHardwareScalingRaw(d.hardwareScaling);
  setParticleDensityRaw(d.particleDensity);
  setEffectsRaw({ ...d.effects });
  setDebugRaw({ ...d.debug });
  persist();
}

// Consumers read these accessors directly inside createEffect to get full
// reactivity, or call graphicsSnapshot() for a one-shot read.
export const graphicsSettings = {
  preset,
  shadowResolution,
  hardwareScaling,
  particleDensity,
  effects,
  debug,
};

export const graphicsSnapshot = createMemo<GraphicsSettingsSnapshot>(() => snapshot());
