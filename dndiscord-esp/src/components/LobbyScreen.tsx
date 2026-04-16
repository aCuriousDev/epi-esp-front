import {
  Component,
  createSignal,
  createEffect,
  onMount,
  For,
  Show,
} from "solid-js";
import { ArrowLeft, Copy, Check } from "lucide-solid";
import { sessionState, isHost } from "../stores/session.store";
import { PlayerRole } from "../types/multiplayer";
import {
  selectCharacter,
  startGame as startGameHub,
  leaveSession,
} from "../services/signalr/multiplayer.service";
import {
  CharacterService,
  type CharacterDto,
} from "../services/character.service";
import { getAllMaps } from "../services/mapStorage";
import type { GameStartedPayload } from "../types/multiplayer";
import { safeConfirm } from "../services/ui/confirm";

interface LobbyScreenProps {
  onGameStart: (payload: GameStartedPayload) => void;
  onLeave: () => void;
}

export const LobbyScreen: Component<LobbyScreenProps> = (props) => {
  const [characters, setCharacters] = createSignal<CharacterDto[]>([]);
  const [selectedCharId, setSelectedCharId] = createSignal<string | null>(null);
  const [maps, setMaps] = createSignal<Array<{ id: string; name: string }>>([]);
  const [selectedMapId, setSelectedMapId] = createSignal<string | null>(null);
  const [copied, setCopied] = createSignal(false);
  const [starting, setStarting] = createSignal(false);

  onMount(async () => {
    try {
      const chars = await CharacterService.getMyCharacters();
      setCharacters(chars);
    } catch {
      // No characters available
    }

    const allMaps = getAllMaps();
    allMaps.sort((a, b) => b.updatedAt - a.updatedAt);
    setMaps(allMaps);
  });

  // React to gameStartedPayload
  createEffect(() => {
    const payload = sessionState.gameStartedPayload;
    if (payload) {
      props.onGameStart(payload);
    }
  });

  const session = () => sessionState.session;
  const amHost = () => isHost();

  const copyCode = () => {
    const code = session()?.joinCode ?? session()?.sessionId;
    if (code) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCharacterSelect = async (charId: string | null) => {
    setSelectedCharId(charId);
    try {
      await selectCharacter(charId);
    } catch (err) {
      console.warn("[Lobby] selectCharacter failed:", err);
    }
  };

  const handleStartGame = async () => {
    const mapId = selectedMapId();
    if (
      !mapId &&
      !safeConfirm(
        "Aucune carte s\u00e9lectionn\u00e9e. Utiliser la carte par d\u00e9faut ?",
      )
    )
      return;
    setStarting(true);
    try {
      await startGameHub(mapId ?? "default");
    } catch (err: any) {
      console.error("[Lobby] startGame failed:", err);
      setStarting(false);
    }
  };

  const handleLeave = async () => {
    try {
      await leaveSession();
    } catch {}
    props.onLeave();
  };

  const playerCount = () => session()?.players.length ?? 0;
  const canStart = () => playerCount() >= 2 && !starting();

  return (
    <div class="relative min-h-screen w-full overflow-hidden bg-brand-gradient">
      <div class="vignette absolute inset-0" />

      <button
        onClick={handleLeave}
        class="settings-btn !fixed !top-4 !left-4 !right-auto"
        aria-label="Quitter la salle"
      >
        <ArrowLeft class="w-5 h-5 text-white" />
      </button>

      <main class="relative z-10 flex min-h-screen items-center justify-center p-6 sm:p-10">
        <div class="max-w-3xl w-full space-y-6">
          {/* Room Code */}
          <div class="text-center">
            <p class="text-slate-200/70 text-sm mb-2">Code de la salle</p>
            <div class="inline-flex items-center gap-3 bg-black/30 backdrop-blur-sm rounded-xl px-6 py-3 border border-white/10">
              <span class="font-mono text-3xl sm:text-4xl tracking-[0.3em] text-white font-bold">
                {session()?.joinCode ?? session()?.sessionId ?? "..."}
              </span>
              <button
                onClick={copyCode}
                class="p-2 rounded-lg hover:bg-white/10 transition text-slate-300 hover:text-white"
                title="Copier le code"
                aria-label="Copier le code de la salle"
              >
                <Show when={copied()} fallback={<Copy class="w-5 h-5" />}>
                  <Check class="w-5 h-5 text-green-400" />
                </Show>
              </button>
            </div>
          </div>

          {/* Player List */}
          <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-brandStart/80 to-brandEnd/80 backdrop-blur-sm p-6">
            <h3 class="font-display text-xl text-white mb-4">
              Joueurs ({playerCount()}/{session()?.maxPlayers ?? "?"})
            </h3>
            <div class="space-y-2">
              <For each={session()?.players ?? []}>
                {(player) => (
                  <div class="flex items-center justify-between bg-white/5 rounded-lg px-4 py-3 border border-white/5">
                    <div class="flex items-center gap-3">
                      <div
                        class={`w-2.5 h-2.5 rounded-full ${player.status === "Connected" ? "bg-green-400" : "bg-gray-500"}`}
                        aria-hidden="true"
                      />
                      <span class="sr-only">{player.status === "Connected" ? "Connecté" : "Déconnecté"}</span>
                      <span class="text-white font-medium">
                        {player.userName}
                      </span>
                      <Show when={player.role === PlayerRole.DungeonMaster}>
                        <span class="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Host
                        </span>
                      </Show>
                    </div>
                    <span class="text-sm text-slate-300/70">
                      {player.selectedCharacterName ??
                        player.selectedCharacterId ??
                        "Par d\u00e9faut"}
                    </span>
                  </div>
                )}
              </For>
            </div>
          </div>

          {/* Character Selection */}
          <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-brandStart/80 to-brandEnd/80 backdrop-blur-sm p-6">
            <h3 class="font-display text-xl text-white mb-4">
              Votre personnage
            </h3>
            <div class="space-y-2">
              <button
                onClick={() => handleCharacterSelect(null)}
                class={`w-full text-left px-4 py-3 rounded-lg border transition ${
                  selectedCharId() === null
                    ? "border-blue-400 bg-blue-500/20 text-white"
                    : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                }`}
              >
                Guerrier par d&eacute;faut
              </button>
              <For each={characters()}>
                {(char) => (
                  <button
                    onClick={() => handleCharacterSelect(char.id)}
                    class={`w-full text-left px-4 py-3 rounded-lg border transition ${
                      selectedCharId() === char.id
                        ? "border-blue-400 bg-blue-500/20 text-white"
                        : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    <div class="flex justify-between items-center">
                      <span class="font-medium">{char.name}</span>
                      <span class="text-sm text-slate-400">
                        {char.class} Nv.{char.level} - {char.maxHitPoints} PV
                      </span>
                    </div>
                  </button>
                )}
              </For>
            </div>
          </div>

          {/* Host Controls: Map Selection + Start */}
          <Show when={amHost()}>
            <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-brandStart/80 to-brandEnd/80 backdrop-blur-sm p-6">
              <h3 class="font-display text-xl text-white mb-4">Carte</h3>
              <div class="space-y-2 mb-6 max-h-40 overflow-y-auto">
                <button
                  onClick={() => setSelectedMapId(null)}
                  class={`w-full text-left px-4 py-2 rounded-lg border transition text-sm ${
                    selectedMapId() === null
                      ? "border-amber-400 bg-amber-500/20 text-white"
                      : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  Carte par d&eacute;faut
                </button>
                <For each={maps()}>
                  {(map) => (
                    <button
                      onClick={() => setSelectedMapId(map.id)}
                      class={`w-full text-left px-4 py-2 rounded-lg border transition text-sm ${
                        selectedMapId() === map.id
                          ? "border-amber-400 bg-amber-500/20 text-white"
                          : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      {map.name}
                    </button>
                  )}
                </For>
              </div>
              <button
                onClick={handleStartGame}
                disabled={!canStart()}
                class="w-full px-6 py-3 rounded-xl bg-game-gold hover:bg-amber-400 text-game-darker font-bold text-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {starting()
                  ? "Lancement..."
                  : `Lancer la partie (${playerCount()} joueurs)`}
              </button>
              <Show when={playerCount() < 2}>
                <p class="text-center text-sm text-slate-400 mt-2">
                  Au moins 2 joueurs requis pour commencer.
                </p>
              </Show>
            </div>
          </Show>

          {/* Non-host: waiting */}
          <Show when={!amHost()}>
            <div class="text-center text-slate-200/70">
              En attente du lancement par l'h&ocirc;te...
            </div>
          </Show>
        </div>
      </main>
    </div>
  );
};
