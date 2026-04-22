import { Component, createSignal, onMount, Show, For, Switch, Match } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { ArrowLeft, BookOpen, Map as MapIcon, Sword, ChevronRight, Loader2, Play } from 'lucide-solid';
import {
  CampaignService,
  type AdvanceSessionRequest,
} from '@/services/campaign.service';
import { setSessionMapConfig } from '@/stores/session-map.store';
import { getAllMaps } from '@/services/mapStorage';

// ─── Tree types ───────────────────────────────────────────────────────────────

interface SceneData   { id: string; type: 'scene';   title: string; text: string; }
interface ChoicesData { id: string; type: 'choices'; title: string; text: string; choices: string[]; }
interface CombatData  { id: string; type: 'combat';  title: string; selectedMap?: string; difficulty?: string; villains?: any[]; }
interface MapData     {
  id: string; type: 'map'; title: string;
  selectedMap?: string;
  spawnPoint?: { x: number; z: number };
  exitCells?:  { x: number; z: number }[];
  trapCells?:  { x: number; z: number }[];
}
type NodeData = SceneData | ChoicesData | CombatData | MapData;

interface TreeConn { source: { node: string; port: string }; target: { node: string; port: string }; }
interface ParsedTree {
  nodeMap: Map<string, NodeData>;
  edges:   Map<string, string>; // "srcId::port" → targetId
  firstNodeId: string | undefined;
}

// ─── Parser ───────────────────────────────────────────────────────────────────

function parseTree(json: string): ParsedTree {
  const tree: { nodes: Array<{ type: string; x: number; y: number; data: NodeData }>; connections: TreeConn[] } = JSON.parse(json);
  const nodeMap = new Map<string, NodeData>();
  for (const n of tree.nodes ?? []) {
    if (n.data?.id) nodeMap.set(n.data.id, n.data);
  }
  const edges = new Map<string, string>();
  for (const conn of tree.connections ?? []) {
    edges.set(`${conn.source.node}::${conn.source.port}`, conn.target.node);
  }
  const firstNodeId =
    edges.get('start-node::start-output') ??
    edges.get('start-node::output');
  return { nodeMap, edges, firstNodeId };
}

// ─── Component ────────────────────────────────────────────────────────────────

