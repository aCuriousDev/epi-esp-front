import { Component, For, createEffect, createSignal } from 'solid-js';
import { gameState } from '../game';
import { CombatLogEntry } from '../types';

export const CombatLog: Component = () => {
  let logContainerRef: HTMLDivElement | undefined;
  
  // Auto-scroll to bottom when new entries are added
  createEffect(() => {
    const entries = gameState.combatLog;
    if (entries.length > 0 && logContainerRef) {
      logContainerRef.scrollTop = logContainerRef.scrollHeight;
    }
  });
  
  function getLogColor(type: CombatLogEntry['type']): string {
    switch (type) {
      case 'damage': return 'text-red-400';
      case 'heal': return 'text-green-400';
      case 'move': return 'text-blue-300';
      case 'ability': return 'text-purple-400';
      case 'status': return 'text-yellow-400';
      case 'system': return 'text-game-gold';
      default: return 'text-gray-300';
    }
  }
  
  return (
    <div class="panel-game flex flex-col h-full max-h-[600px] min-h-[200px]">
      <h3 class="font-fantasy text-game-gold mb-3 text-sm flex-shrink-0">Combat Log</h3>
      <div 
        ref={logContainerRef}
        class="flex-1 overflow-y-auto overflow-x-hidden space-y-1 text-xs pr-2 min-h-0"
      >
        <For each={gameState.combatLog}>
          {(entry) => (
            <div class={`${getLogColor(entry.type)} py-0.5 break-words`}>
              <span class="text-gray-500 mr-1">[{entry.turn}]</span>
              <span class="break-words">{entry.message}</span>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};
