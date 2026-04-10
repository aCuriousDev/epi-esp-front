/**
 * Sound Settings Store
 * 
 * Reactive store for audio settings, persisted in localStorage.
 * Used by SettingsPage and SoundIntegration.
 */

import { createSignal } from 'solid-js';

const STORAGE_KEY = 'dnd-sound-settings';

interface SoundSettings {
  musicEnabled: boolean;
  sfxEnabled: boolean;
  musicVolume: number;
  sfxVolume: number;
}

function loadSettings(): SoundSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { musicEnabled: true, sfxEnabled: true, musicVolume: 0.3, sfxVolume: 0.5 };
}

function saveSettings(s: SoundSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

const initial = loadSettings();

const [musicEnabled, setMusicEnabledRaw] = createSignal(initial.musicEnabled);
const [sfxEnabled, setSfxEnabledRaw] = createSignal(initial.sfxEnabled);
const [musicVolume, setMusicVolumeRaw] = createSignal(initial.musicVolume);
const [sfxVolume, setSfxVolumeRaw] = createSignal(initial.sfxVolume);

function persist() {
  saveSettings({
    musicEnabled: musicEnabled(),
    sfxEnabled: sfxEnabled(),
    musicVolume: musicVolume(),
    sfxVolume: sfxVolume(),
  });
}

export function setMusicEnabled(v: boolean) { setMusicEnabledRaw(v); persist(); }
export function setSfxEnabled(v: boolean) { setSfxEnabledRaw(v); persist(); }
export function setMusicVolume(v: number) { setMusicVolumeRaw(v); persist(); }
export function setSfxVolume(v: number) { setSfxVolumeRaw(v); persist(); }

export const soundSettings = {
  musicEnabled,
  sfxEnabled,
  musicVolume,
  sfxVolume,
};