const CampaignSessionPage: Component = () => {
  const params   = useParams();
  const navigate = useNavigate();

  const [loading, setLoading]               = createSignal(true);
  const [error, setError]                   = createSignal<string | null>(null);
  const [campaignTitle, setCampaignTitle]   = createSignal('');
  const [sessionId, setSessionId]           = createSignal<string | null>(null);
  const [isSaving, setIsSaving]             = createSignal(false);
  const [parsedTree, setParsedTree]         = createSignal<ParsedTree | null>(null);
  const [currentNodeId, setCurrentNodeId]   = createSignal<string | undefined>();
  const [history, setHistory]               = createSignal<string[]>([]);

  onMount(async () => {
    try {
      setLoading(true);
      const response = await CampaignService.getCampaign(params.id);
      setCampaignTitle(response.name);

      // Try backend field first (future), then per-campaign localStorage, then global localStorage
      const treeJson: string | null =
        (response as any).campaignTreeDefinition ??
        localStorage.getItem(`dnd-campaign-tree-${params.id}`) ??
        localStorage.getItem('dnd-campaign-tree') ??
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

      try {
        const session = await CampaignService.createSession(params.id);
        setSessionId(session.id);
      } catch (e) {
        console.warn('Could not create session in backend (continuing offline):', e);
      }

      setCurrentNodeId(tree.firstNodeId);
    } catch (err: any) {
      console.error('Failed to load campaign session:', err);
      setError('Impossible de charger la campagne.');
    } finally {
      setLoading(false);
    }
  });

  const currentNode = (): NodeData | null => {
    const tree = parsedTree();
    const id   = currentNodeId();
    if (!tree || !id) return null;
    return tree.nodeMap.get(id) ?? null;
  };

  // ─── Map metadata lookup (name from localStorage) ─────────────────────────
  const allMapsMeta = getAllMaps();
  const getMapName = (mapId: string) =>
    allMapsMeta.find(m => m.id === mapId)?.name ?? mapId;

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
      exitCells:  node.exitCells,
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
      const req: AdvanceSessionRequest = {
        nodeId:     node.id,
        nodeType:   node.type,
        nodeTitle:  (node as any).title ?? '',
        portUsed:   port,
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
        <div class="flex items-center gap-2 text-sm text-slate-400 min-w-[80px] justify-end">
          <Show when={isSaving()}><Loader2 class="w-3 h-3 animate-spin text-purple-400" /></Show>
          <Show when={history().length > 0}><span>{history().length + 1} blocs</span></Show>
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
                        <button onClick={() => followPort('output')} class="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-xl transition-all">Continuer <ChevronRight class="w-5 h-5" /></button>
                      </Show>
                    </div>
                  </div>
                </Match>

                {/* CHOICES */}
                <Match when={currentNode()?.type === 'choices'}>
                  <div>
                    <div class="flex items-center gap-3 mb-6">
                      <div class="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                        <svg class="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                      </div>
                      <div><p class="text-xs text-emerald-400 uppercase tracking-wider font-medium">Choix</p><h2 class="text-2xl font-display text-white">{(currentNode() as ChoicesData)?.title || 'Choix sans titre'}</h2></div>
                    </div>
                    <Show when={(currentNode() as ChoicesData)?.text}>
                      <div class="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6 leading-relaxed text-slate-200 text-lg whitespace-pre-wrap">{(currentNode() as ChoicesData)?.text}</div>
                    </Show>
                    <Show when={(currentNode() as ChoicesData)?.choices?.length > 0} fallback={<EndBanner />}>
                      <div class="flex flex-col gap-3">
                        <For each={(currentNode() as ChoicesData)?.choices}>
                          {(choice, i) => (
                            <button onClick={() => followPort(`choice-${i()}`, choice)} class="text-left px-5 py-4 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 rounded-xl text-white font-medium transition-all flex items-center gap-3 group">
                              <span class="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-sm flex-shrink-0">{i() + 1}</span>
                              <span class="flex-1">{choice || `Choix ${i() + 1}`}</span>
                              <Show when={parsedTree()?.edges.has(`${currentNode()?.id}::choice-${i()}`)}><ChevronRight class="w-4 h-4 text-emerald-400/60 group-hover:text-emerald-400 transition-colors" /></Show>
                            </button>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                </Match>

                {/* COMBAT */}
                <Match when={currentNode()?.type === 'combat'}>
                  <div>
                    <div class="flex items-center gap-3 mb-6">
                      <div class="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center"><Sword class="w-5 h-5 text-red-400" /></div>
                      <div><p class="text-xs text-red-400 uppercase tracking-wider font-medium">Combat</p><h2 class="text-2xl font-display text-white">{(currentNode() as CombatData)?.title || 'Combat sans titre'}</h2></div>
                    </div>
                    <div class="bg-red-500/5 border border-red-500/20 rounded-2xl p-6 mb-8 text-center"><Sword class="w-12 h-12 text-red-400/40 mx-auto mb-3" /><p class="text-slate-400 italic">La gestion des combats arrive bientôt.</p></div>
                    <div class="flex justify-end"><Show when={hasPort('output')} fallback={<EndBanner />}><button onClick={() => followPort('output')} class="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-semibold rounded-xl transition-all">Passer <ChevronRight class="w-5 h-5" /></button></Show></div>
                  </div>
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

                          {/* Launch button */}
                          <button
                            onClick={launchMap}
                            class="w-full flex items-center justify-center gap-3 px-6 py-4 mb-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl transition-all text-lg shadow-lg shadow-blue-900/30"
                          >
                            <Play class="w-5 h-5" />
                            Lancer la carte
                          </button>
                        </Show>

                        {/* Continue (after playing) */}
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
    </div>
  );
};

export default CampaignSessionPage;
