import {
  Component,
  createEffect,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from 'solid-js';
import { useNavigate, useParams, useSearchParams } from '@solidjs/router';
import { Copy, Check, Play, Loader2, Users, UserCircle2, Zap, Map as MapIcon } from 'lucide-solid';
import { sessionState, isHost, clearSession } from '@/stores/session.store';
import { PlayerRole, SessionState } from '@/types/multiplayer';
import {
  selectCharacter,
  selectDefaultTemplate,
  startGame as startGameHub,
  joinCampaignSession,
  leaveSession,
} from '@/services/signalr/multiplayer.service';
import { CharacterService, CharacterClass, type CharacterDto } from '@/services/character.service';
import { CampaignService, GameSessionStatus, type GameSessionResponse } from '@/services/campaign.service';
import { MapService, type CampaignMapRecord } from '@/services/map.service';
import { ensureMapCached } from '@/services/mapRepository';
import { signalRService } from '@/services/signalr/SignalRService';
import { authStore } from '@/stores/auth.store';
import { ensureMultiplayerHandlersRegistered } from '@/services/signalr/multiplayer.service';
import { useGameShellExit } from '@/layouts/GameShell';

// ── Personnages par défaut (non liés à un utilisateur) ────────────────────────
const DEFAULT_CHARACTERS = [
  {
    id: 'archer' as const,
    label: 'Archer',
    subtitle: 'Rôdeur · Nv.1',
    description: 'Expert des distances. Agile et précis.',
    emoji: '🏹',
    consumables: ['Flèches (×20)', 'Potion de soin'],
    accent: '#4ade80',
    border: '#22c55e',
    bg: 'rgba(5,46,22,0.65)',
  },
  {
    id: 'warrior' as const,
    label: 'Chevalier',
    subtitle: 'Guerrier · Nv.1',
    description: 'Combattant robuste, bouclier de l\'équipe.',
    emoji: '⚔️',
    consumables: ['Potion de soin (×2)'],
    accent: '#f87171',
    border: '#ef4444',
    bg: 'rgba(42,9,9,0.65)',
  },
  {
    id: 'mage' as const,
    label: 'Mage',
    subtitle: 'Magicien · Nv.1',
    description: 'Maître des arcanes, puissant mais fragile.',
    emoji: '🔮',
    consumables: ['Parchemin (Boule de feu)', 'Potion de mana'],
    accent: '#a78bfa',
    border: '#8b5cf6',
    bg: 'rgba(28,19,51,0.65)',
  },
] as const;

type DefaultId = (typeof DEFAULT_CHARACTERS)[number]['id'];

// ── Sélection persistée ───────────────────────────────────────────────────────
type SavedSelection =
  | { kind: 'character'; id: string }
  | { kind: 'default'; id: DefaultId };

function selStorageKey(campaignId: string, userId: string) {
  return `dnd-char-${campaignId}-${userId}`;
}
function loadSavedSelection(campaignId: string, userId: string): SavedSelection | null {
  try {
    const raw = localStorage.getItem(selStorageKey(campaignId, userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedSelection;
    if (parsed.kind === 'character' || parsed.kind === 'default') return parsed;
    return null;
  } catch { return null; }
}
function saveSelection(campaignId: string, userId: string, sel: SavedSelection) {
  try {
    localStorage.setItem(selStorageKey(campaignId, userId), JSON.stringify(sel));
  } catch {}
}

// ── Emoji par classe ──────────────────────────────────────────────────────────
function classEmoji(cls: CharacterClass): string {
  if (cls === CharacterClass.Magicien || cls === CharacterClass.Sorcier || cls === CharacterClass.Ensorceleur) return '🔮';
  if (cls === CharacterClass.Rodeur  || cls === CharacterClass.Voleur)  return '🏹';
  if (cls === CharacterClass.Guerrier || cls === CharacterClass.Paladin || cls === CharacterClass.Barbare) return '⚔️';
  if (cls === CharacterClass.Clerc || cls === CharacterClass.Druide)  return '✨';
  if (cls === CharacterClass.Barde)  return '🎵';
  return '🧙';
}

// ── Component ─────────────────────────────────────────────────────────────────
const CampaignLobbyPage: Component = () => {
  const params  = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  /** true quand le lobby a été ouvert via le bouton "Quick Launch" */
  const quickLaunch = () => searchParams.quickLaunch === '1';

  const [characters,   setCharacters]   = createSignal<CharacterDto[]>([]);
  const [loadingChars, setLoadingChars] = createSignal(true);

  // ── Quick launch — sélection de carte ────────────────────────────────────────
  const [campaignMaps,      setCampaignMaps]      = createSignal<CampaignMapRecord[]>([]);
  const [loadingMaps,       setLoadingMaps]       = createSignal(false);
  /** mapId sélectionnée par le MJ pour le quick launch ('default' = grille proc.) */
  const [quickLaunchMapId,  setQuickLaunchMapId]  = createSignal<string>('default');

  // active selection — either a real char id or a default template id
  const [selCharId,    setSelCharId]    = createSignal<string | null>(null);
  const [selDefaultId, setSelDefaultId] = createSignal<DefaultId | null>(null);

  const [copied,   setCopied]   = createSignal(false);
  const [starting, setStarting] = createSignal(false);

  // Active session déjà en cours (détecté via REST au chargement)
  const [activeSession,    setActiveSession]    = createSignal<GameSessionResponse | null>(null);
  const [joiningActive,    setJoiningActive]    = createSignal(false);
  const [joinActiveError,  setJoinActiveError]  = createSignal<string | null>(null);

  const session   = () => sessionState.session;
  const amHost    = () => isHost();
  const players   = () => session()?.players ?? [];
  const myUserId  = () => authStore.user()?.id ?? '';

  const stalePayload = sessionState.gameStartedPayload;

  // ── Mount ───────────────────────────────────────────────────────────────────
  onMount(async () => {
    if (!signalRService.isConnected) {
      await signalRService.connect();
    }
    // Toujours appeler, pas seulement si on vient de se connecter.
    // Si les handlers ont été réinitialisés (leaveSession / SessionEnded),
    // GameStarted ne serait pas traité → setGameStarted jamais appelé →
    // createEffect jamais déclenché → bouton "Lancement…" bloqué indéfiniment.
    ensureMultiplayerHandlersRegistered();

    // Vérifier si une session est déjà en cours pour cette campagne.
    // On n'affiche le bandeau que si la session a une progression réelle
    // (currentNodeId défini OU au moins une entrée d'historique).
    // Les sessions status=Active sans progression sont des sessions fantômes
    // créées par CampaignSessionPage mais jamais jouées.
    try {
      const sessionsRes = await CampaignService.listSessions(params.id);
      // On cherche les sessions actives avec progression réelle.
      // Le lancement rapide utilise désormais createRoom (pas de session DB),
      // donc les sessions sans progression sont des sessions fantômes à ignorer.
      const running = sessionsRes.items.find(
        s => s.status === GameSessionStatus.Active &&
             (!!s.currentNodeId || s.entries.length > 0)
      );
      if (running) setActiveSession(running);
    } catch {
      // Non-critique
    }

    // ── Quick launch : charger les cartes de la campagne pour le MJ ────────────
    if (quickLaunch() && isHost()) {
      setLoadingMaps(true);
      try {
        const maps = await MapService.list(params.id);
        setCampaignMaps(maps);
        // Pré-sélectionner la première carte si disponible
        if (maps.length > 0) setQuickLaunchMapId(maps[0].id);
      } catch {
        // Non-critique — la carte par défaut reste sélectionnée
      } finally {
        setLoadingMaps(false);
      }
    }

    try {
      const chars = await CharacterService.getMyCharacters();
      setCharacters(chars);

      // Restore persisted selection
      const saved = loadSavedSelection(params.id, myUserId());
      if (saved?.kind === 'character' && chars.some(c => c.id === saved.id)) {
        setSelCharId(saved.id);
        await selectCharacter(saved.id).catch(() => {});
      } else if (saved?.kind === 'default') {
        setSelDefaultId(saved.id);
        await selectDefaultTemplate(saved.id).catch(() => {});
      }
    } catch (e) {
      console.warn('[CampaignLobby] Failed to load characters:', e);
    } finally {
      setLoadingChars(false);
    }
  });

  // Wire the GameShell Exit button to leave the multiplayer session before
  // navigating away. Plain history-back would orphan the user as a "ghost"
  // participant on the server side until the hub eventually times them out.
  const exitApi = useGameShellExit();
  const handleLobbyExit = async () => {
    try {
      await leaveSession();
    } catch (err) {
      console.warn('[CampaignLobby] leaveSession hub call failed, clearing local state', err);
      clearSession();
    }
    navigate(`/campaigns/${params.id}`, { replace: true });
  };
  onMount(() => {
    exitApi.setExitHandler(handleLobbyExit);
    onCleanup(() => exitApi.setExitHandler(null));
  });

  // Quand le MJ lance la session → tout le monde navigue vers la page session.
  // Guard against stalePayload: only react to a payload that arrived AFTER
  // this component mounted (reference inequality with the snapshot above).
  createEffect(() => {
    const payload = sessionState.gameStartedPayload;
    if (payload && payload !== stalePayload) {
      if (payload.mapId === 'campaign') {
        // Flux scénario classique → CampaignSessionPage (arbre de blocs)
        navigate(`/campaigns/${params.id}/session`);
      } else {
        // Quick launch (ou lancement direct de carte) → board directement
        // BoardGame détectera la session InProgress et appellera
        // onMultiplayerGameStart avec le payload pour démarrer le jeu.
        navigate('/practice/session');
      }
    }
  });

  // ── Handlers ────────────────────────────────────────────────────────────────
  const copyCode = () => {
    const code = session()?.joinCode ?? session()?.sessionId;
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSelectChar = async (charId: string) => {
    setSelCharId(charId);
    setSelDefaultId(null);
    saveSelection(params.id, myUserId(), { kind: 'character', id: charId });
    try { await selectCharacter(charId); }
    catch (e) { console.warn('[CampaignLobby] selectCharacter failed:', e); }
  };

  const handleSelectDefault = async (id: DefaultId) => {
    setSelDefaultId(id);
    setSelCharId(null);
    saveSelection(params.id, myUserId(), { kind: 'default', id });
    try { await selectDefaultTemplate(id); }
    catch (e) { console.warn('[CampaignLobby] selectDefaultTemplate failed:', e); }
  };

  const handleStartSession = async () => {
    if (starting()) return;
    setStarting(true);
    try {
      if (quickLaunch()) {
        // Quick launch : démarrer directement avec la carte choisie.
        // S'assurer que la carte est en cache localStorage avant que
        // startGame ne l'envoie dans le payload GameStarted.
        const mapId = quickLaunchMapId();
        if (mapId !== 'default') {
          await ensureMapCached(mapId, params.id);
        }
        await startGameHub(mapId);
      } else {
        // Flux scénario classique (arbre de blocs)
        await startGameHub('campaign');
      }
      // startGameHub réussit → le serveur va envoyer GameStarted → createEffect navigue.
      // Timeout de sécurité : si GameStarted n'arrive pas en 8 s (handler manquant,
      // problème réseau), on réactive le bouton pour que le DM puisse réessayer.
      setTimeout(() => {
        setStarting(prev => {
          if (prev) console.warn('[CampaignLobby] GameStarted not received in time — resetting start button');
          return false;
        });
      }, 8_000);
    } catch (err: any) {
      console.error('[CampaignLobby] startGame failed:', err);
      setStarting(false);
    }
  };

  /** Rejoindre la session active détectée au chargement */
  const handleJoinActiveSession = async () => {
    setJoinActiveError(null);
    setJoiningActive(true);
    try {
      const res = await joinCampaignSession(params.id);
      if (!res.success) {
        // Plus de session SignalR active (terminée entre-temps) → masquer le bandeau.
        if (res.message?.toLowerCase().includes('aucune session')) {
          setActiveSession(null);
        } else {
          setJoinActiveError(res.message ?? 'Impossible de rejoindre la session.');
        }
        return;
      }
      // Ne pas naviguer immédiatement : laisser le createEffect réagir à GameStarted.
      // - Si la session SignalR est InProgress : SendRejoinSnapshotAsync rejoue GameStarted → createEffect navigue.
      // - Si la session est en Lobby : le joueur reste dans le lobby et attend que le MJ clique "Démarrer".
      // Naviguer ici contournait l'attente du MJ et envoyait le joueur sur un nœud issu d'une session solo.
    } catch (e: any) {
      setJoinActiveError(e?.message ?? 'Impossible de rejoindre la session.');
    } finally {
      setJoiningActive(false);
    }
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const hasSelection = () => !!(selCharId() || selDefaultId());

  const allPlayersReady = () =>
    players().length > 0 &&
    players().every(
      p => p.role === PlayerRole.DungeonMaster || !!(p.selectedCharacterId || p.selectedDefaultTemplate),
    );

  const playerLabel = (p: ReturnType<typeof players>[number]) => {
    if (p.selectedCharacterName) return p.selectedCharacterName;
    if (p.selectedDefaultTemplate) {
      const d = DEFAULT_CHARACTERS.find(c => c.id === p.selectedDefaultTemplate);
      return d ? `${d.emoji} ${d.label}` : p.selectedDefaultTemplate;
    }
    return null;
  };

  // ── JSX ─────────────────────────────────────────────────────────────────────
  return (
    <div class="w-full h-full overflow-y-auto" style={{ color: '#d4d4d4', 'font-family': 'system-ui, -apple-system, sans-serif' }}>
      {/* Lobby header — room code + campaign name */}
      <header class="sticky top-0 z-20 flex items-center justify-between pl-16 sm:pl-20 pr-16 sm:pr-20 py-4 border-b border-white/10 bg-black/40 backdrop-blur-md">
        <div class="text-center">
          <p class="text-xs text-purple-400 uppercase tracking-wider font-medium">
            {quickLaunch() ? '⚡ Lancement rapide' : 'Salle d\'attente'}
          </p>
          <h1 class="font-display text-lg text-white">{session()?.campaignName ?? 'Campagne'}</h1>
        </div>
        <button onClick={copyCode}
          class="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-slate-300 transition-all"
          title="Copier le code">
          <span class="font-mono tracking-widest text-white font-bold">
            {session()?.joinCode ?? session()?.sessionId?.slice(0, 8) ?? '...'}
          </span>
          <Show when={copied()} fallback={<Copy class="w-3.5 h-3.5" />}>
            <Check class="w-3.5 h-3.5 text-green-400" />
          </Show>
        </button>
      </header>

      <main class="max-w-2xl mx-auto px-4 py-10 space-y-6">

        {/* ── Banner : session déjà en cours ──────────────────────────────── */}
        <Show when={activeSession()}>
          <div class="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 overflow-hidden shadow-lg shadow-emerald-500/10">
            {/* Barre animée */}
            <div class="h-1 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 animate-pulse" />

            <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5">
              {/* Icône + texte */}
              <div class="flex items-center gap-4 flex-1 min-w-0">
                <div class="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <Zap class="w-6 h-6 text-emerald-400" />
                </div>
                <div class="min-w-0">
                  <p class="text-emerald-300 font-semibold text-sm uppercase tracking-wider mb-0.5">
                    Session en cours
                  </p>
                  <p class="text-white font-semibold text-base leading-tight">
                    Une session est déjà active pour cette campagne
                  </p>
                  <p class="text-slate-400 text-sm mt-0.5">
                    Rejoignez la partie en cours directement
                  </p>
                </div>
              </div>

              {/* Bouton rejoindre */}
              <div class="flex flex-col items-end gap-2 shrink-0">
                <button
                  onClick={handleJoinActiveSession}
                  disabled={joiningActive()}
                  class="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Show when={!joiningActive()} fallback={<Loader2 class="w-4 h-4 animate-spin" />}>
                    <Play class="w-4 h-4" />
                  </Show>
                  {joiningActive() ? 'Connexion…' : 'Rejoindre la session'}
                </button>
                <Show when={joinActiveError()}>
                  <p class="text-red-400 text-xs" role="alert">{joinActiveError()}</p>
                </Show>
              </div>
            </div>
          </div>
        </Show>

        {/* Joueurs */}
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
                    <div class={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${player.status === 'Connected' ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                    <span class="text-white font-medium">{player.userName}</span>
                    <Show when={player.role === PlayerRole.DungeonMaster}>
                      <span class="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">MJ</span>
                    </Show>
                  </div>
                  <Show when={player.role !== PlayerRole.DungeonMaster}
                    fallback={<span class="text-xs text-amber-400/70 italic">Maître du Jeu</span>}>
                    <Show when={playerLabel(player)}
                      fallback={
                        <span class="text-xs text-slate-500 italic flex items-center gap-1">
                          <Loader2 class="w-3 h-3 animate-spin" /> Sélection…
                        </span>
                      }>
                      <span class="text-sm font-medium text-purple-300">{playerLabel(player)}</span>
                    </Show>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </section>

        {/* Sélection du personnage — joueurs uniquement */}
        <Show when={!amHost()}>
          <section class="bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <div class="flex items-center gap-2 mb-5">
              <UserCircle2 class="w-5 h-5 text-purple-400" />
              <h2 class="font-display text-xl text-white">Choisissez votre personnage</h2>
            </div>

            {/* ── Personnages par défaut ── */}
            <div class="mb-6">
              <p class="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-3">
                Personnages par défaut
              </p>
              <div class="grid grid-cols-3 gap-3">
                <For each={DEFAULT_CHARACTERS}>
                  {(def) => {
                    const isSelected = () => selDefaultId() === def.id;
                    return (
                      <button
                        onClick={() => handleSelectDefault(def.id)}
                        style={{
                          background: isSelected() ? def.bg : 'rgba(255,255,255,0.03)',
                          border: `2px solid ${isSelected() ? def.border : 'rgba(255,255,255,0.08)'}`,
                          'border-radius': '0.875rem',
                          padding: '1rem 0.75rem',
                          cursor: 'pointer',
                          transition: 'all 0.18s',
                          'text-align': 'center',
                          display: 'flex',
                          'flex-direction': 'column',
                          'align-items': 'center',
                          gap: '0.375rem',
                          'box-shadow': isSelected() ? `0 0 16px ${def.border}44` : 'none',
                        }}
                        onMouseEnter={(e) => { if (!isSelected()) e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
                        onMouseLeave={(e) => { if (!isSelected()) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                      >
                        <span style={{ 'font-size': '2rem', 'line-height': 1 }}>{def.emoji}</span>
                        <span style={{ 'font-weight': '700', 'font-size': '0.9rem', color: isSelected() ? def.accent : '#e2e8f0' }}>
                          {def.label}
                        </span>
                        <span style={{ 'font-size': '0.7rem', color: '#94a3b8' }}>{def.subtitle}</span>
                        <div style={{ 'font-size': '0.65rem', color: '#64748b', 'margin-top': '0.25rem', 'text-align': 'left', width: '100%' }}>
                          <For each={def.consumables}>
                            {(c) => <div>· {c}</div>}
                          </For>
                        </div>
                        <Show when={isSelected()}>
                          <span style={{
                            'font-size': '0.65rem', 'font-weight': '600',
                            color: def.accent, background: `${def.border}20`,
                            border: `1px solid ${def.border}50`,
                            'border-radius': '9999px', padding: '0.15rem 0.6rem',
                            'margin-top': '0.25rem',
                          }}>✓ Sélectionné</span>
                        </Show>
                      </button>
                    );
                  }}
                </For>
              </div>
              <p class="text-xs text-slate-600 mt-2">Pas d'or · Pas d'inventaire · Consommables uniquement</p>
            </div>

            {/* ── Personnages de l'utilisateur ── */}
            <div>
              <p class="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-3">
                Mes personnages
              </p>

              <Show when={loadingChars()}>
                <div class="flex items-center gap-3 py-4 text-slate-400 text-sm">
                  <Loader2 class="w-4 h-4 animate-spin text-purple-400" />
                  Chargement…
                </div>
              </Show>

              <Show when={!loadingChars() && characters().length === 0}>
                <p class="text-slate-500 text-sm italic py-2">
                  Aucun personnage créé — utilisez un personnage par défaut ou créez-en un depuis votre profil.
                </p>
              </Show>

              <Show when={!loadingChars() && characters().length > 0}>
                <div class="space-y-2">
                  <For each={characters()}>
                    {(char) => {
                      const isSelected = () => selCharId() === char.id;
                      return (
                        <button
                          onClick={() => handleSelectChar(char.id)}
                          class={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                            isSelected()
                              ? 'border-purple-500 bg-purple-500/15 shadow-lg shadow-purple-500/10'
                              : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                          }`}
                        >
                          <div class="flex items-center justify-between gap-4">
                            <div class="flex items-center gap-3 min-w-0">
                              <div class={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg ${
                                isSelected() ? 'bg-purple-500/30 border border-purple-500/50' : 'bg-white/5 border border-white/10'
                              }`}>
                                {classEmoji(char.class)}
                              </div>
                              <div class="min-w-0">
                                <p class={`font-semibold truncate ${isSelected() ? 'text-white' : 'text-slate-200'}`}>
                                  {char.name}
                                </p>
                                <p class="text-xs text-slate-400">{char.race} · {char.class} · Nv.{char.level}</p>
                              </div>
                            </div>
                            <div class="flex items-center gap-3 shrink-0 text-xs text-slate-400">
                              <span title="PV">❤️ {char.currentHitPoints}/{char.maxHitPoints}</span>
                              <span title="CA">🛡️ {char.armorClass}</span>
                              <Show when={isSelected()}>
                                <span class="text-purple-300 font-bold">✓</span>
                              </Show>
                            </div>
                          </div>
                        </button>
                      );
                    }}
                  </For>
                </div>
              </Show>
            </div>

            {/* Statut de sélection */}
            <div class="mt-4 text-center text-sm">
              <Show when={!hasSelection()}>
                <p class="text-amber-400/80">⚠️ Sélectionnez un personnage avant le début de la partie.</p>
              </Show>
              <Show when={hasSelection()}>
                <p class="text-emerald-400/80">✓ Personnage retenu — votre sélection est sauvegardée pour cette campagne.</p>
              </Show>
            </div>
          </section>
        </Show>

        {/* Quick Launch — sélection de carte (MJ uniquement) */}
        <Show when={amHost() && quickLaunch()}>
          <section class="bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <div class="flex items-center gap-2 mb-4">
              <MapIcon class="w-5 h-5 text-blue-400" />
              <h2 class="font-display text-xl text-white">Choisir une carte</h2>
            </div>

            <Show when={loadingMaps()}>
              <div class="flex items-center gap-2 text-slate-400 text-sm py-2">
                <Loader2 class="w-4 h-4 animate-spin text-blue-400" />
                Chargement des cartes…
              </div>
            </Show>

            <Show when={!loadingMaps()}>
              <div class="space-y-2">
                {/* Option : carte par défaut (grille procédurale) */}
                <button
                  onClick={() => setQuickLaunchMapId('default')}
                  class={`w-full text-left rounded-xl border-2 px-4 py-3 transition-all flex items-center gap-3 ${
                    quickLaunchMapId() === 'default'
                      ? 'border-blue-500 bg-blue-500/15 shadow shadow-blue-500/10'
                      : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <span class="text-lg">🗺️</span>
                  <div>
                    <span class={`font-medium ${quickLaunchMapId() === 'default' ? 'text-white' : 'text-slate-200'}`}>
                      Carte par défaut
                    </span>
                    <p class="text-xs text-slate-500">Grille procédurale</p>
                  </div>
                  <Show when={quickLaunchMapId() === 'default'}>
                    <span class="ml-auto text-blue-400 font-bold text-sm">✓</span>
                  </Show>
                </button>

                {/* Cartes de la campagne */}
                <For each={campaignMaps()}>
                  {(map) => (
                    <button
                      onClick={() => setQuickLaunchMapId(map.id)}
                      class={`w-full text-left rounded-xl border-2 px-4 py-3 transition-all flex items-center gap-3 ${
                        quickLaunchMapId() === map.id
                          ? 'border-blue-500 bg-blue-500/15 shadow shadow-blue-500/10'
                          : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                      }`}
                    >
                      <span class="text-lg">🏔️</span>
                      <span class={`font-medium flex-1 ${quickLaunchMapId() === map.id ? 'text-white' : 'text-slate-200'}`}>
                        {map.name}
                      </span>
                      <Show when={quickLaunchMapId() === map.id}>
                        <span class="text-blue-400 font-bold text-sm">✓</span>
                      </Show>
                    </button>
                  )}
                </For>

                <Show when={campaignMaps().length === 0}>
                  <p class="text-slate-500 text-sm italic py-1">
                    Aucune carte de campagne — seule la grille par défaut est disponible.
                  </p>
                </Show>
              </div>
            </Show>
          </section>
        </Show>

        {/* Contrôles MJ */}
        <Show when={amHost()}>
          <section class="bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <Show when={session()?.state === SessionState.InProgress}
              fallback={
                /* Session en Lobby → bouton Démarrer normal */
                <>
                  <Show when={!allPlayersReady()}>
                    <p class="text-center text-sm text-amber-400/80 mb-4">
                      ⚠️ Certains joueurs n'ont pas encore sélectionné leur personnage.
                    </p>
                  </Show>
                  <button
                    onClick={handleStartSession}
                    disabled={starting()}
                    class="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-lg rounded-xl transition-all shadow-lg shadow-purple-500/20"
                  >
                    <Show when={starting()} fallback={<Play class="w-5 h-5" />}>
                      <Loader2 class="w-5 h-5 animate-spin" />
                    </Show>
                    <Show when={starting()}
                      fallback={quickLaunch() ? 'Lancer la carte' : 'Démarrer la session'}
                    >
                      Lancement…
                    </Show>
                  </button>
                  <p class="text-center text-sm text-slate-500 mt-3">
                    {quickLaunch()
                      ? 'Les joueurs seront redirigés vers la carte automatiquement.'
                      : 'Players will be redirected automatically.'}
                  </p>
                </>
              }
            >
              {/* Session déjà InProgress → proposer de reprendre au lieu de redémarrer */}
              <p class="text-center text-sm text-amber-400/80 mb-4">
                ⚡ La session est déjà en cours.
              </p>
              <button
                onClick={() => navigate(`/campaigns/${params.id}/session`)}
                class="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-lg rounded-xl transition-all shadow-lg shadow-emerald-500/20"
              >
                <Play class="w-5 h-5" />
                Reprendre la session
              </button>
              <p class="text-center text-sm text-slate-500 mt-3">
                La session a déjà été lancée — reprenez depuis le scénario.
              </p>
            </Show>
          </section>
        </Show>

        {/* Attente MJ — ou Rejoindre si session existante et utilisateur hors session */}
        <Show when={!amHost()}>
          <Show
            when={activeSession() && !session()}
            fallback={
              <div class="text-center py-4 text-slate-400">
                <Loader2 class="w-6 h-6 animate-spin text-purple-400 mx-auto mb-2" />
                Waiting for the Dungeon Master to start…
              </div>
            }
          >
            {/* Session active détectée mais utilisateur pas encore dedans */}
            <section class="bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-center">
              <p class="text-sm text-amber-400/80 mb-4">
                ⚡ Une session est déjà en cours pour cette campagne.
              </p>
              <button
                onClick={handleJoinActiveSession}
                disabled={joiningActive()}
                class="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-60 text-white font-bold text-lg rounded-xl transition-all shadow-lg shadow-emerald-500/20"
              >
                <Show when={joiningActive()} fallback={<Play class="w-5 h-5" />}>
                  <Loader2 class="w-5 h-5 animate-spin" />
                </Show>
                {joiningActive() ? 'Connexion…' : 'Rejoindre la session'}
              </button>
              <Show when={joinActiveError()}>
                <p class="text-red-400 text-sm mt-2">{joinActiveError()}</p>
              </Show>
            </section>
          </Show>
        </Show>

      </main>
    </div>
  );
};

export default CampaignLobbyPage;
