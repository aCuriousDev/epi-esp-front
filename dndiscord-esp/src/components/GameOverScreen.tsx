import { Component, Show } from 'solid-js';
import { gameState, units, startGame } from '../game';
import { Team, GamePhase } from '../types';

export const GameOverScreen: Component = () => {
  const isVictory = () => {
    const enemyAlive = Object.values(units).some(
      (u) => u.team === Team.ENEMY && u.isAlive
    );
    return !enemyAlive;
  };
  
  return (
    <Show when={gameState.phase === GamePhase.GAME_OVER}>
      <div class="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div class="panel-game text-center p-8 max-w-md">
          <h1 class={`font-fantasy text-4xl mb-4 ${
            isVictory() ? 'text-game-gold' : 'text-red-500'
          }`}>
            {isVictory() ? '🏆 Victory! 🏆' : '💀 Defeat 💀'}
          </h1>
          
          <p class="text-gray-300 mb-6">
            {isVictory() 
              ? 'Congratulations! You have vanquished all enemies!'
              : 'Your party has fallen in battle...'}
          </p>
          
          <div class="mb-6 text-sm text-gray-400">
            <p>Battle lasted {gameState.currentTurn} rounds</p>
          </div>
          
          <button
            class="btn-game text-lg px-8 py-3"
            onClick={() => startGame()}
          >
            Play Again
          </button>
        </div>
      </div>
    </Show>
  );
};
