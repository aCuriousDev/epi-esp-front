import { Component, createSignal, createEffect, onMount, onCleanup, Show, For, Switch, Match } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { ArrowLeft, BookOpen, Map as MapIcon, ChevronRight, Loader2, Play, Package, X } from 'lucide-solid';
import {
  CampaignService,
  type AdvanceSessionRequest,
  type GameSessionResponse,
} from '@/services/campaign.service';
import { CharacterService } from '@/services/character.service';
import { setSessionMapConfig } from '@/stores/session-map.store';
import { getAllMaps } from '@/services/mapStorage';
import {
  voteForChoice,
  subscribeCampaign,
  unsubscribeCampaign,
  selectCharacter,
} from '@/services/signalr/multiplayer.service';
import { signalRService } from '@/services/signalr/SignalRService';
import { ensureMultiplayerHandlersRegistered } from '@/services/signalr/multiplayer.service';
import { sessionState, isHost } from '@/stores/session.store';
import { authStore } from '@/stores/auth.store';
import { PlayerRole } from '@/types/multiplayer';
import InventoryPanel from '@/components/InventoryPanel';

// ─── Tree types ───────────────────────────────────────────────────────────────

interface SceneData   { id: string; type: 'scene';   title: string; text: string; }
interface ChoicesData { id: string; type: 'choices'; title: string; text: string; choices: string[]; }
interface MapData     {
  id: string; type: 'map'; title: string;
  selectedMap?: string;
  spawnPoint?: { x: number; z: number };
  exitCells?:  { x: number; z: number; exitType?: 'next' | 'end' }[];
  trapCells?:  { x: number; z: number }[];
}
type NodeData = SceneData | ChoicesData | MapData;

interface TreeConn { source: { node: string; port: string }; target: { node: string; port: string }; }
interface ParsedTree {
  nodeMap: Map<string, NodeData>;
  edges:   Map<string, string>; // "srcId::port" → targetId
  firstNodeId: string | undefined;
}

// ─── Parser ───────────────────────────────────────────────────────────────────

function parseTree(json: string): ParsedTree {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('Scénario corrompu — rouvrir et resauvegarder dans le Campaign Manager.');
  }

  // Validate top-level shape so downstream code never silently iterates over
  // non-arrays (which would produce an empty nodeMap / no start-node, giving
  // the confusing "pas de point de départ" error instead of a real diagnosis).
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Scénario invalide : format inattendu (objet attendu).');
  }
  const tree = raw as { nodes?: unknown; connections?: unknown };
  if (!Array.isArray(tree.nodes)) {
    throw new Error('Scénario invalide : le champ "nodes" est absent ou n\'est pas un tableau.');
  }
  if (!Array.isArray(tree.connections)) {
    throw new Error('Scénario invalide : le champ "connections" est absent ou n\'est pas un tableau.');
  }

  const nodeMap = new Map<string, NodeData>();
  for (const n of tree.nodes as Array<{ type: string; x: number; y: number; data: NodeData }>) {
    if (n.data?.id) nodeMap.set(n.data.id, n.data);
  }
  const edges = new Map<string, string>();
  for (const conn of tree.connections as TreeConn[]) {
    edges.set(`${conn.source.node}::${conn.source.port}`, conn.target.node);
  }
  const firstNodeId =
    edges.get('start-node::start-output') ??
    edges.get('start-node::output');
  return { nodeMap, edges, firstNodeId };
}

// ─── Fix #2 — dedup createSession ────────────────────────────────────────────
// Si le composant monte deux fois simultanément (navigation SPA rapide, hot-
// reload), les deux instances partagent la même Promise et n'écrivent qu'une
// seule session en base.  La Map est nettoyée 5 s après résolution pour ne pas
// bloquer une vraie nouvelle session lors d'une visite ultérieure.
const _pendingSessionCreate = new Map<string, Promise<GameSessionResponse>>();

