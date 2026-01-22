import { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { ArrowLeft } from 'lucide-solid';
import { GameMode } from '../types';

interface ModeSelectionScreenProps {
  onSelectMode: (mode: GameMode) => void;
}

export const ModeSelectionScreen: Component<ModeSelectionScreenProps> = (props) => {
  return (
    <div class="w-full h-screen flex items-center justify-center bg-game-darker relative">
      {/* Back button */}
      <A href="/" class="settings-btn" aria-label="Retour">
        <ArrowLeft class="settings-icon h-5 w-5" />
      </A>

      <div class="max-w-5xl w-full px-8">
        {/* Title */}
        <div class="text-center mb-12">
          <h1 class="font-fantasy text-6xl text-game-gold mb-4">
            ⚔️ DnDiscord Combat POC
          </h1>
          <p class="text-xl text-gray-300">Choose Your Game Mode</p>
        </div>

        {/* Mode Cards */}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Free Roam Mode */}
          <button
            class="panel-game hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/20 transition-all duration-300 cursor-pointer group p-8"
            onClick={() => props.onSelectMode(GameMode.FREE_ROAM)}
          >
            <div class="text-center">
              <div class="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">
                🗺️
              </div>
              <h2 class="font-fantasy text-3xl text-game-gold mb-4">
                Free Roam
              </h2>
              <p class="text-gray-300 mb-6 leading-relaxed">
                Explore the battlefield freely without enemies or combat constraints. 
                Move your units anywhere on the map to plan strategies and test formations.
              </p>
              <div class="space-y-2 text-sm text-gray-400">
                <div class="flex items-center justify-center gap-2">
                  <span class="text-green-400">✓</span>
                  <span>No enemies</span>
                </div>
                <div class="flex items-center justify-center gap-2">
                  <span class="text-green-400">✓</span>
                  <span>Unlimited movement</span>
                </div>
                <div class="flex items-center justify-center gap-2">
                  <span class="text-green-400">✓</span>
                  <span>No turn restrictions</span>
                </div>
              </div>
            </div>
          </button>

          {/* Combat Mode */}
          <button
            class="panel-game hover:border-red-400 hover:shadow-lg hover:shadow-red-500/20 transition-all duration-300 cursor-pointer group p-8"
            onClick={() => props.onSelectMode(GameMode.COMBAT)}
          >
            <div class="text-center">
              <div class="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">
                ⚔️
              </div>
              <h2 class="font-fantasy text-3xl text-game-gold mb-4">
                Combat
              </h2>
              <p class="text-gray-300 mb-6 leading-relaxed">
                Engage in tactical turn-based combat against enemies. 
                Use strategy, abilities, and positioning to defeat your opponents.
              </p>
              <div class="space-y-2 text-sm text-gray-400">
                <div class="flex items-center justify-center gap-2">
                  <span class="text-red-400">⚡</span>
                  <span>Face enemy units</span>
                </div>
                <div class="flex items-center justify-center gap-2">
                  <span class="text-red-400">⚡</span>
                  <span>Turn-based strategy</span>
                </div>
                <div class="flex items-center justify-center gap-2">
                  <span class="text-red-400">⚡</span>
                  <span>Use abilities & attacks</span>
                </div>
              </div>
            </div>
          </button>
        </div>

        {/* Footer Info */}
        <div class="text-center mt-12 text-gray-500 text-sm">
          <p>You can return to this menu at any time during gameplay</p>
        </div>
      </div>
    </div>
  );
};

