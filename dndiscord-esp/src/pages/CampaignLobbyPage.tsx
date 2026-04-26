import {
  Component,
  createEffect,
  createSignal,
  For,
  onMount,
  Show,
} from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { ArrowLeft, Copy, Check, Play, Loader2, Users, UserCircle2, Zap } from 'lucide-solid';
import { sessionState, isHost } from '@/stores/session.store';
import { PlayerRole } from '@/types/multiplayer';
import {
  selectCharacter,
  selectDefaultTemplate,
  startGame as startGameHub,
  joinCampaignSession,
  ensureMultiplayerHandlersRegistered,
  leaveSession,
} from '@/services/signalr/multiplayer.service';
import { CharacterService, CharacterClass, type CharacterDto } from '@/services/character.service';
import { CampaignService, GameSessionStatus, type GameSessionResponse } from '@/services/campaign.service';
import { signalRService } from '@/services/signalr/SignalRService';
import { authStore } from '@/stores/auth.store';

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

  const [characters,   setCharacters]   = createSignal<CharacterDto[]>([]);
  const [loadingChars, setLoadingChars] = createSignal(true);

  // active selection — either a real char id or a default template id
  const [selCharId,    setSelCharId]    = createSignal<string | null>(null);
  const [selDefaultId, setSelDefaultId] = createSignal<DefaultId | null>(null);

  const [copied,   setCopied]   = createSignal(false);
  const [starting, setStarting] = createSignal(false);
  const [leaving,  setLeaving]  = createSignal(false);

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
      ensureMultiplayerHandlersRegistered();
    }

    // Vérifier si une session est déjà en cours pour cette campagne.
    // On n'affiche le bandeau que si la session a une progression réelle
    // (currentNodeId défini OU au moins une entrée d'historique).
    // Les sessions status=Active sans progression sont des sessions fantômes
    // créées par CampaignSessionPage mais jamais jouées.
    try {
      const sessionsRes = await CampaignService.listSessions(params.id);
      const running = sessionsRes.items.find(
        s => s.status === GameSessionStatus.Active &&
             (!!s.currentNodeId || s.entries.length > 0)
      );
      if (running) setActiveSession(running);
    } catch {
      // Non-critique
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

  // Navigate when host starts
  createEffect(() => {
    const payload = sessionState.gameStartedPayload;
    if (payload && payload !== stalePayload) {
      navigate(`/campaigns/${params.id}/session`);
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
      await startGameHub('campaign');
    } catch (err: any) {
      console.error('[CampaignLobby] startGame failed:', err);
      setStarting(false);
    }
  };

  const handleLeave = async () => {
    setLeaving(true);
    try { await leaveSession(); } catch {}
    navigate(`/campaigns/${params.id}`);
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
      navigate(`/campaigns/${params.id}/session`);
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
    <div style={{
      width: '100vw', 'min-height': '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f1a 100%)',
      color: '#d4d4d4', 'font-family': 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Header */}
      <header class="sticky top-0 z-20 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/40 backdrop-blur-md">
        <button onClick={handleLeave} disabled={leaving()}
          class="flex items-center gap-2 text-slate-300 hover:text-white transition-colors disabled:opacity-50">
          <ArrowLeft class="w-5 h-5" />
          <span class="hidden sm:inline">Quitter</span>
        </button>
        <div class="text-center">
          <p class="text-xs text-purple-400 uppercase tracking-wider font-medium">Salle d'attente</p>
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

        {/* Contrôles MJ */}
        <Show when={amHost()}>
          <section class="bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
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
              <Show when={starting()} fallback="Démarrer la session">Lancement…</Show>
            </button>
            <p class="text-center text-sm text-slate-500 mt-3">
              Players will be redirected automatically.
            </p>
          </section>
        </Show>

        {/* Attente MJ */}
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
