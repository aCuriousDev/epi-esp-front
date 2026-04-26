import {
  Component,
  createEffect,
  createSignal,
  For,
  onMount,
  Show,
} from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { Copy, Check, Play, Loader2, Users } from 'lucide-solid';
import { sessionState, isHost } from '@/stores/session.store';
import { PlayerRole } from '@/types/multiplayer';
import {
  selectCharacter,
  startGame as startGameHub,
} from '@/services/signalr/multiplayer.service';
import { CharacterService, type CharacterDto } from '@/services/character.service';
import { signalRService } from '@/services/signalr/SignalRService';
import { ensureMultiplayerHandlersRegistered } from '@/services/signalr/multiplayer.service';

const CampaignLobbyPage: Component = () => {
  const params = useParams();
  const navigate = useNavigate();

  const [characters, setCharacters] = createSignal<CharacterDto[]>([]);
  const [selectedCharId, setSelectedCharId] = createSignal<string | null>(null);
  const [copied, setCopied] = createSignal(false);
  const [starting, setStarting] = createSignal(false);

  const session = () => sessionState.session;
  const amHost = () => isHost();
  const players = () => session()?.players ?? [];

  // Snapshot of any payload that was already set when this lobby mounted.
  // This can happen if the user navigates back to the lobby after a previous
  // session without the store being cleared — the old payload must not
  // trigger an immediate navigation to /session.
  const stalePayload = sessionState.gameStartedPayload;

  onMount(async () => {
    // Assurer que les handlers sont actifs
    if (!signalRService.isConnected) {
      await signalRService.connect();
      ensureMultiplayerHandlersRegistered();
    }

    try {
      const chars = await CharacterService.getMyCharacters();
      setCharacters(chars);
    } catch (e) {
      console.warn('[CampaignLobby] Failed to load characters:', e);
    }
  });

  // Quand le MJ lance la session → tout le monde navigue vers la page session.
  // Guard against stalePayload: only react to a payload that arrived AFTER
  // this component mounted (reference inequality with the snapshot above).
  createEffect(() => {
    const payload = sessionState.gameStartedPayload;
    if (payload && payload !== stalePayload) {
      navigate(`/campaigns/${params.id}/session`);
    }
  });

  const copyCode = () => {
    const code = session()?.joinCode ?? session()?.sessionId;
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCharacterSelect = async (charId: string | null) => {
    setSelectedCharId(charId);
    try {
      await selectCharacter(charId);
    } catch (err) {
      console.warn('[CampaignLobby] selectCharacter failed:', err);
    }
  };

  const handleStartSession = async () => {
    if (starting()) return;
    setStarting(true);
    try {
      // On passe 'campaign' comme mapId — pas de carte à charger
      await startGameHub('campaign');
      // La navigation est déclenchée par l'effet sur gameStartedPayload
    } catch (err: any) {
      console.error('[CampaignLobby] startGame failed:', err);
      setStarting(false);
    }
  };

  return (
    <div class="w-full min-h-full" style={{ color: '#d4d4d4', 'font-family': 'system-ui, -apple-system, sans-serif' }}>
      {/* Lobby header — room code + campaign name */}
      <header class="sticky top-0 z-20 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/40 backdrop-blur-md">
        <div class="text-center">
          <p class="text-xs text-purple-400 uppercase tracking-wider font-medium">Waiting room</p>
          <h1 class="font-display text-lg text-white">
            {session()?.campaignName ?? 'Campaign'}
          </h1>
        </div>

        {/* Room code */}
        <button
          onClick={copyCode}
          class="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-slate-300 transition-all"
          title="Copy code"
        >
          <span class="font-mono tracking-widest text-white font-bold">
            {session()?.joinCode ?? session()?.sessionId?.slice(0, 8) ?? '...'}
          </span>
          <Show when={copied()} fallback={<Copy class="w-3.5 h-3.5" />}>
            <Check class="w-3.5 h-3.5 text-green-400" />
          </Show>
        </button>
      </header>

      <main class="max-w-2xl mx-auto px-4 py-10 space-y-6">

        {/* Liste des joueurs */}
        <section class="bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <div class="flex items-center gap-2 mb-4">
            <Users class="w-5 h-5 text-purple-400" />
            <h2 class="font-display text-xl text-white">
              Players ({players().length}/{session()?.maxPlayers ?? '?'})
            </h2>
          </div>

          <Show when={players().length === 0}>
            <p class="text-slate-500 italic text-sm">Waiting for players…</p>
          </Show>

          <div class="space-y-2">
            <For each={players()}>
              {(player) => (
                <div class="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3 border border-white/5">
                  <div class="flex items-center gap-3">
                    <div
                      class={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                        player.status === 'Connected' ? 'bg-emerald-400' : 'bg-slate-500'
                      }`}
                    />
                    <span class="text-white font-medium">{player.userName}</span>
                    <Show when={player.role === PlayerRole.DungeonMaster}>
                      <span class="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        DM
                      </span>
                    </Show>
                  </div>
                  <span class="text-sm text-slate-400">
                    {player.selectedCharacterName ?? player.selectedCharacterId ?? 'No character'}
                  </span>
                </div>
              )}
            </For>
          </div>
        </section>

        {/* Sélection du personnage */}
        <section class="bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <h2 class="font-display text-xl text-white mb-4">Your character</h2>
          <div class="space-y-2">
            <button
              onClick={() => handleCharacterSelect(null)}
              class={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                selectedCharId() === null
                  ? 'border-purple-500 bg-purple-500/15 text-white'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              Default warrior
            </button>
            <Show when={characters().length === 0}>
              <p class="text-slate-500 text-sm italic px-1">
                No character created — the default warrior will be used.
              </p>
            </Show>
            <For each={characters()}>
              {(char) => (
                <button
                  onClick={() => handleCharacterSelect(char.id)}
                  class={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                    selectedCharId() === char.id
                      ? 'border-purple-500 bg-purple-500/15 text-white'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <div class="flex justify-between items-center">
                    <span class="font-medium">{char.name}</span>
                    <span class="text-sm text-slate-400">
                      {char.class} Lv.{char.level} — {char.maxHitPoints} HP
                    </span>
                  </div>
                </button>
              )}
            </For>
          </div>
        </section>

        {/* Contrôles MJ */}
        <Show when={amHost()}>
          <section class="bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <button
              onClick={handleStartSession}
              disabled={starting()}
              class="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-lg rounded-xl transition-all shadow-lg shadow-purple-500/20"
            >
              <Show when={starting()} fallback={<Play class="w-5 h-5" />}>
                <Loader2 class="w-5 h-5 animate-spin" />
              </Show>
              <Show when={starting()} fallback="Start session">
                Launching…
              </Show>
            </button>
            <p class="text-center text-sm text-slate-500 mt-3">
              Players will be redirected automatically.
            </p>
          </section>
        </Show>

        {/* Attente joueurs */}
        <Show when={!amHost()}>
          <div class="text-center py-4 text-slate-400">
            <Loader2 class="w-6 h-6 animate-spin text-purple-400 mx-auto mb-2" />
            Waiting for the Dungeon Master to start…
          </div>
        </Show>

      </main>
    </div>
  );
};

export default CampaignLobbyPage;
