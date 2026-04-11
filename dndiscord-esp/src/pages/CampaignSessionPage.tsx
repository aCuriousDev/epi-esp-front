import { Component, createSignal, onMount, Show, For, Switch, Match } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { ArrowLeft, BookOpen, Map as MapIcon, Sword, ChevronRight, Loader2 } from 'lucide-solid';
import { CampaignService, mapCampaignResponse } from '@/services/campaign.service';

// ─── Tree data types ──────────────────────────────────────────────────────────

interface SceneData {
  id: string;
  type: 'scene';
  title: string;
  text: string;
}

interface ChoicesData {
  id: string;
  type: 'choices';
  title: string;
  text: string;
  choices: string[];
}

interface CombatData {
  id: string;
  type: 'combat';
  title: string;
  selectedMap?: string;
  difficulty?: string;
  villains?: any[];
}

interface MapData {
  id: string;
  type: 'map';
  title: string;
  selectedMap?: string;
}

type NodeData = SceneData | ChoicesData | CombatData | MapData;

interface TreeConnection {
  source: { node: string; port: string };
  target: { node: string; port: string };
}

interface ParsedTree {
  nodeMap: Map<string, NodeData>;
  /** `"${sourceId}::${port}"` → targetId */
  edges: Map<string, string>;
  firstNodeId: string | undefined;
}

// ─── Tree parser ──────────────────────────────────────────────────────────────

function parseTree(json: string): ParsedTree {
  const tree: {
    nodes: Array<{ type: string; x: number; y: number; data: NodeData }>;
    connections: TreeConnection[];
  } = JSON.parse(json);

  const nodeMap = new Map<string, NodeData>();
  for (const n of tree.nodes ?? []) {
    if (n.data?.id) nodeMap.set(n.data.id, n.data);
  }

  const edges = new Map<string, string>();
  for (const conn of tree.connections ?? []) {
    edges.set(`${conn.source.node}::${conn.source.port}`, conn.target.node);
  }

  // StartNode always has id 'start-node' and port 'start-output'
  const firstNodeId =
    edges.get('start-node::start-output') ??
    edges.get('start-node::output');

  return { nodeMap, edges, firstNodeId };
}

// ─── Component ────────────────────────────────────────────────────────────────

