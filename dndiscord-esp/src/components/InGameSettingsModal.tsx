import { Component, Show, For } from 'solid-js';
import { X, Volume2, Gamepad2, Sparkles, Gauge, Sliders, Bug, ExternalLink } from 'lucide-solid';
import {
  soundSettings,
  setSfxEnabled,
  setMusicEnabled,
} from '../stores/sound.store';
import {
  graphicsSettings,
  setPreset,
  setEffect,
  setDebug,
  resetGraphicsDefaults,
} from '../stores/graphics.store';
import type {
  QualityPreset,
  EffectsToggles,
} from '../engine/quality/QualityPresets';

/**
 * Mid-game settings overlay — a subset of SettingsPage's controls that
 * apply live without leaving the board.
 *
 * Design decisions:
 * - A modal (fixed inset-0) rather than a route, so navigating away
 *   from /board doesn't dispose the BabylonEngine and lose combat
 *   state. Opening is the common case; full settings remain available
 *   via a link that opens in a new tab.
 * - Only the signals matter — the engine already subscribes to
 *   graphics.store inside BabylonEngine.subscribeToGraphicsSettings,
 *   so every toggle applies within one frame without extra wiring.
 * - Stops pointer events from bubbling so clicks inside the modal
 *   don't reach the 3D canvas below.
 */

const PRESETS: { id: QualityPreset; label: string }[] = [
  { id: 'low', label: 'Bas' },
  { id: 'medium', label: 'Moyen' },
  { id: 'high', label: 'Élevé' },
  { id: 'ultra', label: 'Ultra' },
];

const EFFECT_ITEMS: { key: keyof EffectsToggles; label: string }[] = [
  { key: 'bloom', label: 'Bloom' },
  { key: 'fxaa', label: 'FXAA' },
  { key: 'vignette', label: 'Vignette' },
  { key: 'chromaticAberration', label: 'Aberration' },
  { key: 'glow', label: 'Glow' },
  { key: 'ambientParticles', label: 'Particules' },
  { key: 'shadows', label: 'Ombres' },
];

export const InGameSettingsModal: Component<{ onClose: () => void }> = (props) => {
  return (
    <div
      class="fixed inset-0 z-50 flex items-start justify-center bg-black/55 backdrop-blur-sm p-4 pt-[8vh] overflow-y-auto"
      onClick={props.onClose}
    >
      <div
        class="w-full max-w-md bg-game-darker border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div class="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-gradient-to-r from-brandStart/70 to-brandEnd/70">
          <h2 class="font-display text-white text-base tracking-wide">
            Paramètres rapides
          </h2>
          <button
            class="text-white/80 hover:text-white p-1 rounded"
            onClick={props.onClose}
            aria-label="Fermer"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="p-5 space-y-5">
          {/* Audio */}
          <section>
            <h3 class="text-sm font-semibold text-game-gold mb-2 flex items-center gap-2">
              <Volume2 class="w-4 h-4" />
              Audio
            </h3>
            <div class="space-y-2">
              <label class="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer">
                <span class="text-sm text-slate-200 flex items-center gap-2">
                  <Volume2 class="w-4 h-4 text-slate-400" />
                  Effets sonores
                </span>
                <input
                  type="checkbox"
                  class="accent-game-gold"
                  checked={soundSettings.sfxEnabled()}
                  onChange={(e) => setSfxEnabled(e.currentTarget.checked)}
                />
              </label>
              <label class="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer">
                <span class="text-sm text-slate-200 flex items-center gap-2">
                  <Gamepad2 class="w-4 h-4 text-slate-400" />
                  Musique
                </span>
                <input
                  type="checkbox"
                  class="accent-game-gold"
                  checked={soundSettings.musicEnabled()}
                  onChange={(e) => setMusicEnabled(e.currentTarget.checked)}
                />
              </label>
            </div>
          </section>

          {/* Graphics preset */}
          <section>
            <h3 class="text-sm font-semibold text-pink-300 mb-2 flex items-center gap-2">
              <Gauge class="w-4 h-4" />
              Qualité graphique
            </h3>
            <div class="grid grid-cols-4 gap-1 bg-black/40 rounded-lg p-1">
              <For each={PRESETS}>
                {(p) => (
                  <button
                    onClick={() => setPreset(p.id)}
                    class={`px-2 py-1.5 rounded-md text-xs transition-colors ${
                      graphicsSettings.preset() === p.id
                        ? 'bg-pink-600 text-white'
                        : 'text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {p.label}
                  </button>
                )}
              </For>
            </div>
          </section>

          {/* Effects toggles */}
          <section>
            <h3 class="text-sm font-semibold text-pink-300 mb-2 flex items-center gap-2">
              <Sliders class="w-4 h-4" />
              Effets visuels
            </h3>
            <div class="grid grid-cols-2 gap-2">
              <For each={EFFECT_ITEMS}>
                {(e) => (
                  <label class="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer">
                    <span class="text-slate-200 text-sm">{e.label}</span>
                    <input
                      type="checkbox"
                      class="accent-pink-500"
                      checked={graphicsSettings.effects()[e.key]}
                      onChange={(ev) =>
                        setEffect(e.key, ev.currentTarget.checked)
                      }
                    />
                  </label>
                )}
              </For>
            </div>
          </section>

          {/* Debug quick toggles */}
          <section>
            <h3 class="text-sm font-semibold text-amber-300 mb-2 flex items-center gap-2">
              <Bug class="w-4 h-4" />
              Debug
            </h3>
            <div class="grid grid-cols-2 gap-2">
              <label class="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer">
                <span class="text-slate-200 text-sm">FPS</span>
                <input
                  type="checkbox"
                  class="accent-amber-400"
                  checked={graphicsSettings.debug().fpsMeter}
                  onChange={(e) => setDebug('fpsMeter', e.currentTarget.checked)}
                />
              </label>
              <label class="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer">
                <span class="text-slate-200 text-sm">Wireframe</span>
                <input
                  type="checkbox"
                  class="accent-amber-400"
                  checked={graphicsSettings.debug().wireframe}
                  onChange={(e) => setDebug('wireframe', e.currentTarget.checked)}
                />
              </label>
            </div>
          </section>

          <div class="flex items-center gap-2 pt-2">
            <button
              onClick={resetGraphicsDefaults}
              class="flex-1 px-3 py-2 text-sm rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200"
            >
              Réinitialiser
            </button>
            <a
              href="/settings"
              target="_blank"
              rel="noopener noreferrer"
              class="flex-1 px-3 py-2 text-sm rounded-lg bg-pink-600/20 hover:bg-pink-600/30 border border-pink-500/40 text-pink-200 flex items-center justify-center gap-2"
              title="Ouvre la page complète dans un nouvel onglet pour ne pas interrompre la partie"
            >
              Tous les paramètres
              <ExternalLink class="w-3.5 h-3.5" />
            </a>
          </div>

          <Show when={graphicsSettings.preset() === 'custom'}>
            <p class="text-xs text-slate-400 text-center italic">
              Réglages personnalisés actifs
            </p>
          </Show>
        </div>
      </div>
    </div>
  );
};
