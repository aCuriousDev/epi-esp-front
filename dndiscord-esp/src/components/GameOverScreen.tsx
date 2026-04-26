import { Component, Show } from 'solid-js';
import { Trophy, Skull, Hourglass } from 'lucide-solid';
import { gameState, units, startGame } from '../game';
import { Team, GamePhase } from '../types';
import { isInSession, isHost as isSessionHost, sessionState } from '../stores/session.store';
import { dmRestartGame } from '../services/signalr/multiplayer.service';

export const GameOverScreen: Component = () => {
  const isVictory = () => {
    const enemyAlive = Object.values(units).some(
      (u) => u.team === Team.ENEMY && u.isAlive
    );
    return !enemyAlive;
  };

  // In a multiplayer session, only the DM can drive the post-combat flow —
  // a player hitting "Play Again" kicks the restart path on their own
  // client and spawns the solo-fallback roster (BUG-I / BUG-N). Until the
  // full PHASE-H outcome UX lands, show the restart button only when we're
  // solo or the current user is the host/DM; everyone else gets a waiting
  // message.
  const canRestart = () => !isInSession() || isSessionHost();

  return (
    <Show when={gameState.phase === GamePhase.GAME_OVER}>
      <div class="fixed inset-0 bg-black/80 flex items-center justify-center z-50" role="dialog" aria-modal="true">
        <div class="panel-game text-center p-8 max-w-md">
          <div class="flex justify-center mb-4">
            {isVictory()
              ? <Trophy class="w-12 h-12 text-game-gold" />
              : <Skull class="w-12 h-12 text-red-500" />
            }
          </div>
          <h1 class={`font-fantasy text-4xl mb-4 ${
            isVictory() ? 'text-game-gold' : 'text-red-500'
          }`}>
            {isVictory() ? 'Victory!' : 'Defeat'}
          </h1>

          <p class="text-gray-300 mb-6">
            {isVictory()
              ? 'Congratulations! You have vanquished all enemies!'
              : 'Your party has fallen in battle...'}
          </p>

          <div class="mb-6 text-sm text-gray-400">
            <p>Battle lasted {gameState.currentTurn} rounds</p>
          </div>

          <Show
            when={canRestart()}
            fallback={
              <div class="flex flex-col items-center gap-2 py-3 text-gray-300">
                <Hourglass class="w-6 h-6 text-game-gold animate-pulse" />
                <p class="text-sm">Waiting for the DM…</p>
                <p class="text-xs text-gray-500 max-w-xs">
                  The Dungeon Master will decide what comes next.
                </p>
              </div>
            }
          >
            <button
              class="btn-game text-lg px-8 py-3 focus-ring-gold"
              onClick={async () => {
                // In multiplayer, route through the hub's DmRestartGame so
                // every client receives a fresh GameStarted broadcast and
                // re-initialises via the hub-authoritative path. On hub
                // failure, surface the error and bail — do NOT silently fall
                // back to startGame(), that forks the DM into a solo game
                // while peers stay on the victory screen (the old regression
                // that stamped Sir Roland / Elara / Theron).
                if (isInSession()) {
                  if (!isSessionHost()) return;
                  const mapId = sessionState.session?.mapId ?? gameState.mapId ?? "default";
                  try {
                    await dmRestartGame(mapId);
                  } catch (err) {
                    console.error("[GameOverScreen] dmRestartGame failed — game not restarted:", err);
                    alert("Impossible de relancer la partie — la session est peut-être terminée. Essayez de rafraîchir.");
                  }
                  return;
                }
                // Solo: local restart only.
                startGame();
              }}
            >
              Continue
            </button>
          </Show>
        </div>
      </div>
    </Show>
  );
};