const CampaignSessionPage: Component = () => {
  const params = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [campaignTitle, setCampaignTitle] = createSignal('');

  const [parsedTree, setParsedTree] = createSignal<ParsedTree | null>(null);
  const [currentNodeId, setCurrentNodeId] = createSignal<string | undefined>();

  // History of visited node IDs
  const [history, setHistory] = createSignal<string[]>([]);

  onMount(async () => {
    try {
      setLoading(true);
      const response = await CampaignService.getCampaign(params.id);
      const campaign = mapCampaignResponse(response);
      setCampaignTitle(campaign.title);

      if (!campaign.campaignTreeDefinition) {
        setError(
          'Cette campagne ne possède pas encore de scénario. Définissez-en un dans le Campaign Manager.',
        );
        return;
      }

      const tree = parseTree(campaign.campaignTreeDefinition);
      setParsedTree(tree);
      console.log('Parsed campaign tree:', tree);

      if (!tree.firstNodeId) {
        setError(
          'Le scénario ne possède pas de point de départ. Connectez un bloc au nœud de départ dans le Campaign Manager.',
        );
        return;
      }

      setCurrentNodeId(tree.firstNodeId);
    } catch (err: any) {
      console.error('Failed to load campaign session:', err);
      setError('Impossible de charger la campagne.');
    } finally {
      setLoading(false);
    }
  });

  // Always reads the latest node from the signal
  const currentNode = (): NodeData | null => {
    const tree = parsedTree();
    const id = currentNodeId();
    if (!tree || !id) return null;
    return tree.nodeMap.get(id) ?? null;
  };

  const followPort = (port: string) => {
    const tree = parsedTree();
    const node = currentNode();
    if (!tree || !node) return;
    const nextId = tree.edges.get(`${node.id}::${port}`);
    if (!nextId) return;
    setHistory(h => [...h, node.id]);
    setCurrentNodeId(nextId);
  };

  const hasPort = (port: string): boolean => {
    const tree = parsedTree();
    const node = currentNode();
    if (!tree || !node) return false;
    return tree.edges.has(`${node.id}::${port}`);
  };

  // ─── Shared sub-components (pure JSX, read signals reactively) ──────────────

  const EndBanner = () => (
    <div class="flex flex-col items-center gap-4 py-6">
      <div class="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
        <span class="text-3xl">🏁</span>
      </div>
      <p class="text-slate-400 text-lg font-medium">Fin du scénario</p>
      <button
        onClick={() => navigate(`/campaigns/${params.id}`)}
        class="px-6 py-3 bg-white/10 hover:bg-white/15 border border-white/20 text-white rounded-xl transition-all font-medium"
      >
        Retour à la campagne
      </button>
    </div>
  );

  // ─── JSX ──────────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        width: '100vw',
        'min-height': '100vh',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f1a 100%)',
        color: '#d4d4d4',
        'font-family': 'system-ui, -apple-system, sans-serif',
        display: 'flex',
        'flex-direction': 'column',
      }}
    >
      {/* Header */}
      <header class="sticky top-0 z-20 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/40 backdrop-blur-md">
        <button
          onClick={() => navigate(`/campaigns/${params.id}`)}
          class="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
        >
          <ArrowLeft class="w-5 h-5" />
          <span class="hidden sm:inline">Retour à la campagne</span>
        </button>

        <div class="text-center">
          <p class="text-xs text-purple-400 uppercase tracking-wider">Session en cours</p>
          <h1 class="font-display text-lg text-white">{campaignTitle()}</h1>
        </div>

        <div class="text-sm text-slate-400 min-w-[60px] text-right">
          <Show when={history().length > 0}>
            <span>{history().length + 1} blocs</span>
          </Show>
        </div>
      </header>

      {/* Main */}
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
            <button
              onClick={() => navigate(`/campaigns/${params.id}`)}
              class="px-6 py-3 bg-white/10 hover:bg-white/15 border border-white/20 text-white rounded-xl transition-all"
            >
              Retour
            </button>
          </div>
        </Show>

        {/* Session content — Switch reads currentNode() reactively on each render */}
        <Show when={!loading() && !error()}>
          <div class="w-full max-w-2xl">

            {/* Breadcrumb */}
            <Show when={history().length > 0}>
              <div class="flex items-center gap-1 text-slate-500 text-sm mb-8 overflow-x-auto pb-1">
                <For each={history()}>
                  {(id) => {
                    const n = parsedTree()?.nodeMap.get(id);
                    if (!n) return null;
                    return (
                      <>
                        <span class="shrink-0 max-w-[120px] truncate">{(n as any).title || n.type}</span>
                        <ChevronRight class="w-3 h-3 shrink-0 text-slate-600" />
                      </>
                    );
                  }}
                </For>
                <Show when={currentNode()}>
                  <span class="shrink-0 text-white font-medium">{(currentNode() as any)?.title || currentNode()?.type}</span>
                </Show>
              </div>
            </Show>

            {/* Block card */}
            <div class="bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
              <Switch
                fallback={
                  <Show when={!currentNode()}>
                    <div class="text-center text-slate-400 py-6">Aucun bloc à afficher.</div>
                  </Show>
                }
              >
                {/* ── SCENE ── */}
                <Match when={currentNode()?.type === 'scene'}>
                  <div class="max-w-2xl mx-auto">
                    <div class="flex items-center gap-3 mb-6">
                      <div class="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center">
                        <BookOpen class="w-5 h-5 text-purple-400" />
                      </div>
                      <div>
                        <p class="text-xs text-purple-400 uppercase tracking-wider font-medium">Scène</p>
                        <h2 class="text-2xl font-display text-white">
                          {(currentNode() as SceneData)?.title || 'Scène sans titre'}
                        </h2>
                      </div>
                    </div>

                    <div class="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 leading-relaxed text-slate-200 text-lg whitespace-pre-wrap min-h-[120px]">
                      <Show
                        when={(currentNode() as SceneData)?.text}
                        fallback={<span class="text-slate-500 italic">Aucun texte pour cette scène.</span>}
                      >
                        {(currentNode() as SceneData)?.text}
                      </Show>
                    </div>

                    <div class="flex justify-end">
                      <Show when={hasPort('output')} fallback={<EndBanner />}>
                        <button
                          onClick={() => followPort('output')}
                          class="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-purple-500/20"
                        >
                          Continuer
                          <ChevronRight class="w-5 h-5" />
                        </button>
                      </Show>
                    </div>
                  </div>
                </Match>

                {/* ── CHOICES ── */}
                <Match when={currentNode()?.type === 'choices'}>
                  <div class="max-w-2xl mx-auto">
                    <div class="flex items-center gap-3 mb-6">
                      <div class="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                        <svg class="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <rect x="3" y="3" width="7" height="7" rx="1" />
                          <rect x="14" y="3" width="7" height="7" rx="1" />
                          <rect x="3" y="14" width="7" height="7" rx="1" />
                          <rect x="14" y="14" width="7" height="7" rx="1" />
                        </svg>
                      </div>
                      <div>
                        <p class="text-xs text-emerald-400 uppercase tracking-wider font-medium">Choix</p>
                        <h2 class="text-2xl font-display text-white">
                          {(currentNode() as ChoicesData)?.title || 'Choix sans titre'}
                        </h2>
                      </div>
                    </div>

                    <Show when={(currentNode() as ChoicesData)?.text}>
                      <div class="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6 leading-relaxed text-slate-200 text-lg whitespace-pre-wrap">
                        {(currentNode() as ChoicesData)?.text}
                      </div>
                    </Show>

                    <Show
                      when={(currentNode() as ChoicesData)?.choices?.length > 0}
                      fallback={<EndBanner />}
                    >
                      <div class="flex flex-col gap-3">
                        <For each={(currentNode() as ChoicesData)?.choices}>
                          {(choice, i) => (
                            <button
                              onClick={() => followPort(`choice-${i()}`)}
                              class="text-left px-5 py-4 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 hover:border-emerald-500/60 rounded-xl text-white font-medium transition-all flex items-center gap-3 group"
                            >
                              <span class="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-sm flex-shrink-0 group-hover:bg-emerald-500/30 transition-colors">
                                {i() + 1}
                              </span>
                              <span class="flex-1">{choice || `Choix ${i() + 1}`}</span>
                              <Show when={hasPort(`choice-${i()}`)}>
                                <ChevronRight class="w-4 h-4 text-emerald-400/60 group-hover:text-emerald-400 transition-colors" />
                              </Show>
                            </button>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                </Match>

                {/* ── COMBAT ── */}
                <Match when={currentNode()?.type === 'combat'}>
                  <div class="max-w-2xl mx-auto">
                    <div class="flex items-center gap-3 mb-6">
                      <div class="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center">
                        <Sword class="w-5 h-5 text-red-400" />
                      </div>
                      <div>
                        <p class="text-xs text-red-400 uppercase tracking-wider font-medium">Combat</p>
                        <h2 class="text-2xl font-display text-white">
                          {(currentNode() as CombatData)?.title || 'Combat sans titre'}
                        </h2>
                      </div>
                    </div>

                    <div class="bg-red-500/5 border border-red-500/20 rounded-2xl p-6 mb-8 text-center">
                      <Sword class="w-12 h-12 text-red-400/40 mx-auto mb-3" />
                      <p class="text-slate-400 italic">La gestion des combats arrive bientôt.</p>
                    </div>

                    <div class="flex justify-end">
                      <Show when={hasPort('output')} fallback={<EndBanner />}>
                        <button
                          onClick={() => followPort('output')}
                          class="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-red-500/20"
                        >
                          Passer
                          <ChevronRight class="w-5 h-5" />
                        </button>
                      </Show>
                    </div>
                  </div>
                </Match>

                {/* ── MAP ── */}
                <Match when={currentNode()?.type === 'map'}>
                  <div class="max-w-2xl mx-auto">
                    <div class="flex items-center gap-3 mb-6">
                      <div class="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center">
                        <MapIcon class="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <p class="text-xs text-blue-400 uppercase tracking-wider font-medium">Carte</p>
                        <h2 class="text-2xl font-display text-white">
                          {(currentNode() as MapData)?.title || 'Carte sans titre'}
                        </h2>
                      </div>
                    </div>

                    <div class="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-6 mb-8 flex flex-col items-center gap-4 text-center">
                      <MapIcon class="w-14 h-14 text-blue-400/40" />
                      <Show
                        when={(currentNode() as MapData)?.selectedMap}
                        fallback={<p class="text-slate-500 italic">Aucune carte sélectionnée pour ce bloc.</p>}
                      >
                        <div>
                          <p class="text-sm text-blue-400 mb-1">Carte sélectionnée</p>
                          <p class="text-2xl font-display text-white">{(currentNode() as MapData)?.selectedMap}</p>
                        </div>
                      </Show>
                    </div>

                    <div class="flex justify-end">
                      <Show when={hasPort('output')} fallback={<EndBanner />}>
                        <button
                          onClick={() => followPort('output')}
                          class="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/20"
                        >
                          Continuer
                          <ChevronRight class="w-5 h-5" />
                        </button>
                      </Show>
                    </div>
                  </div>
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