// ─── Fix #1 — waitUntilInSession ──────────────────────────────────────────────
// Attend que sessionState.session soit non-null (le joueur est confirmé dans la
// session SignalR) avant d'appeler SelectCharacter.  Après une reconnexion, le
// hub ré-ajoute le joueur de façon asynchrone ; appeler SelectCharacter trop tôt
// laisse selectedCharacterId vide côté serveur et l'inventaire DM reste vide.
function waitUntilInSession(timeoutMs = 3_000): Promise<boolean> {
  return new Promise(resolve => {
    if (sessionState.session) { resolve(true); return; }
    const start = Date.now();
    const tid = setInterval(() => {
      if (sessionState.session)             { clearInterval(tid); resolve(true);  }
      else if (Date.now() - start >= timeoutMs) { clearInterval(tid); resolve(false); }
    }, 100);
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

const CampaignSessionPage: Component = () => {
  const params   = useParams();
  const navigate = useNavigate();

  const [loading, setLoading]               = createSignal(true);
  const [error, setError]                   = createSignal<string | null>(null);
  const [campaignTitle, setCampaignTitle]   = createSignal('');
  const [sessionId, setSessionId]           = createSignal<string | null>(null);
  const [isOffline, setIsOffline]           = createSignal(false);
  const [isSaving, setIsSaving]             = createSignal(false);
  const [parsedTree, setParsedTree]         = createSignal<ParsedTree | null>(null);
  const [currentNodeId, setCurrentNodeId]   = createSignal<string | undefined>();
  const [history, setHistory]               = createSignal<string[]>([]);

  // ── Inventaire ────────────────────────────────────────────────────────────
  const [showInventory,    setShowInventory   ] = createSignal(false);
  const [myCharacterId,    setMyCharacterId   ] = createSignal<string | null>(null);
  const [dmSelectedPlayer, setDmSelectedPlayer] = createSignal<string | null>(null);

  /** Joueurs connectés (hors MJ) ayant un personnage sélectionné. */
  const playersWithCharacter = () =>
    (sessionState.session?.players ?? []).filter(
      p => p.role !== PlayerRole.DungeonMaster && p.selectedCharacterId
    );

  // ── Votes des joueurs (bloc Choices) ──────────────────────────────────────
  // Map<userId, choiceIndex> pour le nœud courant
  const [playerVotes, setPlayerVotes] = createSignal<Record<string, { name: string; index: number }>>({});
  // Verrou : évite qu'un double-déclenchement de checkConsensus (handleVote +
  // ChoiceVoted broadcast) appelle followPort deux fois pour le même nœud.
  const [votingLocked, setVotingLocked] = createSignal(false);
  const myUserId = () => authStore.user()?.id ?? '';

  onMount(async () => {
    // ── SignalR subscription for votes ──────────────────────────────────────
    try {
      if (!signalRService.isConnected) {
        await signalRService.connect();
        ensureMultiplayerHandlersRegistered();
      }
      await subscribeCampaign(params.id);

      // ── Sélection automatique du personnage (joueurs seulement) ─────────
      // Permet à l'InventoryPanel de connaître le characterId de chaque joueur
      // via sessionState.session.players[].selectedCharacterId.
      // Fix #1 : on charge d'abord le personnage (pour l'inventaire local),
      // puis on attend d'être confirmé dans la session SignalR avant d'appeler
      // SelectCharacter — évite un selectedCharacterId vide après reconnexion.
      if (!isHost()) {
        try {
          const chars = await CharacterService.getMyCharacters();
          if (chars.length > 0) {
            setMyCharacterId(chars[0].id);
            const inSession = await waitUntilInSession(3_000);
            if (inSession) {
              await selectCharacter(chars[0].id);
            }
            // Si hors session (navigation directe sans lobby), myCharacterId
            // reste défini pour l'inventaire local ; seul selectedCharacterId
            // côté serveur sera absent jusqu'à un rejoin.
          }
        } catch (e) {
          console.warn('[CampaignSession] Could not auto-select character:', e);
        }
      }

      const voteHandler = (data: Record<string, unknown>) => {
        const nodeId      = String(data.nodeId      ?? data.NodeId      ?? '');
        const userId      = String(data.userId      ?? data.UserId      ?? '');
        const userName    = String(data.userName    ?? data.UserName    ?? 'Joueur');
        const choiceIndex = Number(data.choiceIndex ?? data.ChoiceIndex ?? -1);

        // Ignore votes that belong to a different node (stale events)
        if (nodeId !== currentNodeId()) return;

        if (choiceIndex < 0) {
          // Vote annulé
          setPlayerVotes(prev => {
            const next = { ...prev };
            delete next[userId];
            return next;
          });
        } else {
          setPlayerVotes(prev => ({ ...prev, [userId]: { name: userName, index: choiceIndex } }));
        }

        // Vérifier le consensus après chaque vote reçu.
        // C'est ce chemin qui avance le MJ (qui ne vote jamais) et tous les
        // clients qui n'ont pas encore atteint le consensus localement.
        // votingLocked empêche un double-followPort si handleVote l'a déjà déclenché.
        checkConsensus();
      };

      signalRService.on('ChoiceVoted', voteHandler);
      onCleanup(() => {
        try { signalRService.off('ChoiceVoted', voteHandler); } catch {}
        if (signalRService.isConnected) {
          unsubscribeCampaign(params.id).catch(() => undefined);
        }
      });
    } catch (e) {
      console.warn('[CampaignSession] SignalR setup failed (votes disabled):', e);
    }

    try {
      setLoading(true);
      const response = await CampaignService.getCampaign(params.id);
      setCampaignTitle(response.name);

      // Backend field takes priority; fall back to per-campaign then global localStorage.
      // Use || (falsy) so an empty string from the API is treated the same as null.
      const treeJson: string | null =
        response.campaignTreeDefinition ||
        localStorage.getItem(`dnd-campaign-tree-${params.id}`) ||
        localStorage.getItem('dnd-campaign-tree') ||
        null;

      if (!treeJson) {
        setError('Cette campagne ne possède pas encore de scénario. Définissez-en un dans le Campaign Manager.');
        return;
      }

      const tree = parseTree(treeJson);
      setParsedTree(tree);

      if (!tree.firstNodeId) {
        setError('Le scénario ne possède pas de point de départ. Connectez un bloc au nœud de départ dans le Campaign Manager.');
        return;
      }

      // ── Session : reprendre l'active existante ou en créer une nouvelle ─────
      let startNodeId = tree.firstNodeId; // fallback : début du scénario

      try {
        const list = await CampaignService.listSessions(params.id);
        const active = list.items.find(s => s.status === 'Active');

        if (active) {
          // Reprise : réutiliser la session existante
          setSessionId(active.id);
          // Restaurer la position si le nœud est toujours dans l'arbre
          if (active.currentNodeId && tree.nodeMap.has(active.currentNodeId)) {
            startNodeId = active.currentNodeId;
          }
        } else {
          // Première fois (ou session précédente terminée) : nouvelle session.
          // Fix #2 : si deux instances du composant montent simultanément,
          // elles partagent la même Promise → une seule session créée en base.
          if (!_pendingSessionCreate.has(params.id)) {
            const p = CampaignService.createSession(params.id).finally(() =>
              setTimeout(() => _pendingSessionCreate.delete(params.id), 5_000)
            );
            _pendingSessionCreate.set(params.id, p);
          }
          const fresh = await _pendingSessionCreate.get(params.id)!;
          setSessionId(fresh.id);
        }
      } catch (e) {
        console.warn('[CampaignSession] Backend inaccessible (mode hors-ligne):', e);
        setIsOffline(true);
      }

      setCurrentNodeId(startNodeId);

      // ── Retour depuis une carte : gérer le type de sortie ────────────────
      const search       = new URLSearchParams(window.location.search);
      const mapExit      = search.get('mapExit') as 'next' | 'end' | null;
      const resumeNodeId = search.get('resumeNodeId');
      if (mapExit) {
        // Nettoyer l'URL immédiatement pour éviter un re-déclenchement
        window.history.replaceState({}, '', window.location.pathname);

        if (mapExit === 'end') {
          // Fin de scénario directe
          const sid = sessionId();
          if (sid) {
            try { await CampaignService.completeSession(params.id, sid); } catch {}
          }
          navigate(`/campaigns/${params.id}`);
          return;
        }

        // mapExit === 'next' : restaurer la position dans l'arbre au nœud de la carte
        // qui vient d'être jouée, pour que le DM voie "Continuer le scénario".
        if (resumeNodeId && tree.nodeMap.has(resumeNodeId)) {
          setCurrentNodeId(resumeNodeId);
        }
      }
    } catch (err: any) {
      console.error('Failed to load campaign session:', err);
      setError('Impossible de charger la campagne.');
    } finally {
      setLoading(false);
    }
  });

  // Réinitialise les votes et le verrou à chaque changement de nœud
  createEffect(() => {
    currentNodeId(); // track
    setPlayerVotes({});
    setVotingLocked(false);
  });

  const currentNode = (): NodeData | null => {
    const tree = parsedTree();
    const id   = currentNodeId();
    if (!tree || !id) return null;
    return tree.nodeMap.get(id) ?? null;
  };

  // ─── Map metadata lookup (name from localStorage) ─────────────────────────
  // Deferred to call-time so it never runs inside a reactive tracking scope.
  const getMapName = (mapId: string) =>
    getAllMaps().find(m => m.id === mapId)?.name ?? mapId;

  // ─── Launch map node in BoardGame ──────────────────────────────────────────
  const launchMap = () => {
    const node = currentNode() as MapData | null;
    if (!node?.selectedMap) return;

    setSessionMapConfig({
      campaignId: params.id,
      sessionId:  sessionId(),
      nodeId:     node.id,
      mapId:      node.selectedMap,
      spawnPoint: node.spawnPoint,
      // Normaliser les exitCells : garantir que exitType est toujours défini
      exitCells:  node.exitCells?.map(e => ({ ...e, exitType: e.exitType ?? 'next' as const })),
      trapCells:  node.trapCells,
    });

    navigate('/board?fromSession=1');
  };

  const followPort = async (port: string, choiceText?: string) => {
    const tree = parsedTree();
    const node = currentNode();
    if (!tree || !node) return;
    const nextId = tree.edges.get(`${node.id}::${port}`);
    if (!nextId) return;

    const sid = sessionId();
    if (sid && !isSaving()) {
      setIsSaving(true);
      // On enregistre la destination (nextId) comme position courante — pas le départ —
      // pour que CurrentNodeId reflète où on SE TROUVE et permette la reprise correcte.
      const nextNode = tree.nodeMap.get(nextId);
      const req: AdvanceSessionRequest = {
        nodeId:    nextId,
        nodeType:  nextNode?.type ?? node.type,
        nodeTitle: (nextNode as any)?.title ?? '',
        portUsed:  port,
        choiceText,
      };
      CampaignService.advanceSession(params.id, sid, req)
        .catch(e => console.warn('Failed to save session advance:', e))
        .finally(() => setIsSaving(false));
    }

    setHistory(h => [...h, node.id]);
    setCurrentNodeId(nextId);
  };

  const handleEnd = async () => {
    const node = currentNode();
    const sid  = sessionId();
    if (sid && node) {
      try {
        await CampaignService.advanceSession(params.id, sid, {
          nodeId:    node.id,
          nodeType:  node.type,
          nodeTitle: (node as any).title ?? '',
        });
        await CampaignService.completeSession(params.id, sid);
      } catch (e) {
        console.warn('Failed to complete session:', e);
      }
    }
    navigate(`/campaigns/${params.id}`);
  };

  // ── Vote helpers ─────────────────────────────────────────────────────────

  /** Joueurs connectés hors MJ — ce sont les seuls qui doivent voter. */
  const connectedPlayerCount = () => {
    const players = (sessionState.session?.players ?? [])
      .filter(p => p.status === 'Connected' && p.role !== PlayerRole.DungeonMaster);
    return players.length;
  };

  /**
   * Seuls les joueurs (non-MJ) votent.
   * Fallback solo : si aucun joueur non-MJ n'est connecté (test DM seul),
   * le MJ peut tout de même interagir pour dérouler le scénario.
   */
  const handleVote = async (choiceIndex: number, choiceText: string) => {
    const node = currentNode();
    if (!node) return;
    // Bloquer le MJ quand des joueurs sont présents
    if (isHost() && connectedPlayerCount() > 0) return;

    const alreadyVoted = playerVotes()[myUserId()]?.index === choiceIndex;
    const newIndex = alreadyVoted ? -1 : choiceIndex; // toggle

    // Optimistic local update
    if (newIndex < 0) {
      setPlayerVotes(prev => { const n = { ...prev }; delete n[myUserId()]; return n; });
    } else {
      const name = authStore.user()?.username ?? 'Moi';
      setPlayerVotes(prev => ({ ...prev, [myUserId()]: { name, index: newIndex } }));
    }

    try {
      await voteForChoice(params.id, node.id, newIndex);
    } catch (e) {
      console.warn('[CampaignSession] voteForChoice failed:', e);
    }

    checkConsensus();
  };

  const checkConsensus = () => {
    const node = currentNode();
    // Déjà avancé pour ce nœud (verrou) ou nœud non-choices → ignorer
    if (!node || node.type !== 'choices' || votingLocked()) return;

    const votes = playerVotes();
    const voteValues = Object.values(votes);
    if (voteValues.length === 0) return;

    // Seuls les joueurs non-MJ comptent. Fallback 1 pour test solo DM.
    const required = Math.max(connectedPlayerCount(), 1);

    const allSame =
      voteValues.length >= required &&
      voteValues.every(v => v.index === voteValues[0].index);

    if (allSame) {
      // Verrouiller avant followPort pour éviter un double-déclenchement si
      // checkConsensus est appelé une seconde fois (ex. broadcast tardif).
      setVotingLocked(true);
      const winningIndex = voteValues[0].index;
      // Récupérer le texte depuis le nœud plutôt que depuis le vote local —
      // fonctionne pour tous les clients (MJ inclus) sans argument.
      const choiceText = (node as ChoicesData).choices?.[winningIndex] ?? '';
      followPort(`choice-${winningIndex}`, choiceText);
    }
  };

  const hasPort = (port: string) => {
    const tree = parsedTree();
    const node = currentNode();
    if (!tree || !node) return false;
    return tree.edges.has(`${node.id}::${port}`);
  };

  // ─── End-of-branch banner ──────────────────────────────────────────────────

  const EndBanner = () => (
    <div class="flex flex-col items-center gap-4 py-6">
      <div class="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
        <span class="text-3xl">🏁</span>
      </div>
      <p class="text-slate-400 text-lg font-medium">Fin du scénario</p>
      <button
        onClick={handleEnd}
        class="px-6 py-3 bg-white/10 hover:bg-white/15 border border-white/20 text-white rounded-xl transition-all font-medium"
      >
        Terminer la session
      </button>
    </div>
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{
      width: '100vw', 'min-height': '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f1a 100%)',
      color: '#d4d4d4', 'font-family': 'system-ui, sans-serif',
      display: 'flex', 'flex-direction': 'column',
    }}>
      {/* Offline mode banner — shown when backend session creation failed */}
      <Show when={isOffline()}>
        <div class="flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 bg-amber-600/20 border-b border-amber-500/30 text-amber-300 text-xs">
          <span>⚠</span>
          <span>Mode hors-ligne — la progression ne sera pas sauvegardée sur le serveur.</span>
        </div>
      </Show>

      {/* Header */}
      <header class="sticky top-0 z-20 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/40 backdrop-blur-md">
        <button onClick={() => navigate(`/campaigns/${params.id}`)} class="flex items-center gap-2 text-slate-300 hover:text-white transition-colors">
          <ArrowLeft class="w-5 h-5" />
          <span class="hidden sm:inline">Retour</span>
        </button>
        <div class="text-center">
          <p class="text-xs text-purple-400 uppercase tracking-wider">Session en cours</p>
          <h1 class="font-display text-lg text-white">{campaignTitle()}</h1>
        </div>
        <div class="flex items-center gap-3 min-w-[80px] justify-end">
          <Show when={isSaving()}><Loader2 class="w-3 h-3 animate-spin text-purple-400" /></Show>
          <Show when={history().length > 0}><span class="text-sm text-slate-400">{history().length + 1} blocs</span></Show>
          {/* Bouton Inventaire — visible pour les joueurs (avec perso) et le MJ */}
          <Show when={myCharacterId() !== null || isHost()}>
            <button
              onClick={() => setShowInventory(v => !v)}
              class={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                showInventory()
                  ? 'bg-purple-600/30 border border-purple-500/50 text-purple-300'
                  : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
              title="Inventaire"
            >
              <Package class="w-3.5 h-3.5" />
              <span class="hidden sm:inline">Inventaire</span>
            </button>
          </Show>
        </div>
      </header>

      <main class="flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Loading */}
        <Show when={loading()}>
          <div class="flex flex-col items-center gap-4 text-slate-400">
            <Loader2 class="w-10 h-10 animate-spin text-purple-400" />
            <p>Chargement du scénario…</p>
          </div>
        </Show>

        {/* Error */}
        <Show when={!loading() && error()}>
          <div class="max-w-md text-center">
            <div class="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
              <span class="text-3xl">⚠️</span>
            </div>
            <p class="text-red-400 font-medium mb-2">Impossible de lancer la session</p>
            <p class="text-slate-400 text-sm mb-6">{error()}</p>
            <button onClick={() => navigate(`/campaigns/${params.id}`)} class="px-6 py-3 bg-white/10 hover:bg-white/15 border border-white/20 text-white rounded-xl transition-all">Retour</button>
          </div>
        </Show>

        {/* Session */}
        <Show when={!loading() && !error()}>
          <div class="w-full max-w-2xl">
            {/* Fil d'Ariane */}
            <Show when={history().length > 0}>
              <div class="flex items-center gap-1 text-slate-500 text-sm mb-8 overflow-x-auto pb-1">
                <For each={history()}>
                  {(id) => {
                    const n = parsedTree()?.nodeMap.get(id);
                    if (!n) return null;
                    return (<><span class="shrink-0 max-w-[120px] truncate">{(n as any).title || n.type}</span><ChevronRight class="w-3 h-3 shrink-0 text-slate-600" /></>);
                  }}
                </For>
                <Show when={currentNode()}>
                  <span class="shrink-0 text-white font-medium">{(currentNode() as any)?.title || currentNode()?.type}</span>
                </Show>
              </div>
            </Show>

            <div class="bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
              <Switch fallback={
                <Show when={!currentNode()}>
                  <div class="text-center text-slate-400 py-6">Aucun bloc à afficher.</div>
                </Show>
              }>
                {/* SCENE */}
                <Match when={currentNode()?.type === 'scene'}>
                  <div>
                    <div class="flex items-center gap-3 mb-6">
                      <div class="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center"><BookOpen class="w-5 h-5 text-purple-400" /></div>
                      <div><p class="text-xs text-purple-400 uppercase tracking-wider font-medium">Scène</p><h2 class="text-2xl font-display text-white">{(currentNode() as SceneData)?.title || 'Scène sans titre'}</h2></div>
                    </div>
                    <div class="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 leading-relaxed text-slate-200 text-lg whitespace-pre-wrap min-h-[120px]">
                      <Show when={(currentNode() as SceneData)?.text} fallback={<span class="text-slate-500 italic">Aucun texte pour cette scène.</span>}>{(currentNode() as SceneData)?.text}</Show>
                    </div>
                    <div class="flex justify-end">
                      <Show when={hasPort('output')} fallback={<EndBanner />}>
                        <Show
                          when={isHost()}
                          fallback={
                            <p class="text-sm text-slate-500 italic flex items-center gap-2">
                              <Loader2 class="w-3.5 h-3.5 animate-spin text-purple-400" />
                              En attente du Maître du Jeu…
                            </p>
                          }
                        >
                          <button onClick={() => followPort('output')} class="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-xl transition-all">Continuer <ChevronRight class="w-5 h-5" /></button>
                        </Show>
                      </Show>
                    </div>
                  </div>
                </Match>

                {/* CHOICES */}
                <Match when={currentNode()?.type === 'choices'}>
                  {(() => {
                    const node = () => currentNode() as ChoicesData;
                    const votes = () => playerVotes();

                    // Voters per choice index
                    const votersFor = (idx: number) =>
                      Object.values(votes()).filter(v => v.index === idx);

                    const myVoteIndex = () => votes()[myUserId()]?.index ?? -1;

                    // Joueurs connectés hors MJ (ceux qui doivent voter). Fallback 1 = solo DM.
                    const totalPlayers = () => Math.max(connectedPlayerCount(), 1);
                    // Le MJ observe seulement quand des joueurs sont là
                    const dmIsObserver = () => isHost() && connectedPlayerCount() > 0;

                    return (
                      <div>
                        {/* Header */}
                        <div class="flex items-center gap-3 mb-6">
                          <div class="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                            <svg class="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                          </div>
                          <div>
                            <p class="text-xs text-emerald-400 uppercase tracking-wider font-medium">Choix</p>
                            <h2 class="text-2xl font-display text-white">{node()?.title || 'Choix sans titre'}</h2>
                          </div>
                        </div>

                        <Show when={node()?.text}>
                          <div class="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6 leading-relaxed text-slate-200 text-lg whitespace-pre-wrap">{node()?.text}</div>
                        </Show>

                        {/* Légende votes */}
                        <div class="flex items-center justify-between mb-3">
                          <Show when={dmIsObserver()}>
                            <span class="text-xs text-amber-400/70 flex items-center gap-1">
                              👁 Vous observez — les joueurs votent
                            </span>
                          </Show>
                          <p class="text-xs text-slate-500 ml-auto">
                            {Object.keys(votes()).length}/{totalPlayers()} joueur{totalPlayers() > 1 ? 's' : ''} ont voté
                          </p>
                        </div>

                        <Show when={node()?.choices?.length > 0} fallback={<EndBanner />}>
                          <div class="flex flex-col gap-3">
                            <For each={node()?.choices}>
                              {(choice, i) => {
                                const voters  = () => votersFor(i());
                                const isMine  = () => myVoteIndex() === i();
                                const hasLink = () => parsedTree()?.edges.has(`${node()?.id}::choice-${i()}`);

                                return (
                                  <button
                                    onClick={() => handleVote(i(), choice)}
                                    disabled={dmIsObserver()}
                                    title={dmIsObserver() ? 'Seuls les joueurs peuvent voter' : undefined}
                                    class={`text-left px-5 py-4 rounded-xl border-2 transition-all flex flex-col gap-2 group ${
                                      dmIsObserver()
                                        ? 'border-white/10 bg-white/5 opacity-70 cursor-not-allowed'
                                        : isMine()
                                          ? 'border-emerald-500 bg-emerald-500/20 shadow-lg shadow-emerald-500/10'
                                          : 'border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15 hover:border-emerald-500/50'
                                    }`}
                                  >
                                    {/* Ligne principale */}
                                    <div class="flex items-center gap-3 w-full">
                                      <span class={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 transition-colors ${
                                        isMine()
                                          ? 'bg-emerald-500/50 border border-emerald-400 text-white'
                                          : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                                      }`}>
                                        {i() + 1}
                                      </span>
                                      <span class="flex-1 text-white font-medium">{choice || `Choix ${i() + 1}`}</span>
                                      <Show when={hasLink()}>
                                        <ChevronRight class={`w-4 h-4 transition-colors ${isMine() ? 'text-emerald-300' : 'text-emerald-400/50 group-hover:text-emerald-400'}`} />
                                      </Show>
                                    </div>

                                    {/* Dots joueurs */}
                                    <Show when={totalPlayers() > 1 || voters().length > 0}>
                                      <div class="flex items-center gap-1.5 pl-10">
                                        <For each={Array.from({ length: totalPlayers() }, (_, idx) => {
                                          const voter = voters()[idx];
                                          return voter ?? null;
                                        })}>
                                          {(voter) => (
                                            <Show
                                              when={voter}
                                              fallback={
                                                <div
                                                  class="w-2.5 h-2.5 rounded-full bg-white/10 border border-white/20"
                                                  title="En attente…"
                                                />
                                              }
                                            >
                                              <div
                                                class="w-2.5 h-2.5 rounded-full bg-emerald-400 border border-emerald-300 shadow-sm shadow-emerald-400/50"
                                                title={voter!.name}
                                              />
                                            </Show>
                                          )}
                                        </For>
                                        <Show when={voters().length > 0}>
                                          <span class="text-[10px] text-emerald-400/70 ml-0.5">
                                            {voters().length}/{totalPlayers()}
                                          </span>
                                        </Show>
                                      </div>
                                    </Show>
                                  </button>
                                );
                              }}
                            </For>
                          </div>

                          {/* Consensus en cours */}
                          <Show when={Object.keys(votes()).length > 0 && Object.keys(votes()).length < totalPlayers()}>
                            <p class="mt-4 text-center text-sm text-amber-400/70 flex items-center justify-center gap-2">
                              <Loader2 class="w-3.5 h-3.5 animate-spin" />
                              En attente des autres joueurs…
                            </p>
                          </Show>
                        </Show>
                      </div>
                    );
                  })()}
                </Match>

                {/* MAP */}
                <Match when={currentNode()?.type === 'map'}>
                  {(() => {
                    const node = () => currentNode() as MapData;
                    const mapName = () => node().selectedMap ? getMapName(node().selectedMap!) : null;
                    const configured = () => !!(node().spawnPoint || (node().exitCells?.length ?? 0) > 0 || (node().trapCells?.length ?? 0) > 0);
                    return (
                      <div>
                        {/* Header */}
                        <div class="flex items-center gap-3 mb-6">
                          <div class="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center">
                            <MapIcon class="w-5 h-5 text-blue-400" />
                          </div>
                          <div>
                            <p class="text-xs text-blue-400 uppercase tracking-wider font-medium">Carte</p>
                            <h2 class="text-2xl font-display text-white">{node().title || 'Carte sans titre'}</h2>
                          </div>
                        </div>

                        {/* Map info card */}
                        <Show
                          when={node().selectedMap}
                          fallback={
                            <div class="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-6 mb-8 flex flex-col items-center gap-3 text-center">
                              <MapIcon class="w-14 h-14 text-blue-400/30" />
                              <p class="text-slate-500 italic">Aucune carte configurée pour ce bloc.</p>
                            </div>
                          }
                        >
                          <div class="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-6 mb-6 space-y-4">
                            {/* Map name */}
                            <div class="flex items-center gap-3">
                              <MapIcon class="w-8 h-8 text-blue-400/50 flex-shrink-0" />
                              <div>
                                <p class="text-xs text-blue-400 uppercase tracking-wider mb-0.5">Carte</p>
                                <p class="text-xl font-display text-white">{mapName()}</p>
                              </div>
                            </div>

                            {/* Configuration chips */}
                            <Show when={configured()}>
                              <div class="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                                <Show when={node().spawnPoint}>
                                  <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-500/15 border border-green-500/30 text-green-400 text-sm">
                                    ⊙ Spawn ({node().spawnPoint!.x}, {node().spawnPoint!.z})
                                  </span>
                                </Show>
                                <Show when={(node().exitCells?.length ?? 0) > 0}>
                                  <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 text-sm">
                                    ⬆ {node().exitCells!.length} sortie{node().exitCells!.length !== 1 ? 's' : ''}
                                  </span>
                                </Show>
                                <Show when={(node().trapCells?.length ?? 0) > 0}>
                                  <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-sm">
                                    ✕ {node().trapCells!.length} piège{node().trapCells!.length !== 1 ? 's' : ''}
                                  </span>
                                </Show>
                              </div>
                            </Show>
                          </div>

                          {/* Launch button — MJ uniquement */}
                          <Show
                            when={isHost()}
                            fallback={
                              <div class="w-full flex items-center justify-center gap-3 px-6 py-4 mb-8 rounded-xl border border-white/10 bg-white/5 text-slate-500 text-sm italic">
                                <Loader2 class="w-4 h-4 animate-spin text-purple-400" />
                                En attente du lancement par le Maître du Jeu…
                              </div>
                            }
                          >
                            <button
                              onClick={launchMap}
                              class="w-full flex items-center justify-center gap-3 px-6 py-4 mb-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl transition-all text-lg shadow-lg shadow-blue-900/30"
                            >
                              <Play class="w-5 h-5" />
                              Lancer la carte
                            </button>
                          </Show>
                        </Show>

                        {/* Continue (after playing) — accessible à tous */}
                        <div class="flex justify-end">
                          <Show when={hasPort('output')} fallback={<EndBanner />}>
                            <button
                              onClick={() => followPort('output')}
                              class="flex items-center gap-2 px-5 py-2.5 bg-white/8 hover:bg-white/12 border border-white/15 text-slate-300 hover:text-white rounded-xl transition-all text-sm"
                            >
                              Continuer le scénario <ChevronRight class="w-4 h-4" />
                            </button>
                          </Show>
                        </div>
                      </div>
                    );
                  })()}
                </Match>
              </Switch>
            </div>
          </div>
        </Show>
      </main>

      {/* ══════════════════════════════════════════════════════════════════
          Drawer d'inventaire — slide depuis la droite
          ══════════════════════════════════════════════════════════════════ */}
      <Show when={showInventory()}>
        {/* Backdrop */}
        <div
          class="fixed inset-0 bg-black/40 backdrop-blur-sm z-30"
          onClick={() => setShowInventory(false)}
        />

        {/* Panel */}
        <div class="fixed right-0 top-0 h-full w-full sm:w-[420px] z-40
                    flex flex-col
                    bg-slate-950 border-l border-white/10
                    shadow-2xl overflow-hidden">

          {/* Header du drawer */}
          <div class="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
            <div class="flex items-center gap-2">
              <Package class="w-4 h-4 text-purple-400" />
              <span class="font-semibold text-white text-sm">Inventaire</span>
              <Show when={isHost() && playersWithCharacter().length > 0}>
                <span class="text-xs text-slate-500">— MJ</span>
              </Show>
            </div>
            <button
              onClick={() => setShowInventory(false)}
              class="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          {/* Contenu */}
          <div class="flex-1 overflow-y-auto">
            <Show
              when={isHost()}
              fallback={
                /* ── Vue joueur ─── */
                <Show
                  when={myCharacterId()}
                  fallback={
                    <div class="flex flex-col items-center gap-3 py-16 text-slate-500 text-sm text-center px-6">
                      <Package class="w-10 h-10 opacity-30" />
                      <p>Aucun personnage sélectionné.</p>
                      <p class="text-xs text-slate-600">Créez un personnage depuis votre profil pour accéder à l'inventaire.</p>
                    </div>
                  }
                >
                  <InventoryPanel characterId={myCharacterId()!} isMJ={false} />
                </Show>
              }
            >
              {/* ── Vue MJ ─── */}
              <Show
                when={playersWithCharacter().length > 0}
                fallback={
                  <div class="flex flex-col items-center gap-3 py-16 text-slate-500 text-sm text-center px-6">
                    <Package class="w-10 h-10 opacity-30" />
                    <p>Aucun joueur connecté avec un personnage.</p>
                    <p class="text-xs text-slate-600">Les joueurs doivent rejoindre la session pour que leur personnage apparaisse ici.</p>
                  </div>
                }
              >
                {/* Tabs joueurs */}
                <div class="flex gap-1 px-4 pt-3 pb-2 border-b border-white/5 overflow-x-auto flex-shrink-0">
                  <For each={playersWithCharacter()}>
                    {(player) => (
                      <button
                        onClick={() => setDmSelectedPlayer(
                          dmSelectedPlayer() === player.userId ? null : player.userId
                        )}
                        class={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                          dmSelectedPlayer() === player.userId
                            ? 'bg-purple-600/30 border border-purple-500/50 text-purple-300'
                            : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {player.userName}
                      </button>
                    )}
                  </For>
                </div>

                {/* Inventaire du joueur sélectionné */}
                <Show
                  when={dmSelectedPlayer()}
                  fallback={
                    <div class="flex flex-col items-center gap-2 py-12 text-slate-600 text-sm text-center px-6">
                      <span class="text-2xl">👆</span>
                      <p>Sélectionnez un joueur pour voir son inventaire.</p>
                    </div>
                  }
                >
                  {(() => {
                    const player = playersWithCharacter().find(p => p.userId === dmSelectedPlayer());
                    return player?.selectedCharacterId
                      ? <InventoryPanel characterId={player.selectedCharacterId} isMJ={true} />
                      : null;
                  })()}
                </Show>
              </Show>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default CampaignSessionPage;
