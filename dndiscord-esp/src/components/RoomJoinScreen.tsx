import { Component, createSignal, onMount, Show } from 'solid-js';
import { ArrowLeft, Loader2, Plus, Link } from 'lucide-solid';
import { createRoom, joinSession, tryRecoverSession } from '../services/signalr/multiplayer.service';
import { signalRService } from '../services/signalr/SignalRService';
import { ensureMultiplayerHandlersRegistered } from '../services/signalr/multiplayer.service';
import { sessionState, setSessionLoading, setSessionError, getPersistedSession, getPersistedGameStarted } from '../stores/session.store';
import { SessionState } from '../types/multiplayer';
import type { GameStartedPayload } from '../types/multiplayer';

interface RoomJoinScreenProps {
  onRoomReady: () => void;
  onGameRecover: (payload: GameStartedPayload) => void;
  onBack: () => void;
}

export const RoomJoinScreen: Component<RoomJoinScreenProps> = (props) => {
  const [maxPlayers, setMaxPlayers] = createSignal(4);
  const [roomCode, setRoomCode] = createSignal('');
  const [recovering, setRecovering] = createSignal(false);

  onMount(async () => {
    if (!getPersistedSession()) return;
    setRecovering(true);
    try {
      const ok = await tryRecoverSession();
      if (ok) {
        const gamePayload = getPersistedGameStarted();
        if (sessionState.session?.state === SessionState.InProgress && gamePayload) {
          props.onGameRecover(gamePayload);
        } else {
          props.onRoomReady();
        }
        return;
      }
    } catch { /* recovery failed, show normal UI */ }
    setRecovering(false);
  });

  const ensureConnected = async () => {
    if (!signalRService.isConnected) {
      await signalRService.connect();
      ensureMultiplayerHandlersRegistered();
    }
  };

  const handleCreate = async () => {
    setSessionLoading(true);
    setSessionError(null);
    try {
      await ensureConnected();
      await createRoom(maxPlayers());
      props.onRoomReady();
    } catch (err: any) {
      setSessionError(err?.message ?? 'Failed to create room');
    }
  };

  const handleJoin = async () => {
    const code = roomCode().trim().toUpperCase();
    if (!code) return;
    setSessionLoading(true);
    setSessionError(null);
    try {
      await ensureConnected();
      const result = await joinSession(code);
      if (result.success) {
        props.onRoomReady();
      } else {
        setSessionError(result.message ?? 'Failed to join room');
      }
    } catch (err: any) {
      setSessionError(err?.message ?? 'Failed to join room');
    }
  };

  return (
    <div class="relative min-h-screen w-full overflow-hidden bg-brand-gradient">
      <div class="vignette absolute inset-0" />

      <button
        onClick={props.onBack}
        class="settings-btn !fixed !top-4 !left-4 !right-auto"
        aria-label="Retour"
      >
        <ArrowLeft class="w-5 h-5 text-white" />
      </button>

      <main class="relative z-10 flex min-h-screen items-center justify-center p-6 sm:p-10">
        <Show when={recovering()}>
          <div class="flex flex-col items-center gap-4 text-white">
            <Loader2 class="w-10 h-10 animate-spin text-blue-400" />
            <p class="text-lg text-slate-200">Reconnexion à la session...</p>
          </div>
        </Show>

        <Show when={!recovering()}>
          <div class="max-w-4xl w-full">
            <header class="text-center mb-10">
              <h1 class="font-display text-5xl sm:text-6xl tracking-wide text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
                Multijoueur
              </h1>
              <p class="mt-4 text-slate-100/90 max-w-xl mx-auto">
                Cr&eacute;ez une salle ou rejoignez-en une avec un code.
              </p>
              <div class="mt-6 mx-auto decorative-divider" />
            </header>

            <Show when={sessionState.error}>
              <div class="mb-6 p-4 rounded-xl bg-red-500/20 border border-red-400/30 text-red-200 text-center" role="alert">
                {sessionState.error}
              </div>
            </Show>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
              {/* Create Room */}
              <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-brandStart/80 to-brandEnd/80 backdrop-blur-sm p-8">
                <div class="text-center">
                  <div class="mb-4 flex justify-center"><Plus class="w-12 h-12 text-blue-300" /></div>
                  <h2 class="font-display text-2xl sm:text-3xl text-white mb-6">
                    Cr&eacute;er une salle
                  </h2>
                  <div class="mb-6">
                    <label for="max-players" class="block text-slate-200/80 text-sm mb-2">Joueurs max (2-6)</label>
                    <input
                      id="max-players"
                      type="number"
                      min={2}
                      max={6}
                      value={maxPlayers()}
                      onInput={(e) => setMaxPlayers(Math.min(6, Math.max(2, parseInt(e.currentTarget.value) || 4)))}
                      class="w-24 mx-auto block text-center bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-400"
                    />
                  </div>
                  <button
                    onClick={handleCreate}
                    disabled={sessionState.isLoading}
                    class="w-full px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition disabled:opacity-50"
                  >
                    {sessionState.isLoading ? 'Connexion...' : 'Cr\u00e9er'}
                  </button>
                </div>
              </div>

              {/* Join Room */}
              <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-brandStart/80 to-brandEnd/80 backdrop-blur-sm p-8">
                <div class="text-center">
                  <div class="mb-4 flex justify-center"><Link class="w-12 h-12 text-green-300" /></div>
                  <h2 class="font-display text-2xl sm:text-3xl text-white mb-6">
                    Rejoindre
                  </h2>
                  <div class="mb-6">
                    <label for="room-code" class="block text-slate-200/80 text-sm mb-2">Code de la salle</label>
                    <input
                      id="room-code"
                      type="text"
                      placeholder="XXXX-XXXX"
                      value={roomCode()}
                      onInput={(e) => setRoomCode(e.currentTarget.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                      class="w-full max-w-[200px] mx-auto block text-center bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white uppercase tracking-widest focus:outline-none focus:border-green-400"
                      maxLength={9}
                    />
                  </div>
                  <button
                    onClick={handleJoin}
                    disabled={sessionState.isLoading || !roomCode().trim()}
                    class="w-full px-6 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold transition disabled:opacity-50"
                  >
                    {sessionState.isLoading ? 'Connexion...' : 'Rejoindre'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Show>
      </main>
    </div>
  );
};
