import {
  Component,
  createSignal,
  createEffect,
  onMount,
  For,
  Show,
} from "solid-js";
import { ArrowLeft, Copy, Check } from "lucide-solid";
import { sessionState, isHost, clearSession } from "../stores/session.store";
import { PlayerRole } from "../types/multiplayer";
import {
  selectCharacter,
  selectDefaultTemplate,
  startGame as startGameHub,
  leaveSession,
} from "../services/signalr/multiplayer.service";
import {
  CharacterService,
  type CharacterDto,
} from "../services/character.service";
import { getAllMaps, loadMap as loadMapLocal } from "../services/mapStorage";
import { MapService } from "../services/map.service";
import type { GameStartedPayload } from "../types/multiplayer";
import { safeConfirm } from "../services/ui/confirm";

interface LobbyScreenProps {
  onGameStart: (payload: GameStartedPayload) => void;
  onLeave: () => void;
}

export const LobbyScreen: Component<LobbyScreenProps> = (props) => {
  const [characters, setCharacters] = createSignal<CharacterDto[]>([]);
  const [selectedCharId, setSelectedCharId] = createSignal<string | null>(null);
  type DefaultTemplate = "warrior" | "mage" | "archer";
  const [selectedTemplate, setSelectedTemplate] =
    createSignal<DefaultTemplate | null>(null);
  const [maps, setMaps] = createSignal<Array<{ id: string; name: string }>>([]);
  const [selectedMapId, setSelectedMapId] = createSignal<string | null>(null);
  const [copied, setCopied] = createSignal(false);
  const [starting, setStarting] = createSignal(false);
  const [startError, setStartError] = createSignal<string | null>(null);

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
    setSelectedTemplate(null);
    try {
      await selectCharacter(charId);
    } catch (err) {
      console.warn("[Lobby] selectCharacter failed:", err);
    }
  };

  const handleTemplateSelect = async (template: DefaultTemplate) => {
    // Toggle off if the same preset is tapped twice.
    const next: DefaultTemplate | null =
      selectedTemplate() === template ? null : template;
    setSelectedTemplate(next);
    setSelectedCharId(null);
    try {
      await selectDefaultTemplate(next);
    } catch (err) {
      console.warn("[Lobby] selectDefaultTemplate failed:", err);
    }
  };

  const DEFAULT_TEMPLATES: Array<{
    id: DefaultTemplate;
    label: string;
    blurb: string;
  }> = [
    { id: "warrior", label: "⚔️ Guerrier", blurb: "120 PV · mêlée puissante" },
    { id: "mage", label: "🔮 Mage", blurb: "80 PV · dégâts à distance" },
    {
      id: "archer",
      label: "🏹 Archer",
      blurb: "100 PV · mobile, longue portée",
    },
  ];

  const handleStartGame = async () => {
    setStartError(null);
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
      // Campaign sessions only: auto-push the chosen map to the campaign's
      // server-side map pool so the DM's "Cartes" tab is populated straight
      // away, without needing the manual "Importer mes cartes locales" step.
      // Best-effort — any failure here is swallowed so the game still starts.
      const session = sessionState.session;
      if (session?.campaignId && mapId && mapId !== "default") {
        await maybePushMapToCampaign(session.campaignId, mapId);
      }
      await startGameHub(mapId ?? "default");
    } catch (err: any) {
      console.error("[Lobby] startGame failed:", err);
      setStartError(
        err?.message ??
          err?.toString?.() ??
          "Impossible de lancer la partie (erreur inconnue).",
      );
      setStarting(false);
    }
  };

  /** Upload the local map to the campaign if the server doesn't already have
   * one with the same name. Never throws — the start-game flow proceeds on
   * any error. */
  async function maybePushMapToCampaign(
    campaignId: string,
    mapId: string,
  ): Promise<void> {
    try {
      const local = loadMapLocal(mapId);
      if (!local) return;
      const existing = await MapService.list(campaignId);
      const alreadyThere = existing.some(
        (m) => m.name.toLowerCase() === local.name.toLowerCase(),
      );
      if (alreadyThere) return;
      await MapService.create(campaignId, {
        name: local.name,
        data: JSON.stringify(local),
      });
    } catch (err) {
      console.warn(
        "[Lobby] maybePushMapToCampaign: best-effort seed failed",
        err,
      );
    }
  }

  const handleLeave = async () => {
    try {
      await leaveSession();
    } catch (err) {
      // leaveSession calls clearSession after a successful hub invoke; if the
      // hub throws we still want local state cleaned up, otherwise the user
      // ends up on the menu screen with a ghost session banner. Log for dev
      // visibility; clear unconditionally.
      console.warn(
        "[Lobby] leaveSession hub call failed, clearing local state",
        err,
      );
      clearSession();
    }
    props.onLeave();
  };

  const playerCount = () => session()?.players.length ?? 0;
  const MIN_PLAYERS_TO_START = 2;
  // Allow host (DM) to force-start alone for testing
  const canStart = () =>
    (amHost() || playerCount() >= MIN_PLAYERS_TO_START) && !starting();

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
                      <span class="sr-only">
                        {player.status === "Connected"
                          ? "Connecté"
                          : "Déconnecté"}
                      </span>
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

          {/* Character Selection — not shown to the DM. The host is a pure overseer
              and intentionally has no token on the board; picking a character would
              be a no-op after the backend filters DM assignments out of the game. */}
          <Show when={!amHost()}>
            <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-brandStart/80 to-brandEnd/80 backdrop-blur-sm p-6">
              <h3 class="font-display text-xl text-white mb-4">
                Votre personnage
              </h3>

              {/* Quickstart presets — no persisted character required. Each preset
                  maps server-side to a different class with its own stats
                  (BuildDefaultAssignment in GameHub). */}
              <p class="text-xs text-white/60 uppercase tracking-wider mb-2">
                Départ rapide
              </p>
              <div class="grid grid-cols-3 gap-2 mb-4">
                <For each={DEFAULT_TEMPLATES}>
                  {(tpl) => (
                    <button
                      onClick={() => handleTemplateSelect(tpl.id)}
                      class={`flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-lg border text-left transition ${
                        selectedTemplate() === tpl.id
                          ? "border-amber-400 bg-amber-500/20 text-white"
                          : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      <span class="text-sm font-semibold">{tpl.label}</span>
                      <span class="text-[10px] text-white/60">{tpl.blurb}</span>
                    </button>
                  )}
                </For>
              </div>

              <Show when={characters().length > 0}>
                <p class="text-xs text-white/60 uppercase tracking-wider mb-2">
                  Mes personnages
                </p>
                <div class="space-y-2">
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
                            {char.class} Nv.{char.level} - {char.maxHitPoints}{" "}
                            PV
                          </span>
                        </div>
                      </button>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </Show>

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
              <Show when={playerCount() < MIN_PLAYERS_TO_START && !amHost()}>
                <p class="text-center text-sm text-slate-400 mt-2">
                  Au moins {MIN_PLAYERS_TO_START} joueur
                  {MIN_PLAYERS_TO_START > 1 ? "s" : ""} requis pour commencer.
                </p>
              </Show>
              <Show when={startError()}>
                <p class="text-center text-sm text-red-200 mt-3" role="alert">
                  {startError()}
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
