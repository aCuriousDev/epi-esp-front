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
import { PlayerRole, type PlayerInfo } from "../types/multiplayer";
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
import { fetchMine, loadMap as loadMapLocal } from "../services/mapRepository";
import { MapService } from "../services/map.service";
import type { GameStartedPayload } from "../types/multiplayer";
import { safeConfirm } from "../services/ui/confirm";
import { PlayerSelfInspectModal } from "./hotbar/PlayerSelfInspectModal";

interface LobbyScreenProps {
  onGameStart: (payload: GameStartedPayload) => void;
  onLeave: () => void;
}

const TEMPLATE_LABELS: Record<string, string> = {
  warrior: "Warrior (default)",
  mage: "Mage (default)",
  archer: "Archer (default)",
};

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

  // Cached character details for every player in the lobby. Lazy-loaded as
  // players pick a character so the row can render "Name · Class · Lvl X"
  // instead of the bare GUID, and so the inspect modal opens instantly.
  const [playerCharacters, setPlayerCharacters] = createSignal<
    Record<string, CharacterDto>
  >({});
  // Set of character ids whose fetch has been attempted but failed (typically
  // perms — viewing another player's sheet may be forbidden). Stops the
  // effect from re-fetching forever.
  const [failedCharIds, setFailedCharIds] = createSignal<Set<string>>(new Set());

  const [inspectedPlayerId, setInspectedPlayerId] = createSignal<string | null>(
    null,
  );

  onMount(async () => {
    try {
      const chars = await CharacterService.getMyCharacters();
      setCharacters(chars);
    } catch {
      // No characters available
    }

    fetchMine().then(allMaps => setMaps(allMaps));
  });

  // React to gameStartedPayload
  createEffect(() => {
    const payload = sessionState.gameStartedPayload;
    if (payload) {
      props.onGameStart(payload);
    }
  });

  // Fetch character details for every player who has selected a real
  // (non-template) character. Best-effort: failures are remembered so we
  // don't loop. Endpoint may forbid viewing other users' characters; the
  // row + modal degrade gracefully when so.
  createEffect(() => {
    const players = session()?.players ?? [];
    const cache = playerCharacters();
    const failed = failedCharIds();
    const toFetch = players
      .map((p) => p.selectedCharacterId)
      .filter(
        (id): id is string =>
          !!id && !cache[id] && !failed.has(id),
      );
    if (toFetch.length === 0) return;
    void Promise.all(
      toFetch.map(async (id) => {
        try {
          const data = await CharacterService.getCharacter(id);
          return { id, data, ok: true as const };
        } catch (err) {
          console.warn("[Lobby] getCharacter failed for", id, err);
          return { id, data: null, ok: false as const };
        }
      }),
    ).then((results) => {
      setPlayerCharacters((prev) => {
        const next = { ...prev };
        for (const r of results) if (r.ok && r.data) next[r.id] = r.data;
        return next;
      });
      setFailedCharIds((prev) => {
        const next = new Set(prev);
        for (const r of results) if (!r.ok) next.add(r.id);
        return next;
      });
    });
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
    if (!mapId && !safeConfirm("No map selected. Use the default map?")) return;
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

  /** Short summary shown next to a player's name in the lobby list. Prefers
   *  fetched class+level, falls back to template label, then to the bare
   *  selectedCharacterName, then to "No character". */
  const playerSummary = (player: PlayerInfo): string => {
    if (player.role === PlayerRole.DungeonMaster) return "Dungeon Master";
    const charId = player.selectedCharacterId;
    if (charId) {
      const c = playerCharacters()[charId];
      if (c) return `${c.name} · ${c.class} · Lvl ${c.level}`;
      return player.selectedCharacterName ?? "Loading…";
    }
    if (player.selectedDefaultTemplate) {
      return TEMPLATE_LABELS[player.selectedDefaultTemplate] ?? "Default character";
    }
    return "No character selected";
  };

  const inspectedPlayer = (): PlayerInfo | null => {
    const id = inspectedPlayerId();
    if (!id) return null;
    return session()?.players.find((p) => p.userId === id) ?? null;
  };

  return (
    <div class="relative min-h-screen w-full overflow-hidden bg-brand-gradient">
      <div class="vignette absolute inset-0" />

      <button
        onClick={handleLeave}
        class="in-game-back-btn !fixed !top-4 !left-4 !right-auto"
        aria-label="Leave room"
      >
        <ArrowLeft class="w-5 h-5 text-white" />
      </button>

      <main class="relative z-10 flex min-h-screen items-center justify-center p-6 sm:p-10">
        <div class="max-w-3xl w-full space-y-6">
          {/* Room Code */}
          <div class="text-center">
            <p class="text-slate-200/70 text-sm mb-2">Room code</p>
            <div class="inline-flex items-center gap-3 bg-black/30 backdrop-blur-sm rounded-xl px-6 py-3 border border-white/10">
              <span class="font-mono text-3xl sm:text-4xl tracking-[0.3em] text-white font-bold">
                {session()?.joinCode ?? session()?.sessionId ?? "..."}
              </span>
              <button
                onClick={copyCode}
                class="p-2 rounded-lg hover:bg-white/10 transition text-slate-300 hover:text-white"
                title="Copy code"
                aria-label="Copy room code"
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
              Players ({playerCount()}/{session()?.maxPlayers ?? "?"})
            </h3>
            <div class="space-y-2">
              <For each={session()?.players ?? []}>
                {(player) => {
                  const isDm = player.role === PlayerRole.DungeonMaster;
                  const clickable = !isDm;
                  const open = () =>
                    clickable && setInspectedPlayerId(player.userId);
                  return (
                    <div
                      role={clickable ? "button" : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      onClick={open}
                      onKeyDown={(e) => {
                        if (clickable && (e.key === "Enter" || e.key === " ")) {
                          e.preventDefault();
                          open();
                        }
                      }}
                      class={`flex items-center justify-between rounded-lg px-4 py-3 border ${
                        clickable
                          ? "bg-white/5 border-white/5 cursor-pointer hover:bg-white/10 hover:border-white/15 focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                          : "bg-white/5 border-white/5"
                      }`}
                      title={clickable ? "View character sheet" : undefined}
                    >
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
                        <Show when={isDm}>
                          <span class="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Host
                          </span>
                        </Show>
                      </div>
                      <span class="text-sm text-slate-300/80">
                        {playerSummary(player)}
                      </span>
                    </div>
                  );
                }}
              </For>
            </div>
          </div>

          {/* Character Selection — not shown to the DM. The host is a pure overseer
              and intentionally has no token on the board; picking a character would
              be a no-op after the backend filters DM assignments out of the game. */}
          <Show when={!amHost()}>
            <div class="rounded-2xl border border-white/10 bg-gradient-to-br from-brandStart/80 to-brandEnd/80 backdrop-blur-sm p-6">
              <h3 class="font-display text-xl text-white mb-4">
                Your character
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
              <h3 class="font-display text-xl text-white mb-4">Map</h3>
              <div class="space-y-2 mb-6 max-h-40 overflow-y-auto">
                <button
                  onClick={() => setSelectedMapId(null)}
                  class={`w-full text-left px-4 py-2 rounded-lg border transition text-sm ${
                    selectedMapId() === null
                      ? "border-amber-400 bg-amber-500/20 text-white"
                      : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  Default map
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
                  ? "Starting..."
                  : `Start game (${playerCount()} players)`}
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
              Waiting for the host to start...
            </div>
          </Show>
        </div>
      </main>

      {/* Inspect modal — opened by clicking any non-DM player row. Renders
          character-only sheet (no live PV/PA bars, since no game session yet). */}
      <PlayerSelfInspectModal
        open={!!inspectedPlayer()}
        onClose={() => setInspectedPlayerId(null)}
        unit={null}
        characterId={inspectedPlayer()?.selectedCharacterId ?? null}
        title={
          inspectedPlayer()
            ? `${inspectedPlayer()!.userName} — Character sheet`
            : "Character sheet"
        }
        fallbackName={inspectedPlayer()?.userName}
      />
    </div>
  );
};
