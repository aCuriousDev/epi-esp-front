import { Component, For, Show } from 'solid-js';
import { gameState, units } from '../game';
import { Team } from '../types';
import { getUnitIcon } from './common/icons';

export const TurnOrderDisplay: Component = () => {
  return (
    <div class="panel-game">
      <div class="flex items-center gap-2 mb-3">
        <h3 class="font-fantasy text-game-gold text-sm">Turn Order</h3>
        <span class="text-xs text-gray-400">Round {gameState.currentTurn}</span>
      </div>
      
      <div class="flex gap-1.5 overflow-x-auto py-2 -mx-1 px-1 scrollbar-thin">
        <For each={gameState.turnOrder}>
          {(unitId, index) => {
            const unit = units[unitId];
            if (!unit || !unit.isAlive) return null;
            
            const isCurrent = () => index() === gameState.currentUnitIndex;
            const isPlayer = unit.team === Team.PLAYER;
            
            return (
              <div 
                class={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center transition-all ${
                  isCurrent() 
                    ? 'ring-2 ring-game-gold scale-110 shadow-lg shadow-game-gold/30' 
                    : 'opacity-60 hover:opacity-100'
                } ${
                  isPlayer ? 'bg-arcindigo-500/50' : 'bg-danger/50'
                }`}
                title={`${unit.name} (Initiative: ${unit.stats.initiative})`}
              >
                {getUnitIcon(unit.type, { class: "w-5 h-5 text-white" })}
              </div>
            );
          }}
        </For>
      </div>
      
      <div class="mt-2 text-xs text-gray-400">
        <Show 
          when={gameState.phase === 'player_turn'}
          fallback={
            <span class="text-red-400 font-semibold">Enemy Turn</span>
          }
        >
          <span class="text-green-400 font-semibold">Your Turn</span>
        </Show>
      </div>
    </div>
  );
};

