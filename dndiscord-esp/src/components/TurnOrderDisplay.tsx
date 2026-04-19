import { Component, For } from 'solid-js';
import { gameState, units } from '../game';
import { Team } from '../types';
import { getUnitIcon } from './common/icons';
import { getHubUserId } from '../stores/session.store';

/**
 * Compact turn-order strip.
 *
 * Design intent (from user feedback):
 * - Slim and dense so it can live as a persistent top banner without
 *   eating canvas space.
 * - No redundant "Your Turn" / "Enemy Turn" label — the state is encoded
 *   in the current unit's ring colour instead.
 * - Ring colour on the currently-acting unit tells you at a glance whose
 *   turn it is: gold if it's YOU, green if it's an ally (player team but
 *   owned by another user in multiplayer), red if it's an enemy.
 */
export const TurnOrderDisplay: Component = () => {
  const myUserId = () => getHubUserId();

  return (
    <div class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-game-darker/85 border border-white/10 shadow-lg backdrop-blur-sm">
      <span class="flex-shrink-0 text-[11px] font-fantasy text-game-gold tracking-wide">
        R{gameState.currentTurn}
      </span>

      <div class="flex-1 flex gap-1 overflow-x-auto scrollbar-thin -my-1 py-1">
        <For each={gameState.turnOrder}>
          {(unitId, index) => {
            const unit = units[unitId];
            if (!unit || !unit.isAlive) return null;

            const isCurrent = () => index() === gameState.currentUnitIndex;
            const isPlayer = unit.team === Team.PLAYER;
            const me = myUserId();
            const isMine =
              isPlayer &&
              (!unit.ownerUserId || unit.ownerUserId === me);

            // Team tint on the avatar card itself (subtle).
            const tileBg = isPlayer
              ? 'bg-arcindigo-700/50'
              : 'bg-red-900/45';

            // Ring colour on the current unit — gold for me, green for an
            // ally (player team, not my unit), red for an enemy.
            const ringClass = () => {
              if (!isCurrent()) return 'opacity-70';
              if (!isPlayer) return 'ring-2 ring-red-400 ring-offset-1 ring-offset-game-darker shadow-[0_0_10px_rgba(248,113,113,0.55)] animate-[pulse_1.8s_ease-in-out_infinite]';
              if (isMine) return 'ring-2 ring-game-gold ring-offset-1 ring-offset-game-darker shadow-[0_0_10px_rgba(251,191,36,0.55)] animate-[pulse_1.8s_ease-in-out_infinite]';
              return 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-game-darker shadow-[0_0_10px_rgba(52,211,153,0.55)] animate-[pulse_1.8s_ease-in-out_infinite]';
            };

            return (
              <div
                class={`flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center transition-all ${tileBg} ${ringClass()}`}
                title={`${unit.name} (Init ${unit.stats.initiative})${
                  isCurrent() ? ' — en cours' : ''
                }`}
              >
                {getUnitIcon(unit.type, { class: 'w-4 h-4 text-white' })}
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
};
