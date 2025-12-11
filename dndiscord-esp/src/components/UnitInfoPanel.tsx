import { Component, Show, For } from 'solid-js';
import { Unit } from '../types';
import {
  getSelectedUnit,
  selectAbility,
  endUnitTurn,
  gameState,
  getCurrentUnit,
} from '../game';
import { GamePhase } from '../types';

export const UnitInfoPanel: Component = () => {
  const unit = () => getSelectedUnit();
  const currentUnit = () => getCurrentUnit();
  const isCurrentUnit = () => {
    const u = unit();
    const cu = currentUnit();
    return u && cu && u.id === cu.id && gameState.phase === GamePhase.PLAYER_TURN;
  };
  
  return (
    <div class="panel-game flex flex-col min-h-[300px] max-h-[800px] overflow-y-auto">
      <Show when={unit()} fallback={
        <div class="text-center text-gray-400 py-8">
          <p class="font-fantasy text-lg">Select a Unit</p>
          <p class="text-sm mt-2">Click on a unit to see their stats</p>
        </div>
      }>
        {(u) => (
          <div class="space-y-4">
            {/* Unit Header */}
            <div class="flex items-center gap-3">
              <div class={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                u().team === 'player' ? 'bg-blue-600' : 'bg-red-600'
              }`}>
                <span class="text-2xl">
                  {getUnitIcon(u().type)}
                </span>
              </div>
              <div class="min-w-0 flex-1">
                <h3 class="font-fantasy text-lg text-game-gold truncate">{u().name}</h3>
                <p class="text-sm text-gray-400 capitalize truncate">{u().type.replace('_', ' ')}</p>
              </div>
            </div>
            
            {/* Health Bar */}
            <div>
              <div class="flex justify-between text-sm mb-1">
                <span>Health</span>
                <span class="text-game-green">
                  {u().stats.currentHealth} / {u().stats.maxHealth}
                </span>
              </div>
              <div class="stat-bar">
                <div 
                  class="stat-bar-fill bg-game-green"
                  style={{ 
                    width: `${(u().stats.currentHealth / u().stats.maxHealth) * 100}%` 
                  }}
                />
              </div>
            </div>
            
            {/* Action Points */}
            <div>
              <div class="flex justify-between text-sm mb-1">
                <span>Action Points</span>
                <span class="text-blue-400">
                  {u().stats.currentActionPoints} / {u().stats.maxActionPoints}
                </span>
              </div>
              <div class="stat-bar">
                <div 
                  class="stat-bar-fill bg-blue-500"
                  style={{ 
                    width: `${(u().stats.currentActionPoints / u().stats.maxActionPoints) * 100}%` 
                  }}
                />
              </div>
            </div>
            
            {/* Stats Grid */}
            <div class="grid grid-cols-2 gap-2 text-sm">
              <StatItem label="Movement" value={u().stats.movementRange} />
              <StatItem label="Attack Range" value={u().stats.attackRange} />
              <StatItem label="Attack" value={u().stats.attackDamage} />
              <StatItem label="Defense" value={u().stats.defense} />
              <StatItem label="Initiative" value={u().stats.initiative} />
            </div>
            
            {/* Status */}
            <div class="flex flex-wrap gap-2">
              <Show when={u().hasMoved}>
                <span class="px-2 py-1 bg-gray-700 rounded text-xs">Moved</span>
              </Show>
              <Show when={u().hasActed}>
                <span class="px-2 py-1 bg-gray-700 rounded text-xs">Acted</span>
              </Show>
            </div>
            
            {/* Abilities */}
            <div class="border-t border-game-gold/20 pt-4">
              <h4 class="font-fantasy text-sm text-game-gold mb-2">Abilities</h4>
              
              {/* Show turn status for player units */}
              <Show when={u().team === 'player' && !isCurrentUnit()}>
                <p class="text-xs text-gray-500 mb-2 italic">
                  Not this unit's turn
                </p>
              </Show>
              
              {/* Show inspection note for enemy units */}
              <Show when={u().team !== 'player'}>
                <p class="text-xs text-gray-400 mb-2 italic">
                  Enemy Unit - Inspection Mode
                </p>
              </Show>
              
              <div class="space-y-2">
                <For each={u().abilities}>
                  {(ability) => {
                    const isPlayerUnit = u().team === 'player';
                    const isDisabled = () => !isPlayerUnit || !isCurrentUnit() || ability.currentCooldown > 0 || u().stats.currentActionPoints < ability.apCost;
                    const isInteractive = () => isPlayerUnit && isCurrentUnit();
                    
                    return (
                      <button
                        class={`w-full text-left p-2 rounded transition-all ${
                          gameState.selectedAbility === ability.id
                            ? 'bg-game-accent/50 border border-game-accent'
                            : isDisabled()
                              ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                              : isPlayerUnit
                                ? 'bg-game-blue/50 hover:bg-game-blue border border-transparent hover:border-game-gold/30'
                                : 'bg-red-900/30 border border-red-700/30 cursor-default'
                        }`}
                        onClick={() => {
                          if (isInteractive() && ability.currentCooldown === 0 && 
                              u().stats.currentActionPoints >= ability.apCost) {
                            selectAbility(ability.id);
                          }
                        }}
                        disabled={isDisabled()}
                      >
                        <div class="flex justify-between items-start gap-2">
                          <div class="min-w-0 flex-1">
                            <span class="font-semibold block truncate">{ability.name}</span>
                            <p class="text-xs text-gray-400 mt-1 break-words">
                              {ability.description}
                            </p>
                          </div>
                          <div class="text-right text-xs flex-shrink-0">
                            <div class="text-blue-400">{ability.apCost} AP</div>
                            <div class="text-gray-500">Range: {ability.range}</div>
                            <Show when={ability.currentCooldown > 0}>
                              <div class="text-game-accent">
                                CD: {ability.currentCooldown}
                              </div>
                            </Show>
                          </div>
                        </div>
                      </button>
                    );
                  }}
                </For>
              </div>
              
              {/* End Turn Button - Only for player units */}
              <Show when={u().team === 'player'}>
                <button
                  class={`btn-game w-full mt-4 ${!isCurrentUnit() ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => isCurrentUnit() && endUnitTurn()}
                  disabled={!isCurrentUnit()}
                >
                  End Turn
                </button>
              </Show>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
};

const StatItem: Component<{ label: string; value: number }> = (props) => {
  return (
    <div class="bg-game-darker/50 p-2 rounded">
      <div class="text-xs text-gray-400">{props.label}</div>
      <div class="font-semibold">{props.value}</div>
    </div>
  );
};

function getUnitIcon(type: string): string {
  switch (type) {
    case 'warrior': return '⚔️';
    case 'mage': return '🔮';
    case 'archer': return '🏹';
    case 'rogue': return '🗡️';
    case 'healer': return '✨';
    case 'enemy_skeleton': return '💀';
    case 'enemy_mage': return '🧙';
    default: return '👤';
  }
}
