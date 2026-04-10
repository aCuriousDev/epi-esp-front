import { Component } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { GameMode } from '../types';
import { ArrowLeft } from 'lucide-solid';

interface ModeSelectionScreenProps {
  onSelectMode: (mode: GameMode) => void;
  onSelectMultiplayer?: () => void;
}

export const ModeSelectionScreen: Component<ModeSelectionScreenProps> = (props) => {
  const navigate = useNavigate();

  return (
    <div class="relative min-h-screen w-full overflow-hidden bg-brand-gradient">
      {/* Vignette overlay */}
      <div class="vignette absolute inset-0" />

      {/* Back button */}
      <button
        onClick={() => navigate("/")}
        class="settings-btn !fixed !top-4 !left-4 !right-auto"
        aria-label="Retour au menu"
      >
        <ArrowLeft class="w-5 h-5 text-white" />
      </button>

      {/* Main content */}
      <main class="relative z-10 flex min-h-screen items-center justify-center p-6 sm:p-10">
        <div class="max-w-6xl w-full">
          {/* Title */}
          <header class="text-center mb-10">
            <h1 class="font-display text-5xl sm:text-6xl tracking-wide text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
              Choisissez votre mode
            </h1>
            <p class="mt-4 text-slate-100/90 max-w-xl mx-auto">
              Explorez le système de combat tactique ou affrontez des ennemis.
            </p>
            <div class="mt-6 mx-auto decorative-divider" />
          </header>

          {/* Mode Cards */}
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {/* Free Roam Mode */}
            <button
              class="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-brandStart/80 to-brandEnd/80 backdrop-blur-sm p-8 transition-all duration-300 hover:border-blue-400/50 hover:shadow-lg hover:shadow-blue-500/20 hover:-translate-y-1"
              onClick={() => props.onSelectMode(GameMode.FREE_ROAM)}
            >
              <div class="text-center">
                <div class="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">
                  🗺️
                </div>
                <h2 class="font-display text-2xl sm:text-3xl text-white mb-4">
                  Exploration Libre
                </h2>
                <p class="text-slate-200/80 mb-6 leading-relaxed text-sm sm:text-base">
                  Explorez le champ de bataille sans contraintes. Déplacez vos unités librement pour planifier vos stratégies.
                </p>
                <div class="space-y-2 text-sm text-slate-300/70">
                  <div class="flex items-center justify-center gap-2">
                    <span class="text-green-400">✓</span>
                    <span>Aucun ennemi</span>
                  </div>
                  <div class="flex items-center justify-center gap-2">
                    <span class="text-green-400">✓</span>
                    <span>Déplacement illimité</span>
                  </div>
                  <div class="flex items-center justify-center gap-2">
                    <span class="text-green-400">✓</span>
                    <span>Sans restriction de tour</span>
                  </div>
                </div>
              </div>
              {/* Hover glow effect */}
              <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-t from-blue-500/10 to-transparent pointer-events-none" />
            </button>

            {/* Combat Mode */}
            <button
              class="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-brandStart/80 to-brandEnd/80 backdrop-blur-sm p-8 transition-all duration-300 hover:border-red-400/50 hover:shadow-lg hover:shadow-red-500/20 hover:-translate-y-1"
              onClick={() => props.onSelectMode(GameMode.COMBAT)}
            >
              <div class="text-center">
                <div class="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">
                  ⚔️
                </div>
                <h2 class="font-display text-2xl sm:text-3xl text-white mb-4">
                  Combat Tactique
                </h2>
                <p class="text-slate-200/80 mb-6 leading-relaxed text-sm sm:text-base">
                  Affrontez des ennemis dans des combats au tour par tour. Utilisez stratégie et capacités pour vaincre.
                </p>
                <div class="space-y-2 text-sm text-slate-300/70">
                  <div class="flex items-center justify-center gap-2">
                    <span class="text-red-400">⚡</span>
                    <span>Ennemis à affronter</span>
                  </div>
                  <div class="flex items-center justify-center gap-2">
                    <span class="text-red-400">⚡</span>
                    <span>Stratégie au tour par tour</span>
                  </div>
                  <div class="flex items-center justify-center gap-2">
                    <span class="text-red-400">⚡</span>
                    <span>Capacités & attaques</span>
                  </div>
                </div>
              </div>
              {/* Hover glow effect */}
              <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-t from-red-500/10 to-transparent pointer-events-none" />
            </button>

            {/* Dungeon Mode */}
            <button
              class="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-brandStart/80 to-brandEnd/80 backdrop-blur-sm p-8 transition-all duration-300 hover:border-purple-400/50 hover:shadow-lg hover:shadow-purple-500/20 hover:-translate-y-1"
              onClick={() => props.onSelectMode(GameMode.DUNGEON)}
            >
              <div class="text-center">
                <div class="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">
                  🏰
                </div>
                <h2 class="font-display text-2xl sm:text-3xl text-white mb-4">
                  Donjon
                </h2>
                <p class="text-slate-200/80 mb-6 leading-relaxed text-sm sm:text-base">
                  Parcourez un enchaînement de salles reliées par des portails. Combattez et progressez jusqu'à la victoire.
                </p>
                <div class="space-y-2 text-sm text-slate-300/70">
                  <div class="flex items-center justify-center gap-2">
                    <span class="text-purple-400">🏰</span>
                    <span>Plusieurs salles</span>
                  </div>
                  <div class="flex items-center justify-center gap-2">
                    <span class="text-purple-400">🏰</span>
                    <span>Portails de téléportation</span>
                  </div>
                  <div class="flex items-center justify-center gap-2">
                    <span class="text-purple-400">🏰</span>
                    <span>Progression continue</span>
                  </div>
                </div>
              </div>
              {/* Hover glow effect */}
              <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-t from-purple-500/10 to-transparent pointer-events-none" />
            </button>

            {/* Multiplayer Mode */}
            <button
              class="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-brandStart/80 to-brandEnd/80 backdrop-blur-sm p-8 transition-all duration-300 hover:border-emerald-400/50 hover:shadow-lg hover:shadow-emerald-500/20 hover:-translate-y-1"
              onClick={() => props.onSelectMultiplayer?.()}
            >
              <div class="text-center">
                <div class="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">
                  &#x1F91D;
                </div>
                <h2 class="font-display text-2xl sm:text-3xl text-white mb-4">
                  Multijoueur
                </h2>
                <p class="text-slate-200/80 mb-6 leading-relaxed text-sm sm:text-base">
                  Cr&eacute;ez ou rejoignez une salle pour explorer une carte avec d'autres joueurs en temps r&eacute;el.
                </p>
                <div class="space-y-2 text-sm text-slate-300/70">
                  <div class="flex items-center justify-center gap-2">
                    <span class="text-emerald-400">&#x2713;</span>
                    <span>2-6 joueurs</span>
                  </div>
                  <div class="flex items-center justify-center gap-2">
                    <span class="text-emerald-400">&#x2713;</span>
                    <span>Code de salle</span>
                  </div>
                  <div class="flex items-center justify-center gap-2">
                    <span class="text-emerald-400">&#x2713;</span>
                    <span>Synchronisation temps r&eacute;el</span>
                  </div>
                </div>
              </div>
              {/* Hover glow effect */}
              <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-t from-emerald-500/10 to-transparent pointer-events-none" />
            </button>
          </div>

          {/* Footer Info */}
          <footer class="text-center mt-10 text-slate-200/60 text-sm">
            <p>Vous pouvez revenir à ce menu à tout moment pendant la partie.</p>
          </footer>
        </div>
      </main>
    </div>
  );
};

