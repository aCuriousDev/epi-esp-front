import { Component, createSignal, onMount, Show, For } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { ArrowLeft, BookOpen, Map as MapIcon, Sword, Clock, CheckCircle, ChevronRight, Loader2 } from 'lucide-solid';
import { CampaignService, GameSessionResponse, GameSessionStatus, mapCampaignResponse } from '@/services/campaign.service';
import { CampaignTreeCanvas, CampaignTreeCanvasRef } from '@/components/campaign-tree-canvas/CampagnTreeCanvas';

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

const nodeTypeConfig: Record<string, { color: string; label: string }> = {
  scene: { color: 'text-purple-400', label: 'Scène' },
  choices: { color: 'text-emerald-400', label: 'Choix' },
  combat: { color: 'text-red-400', label: 'Combat' },
  map: { color: 'text-blue-400', label: 'Carte' },
};

const CampaignSessionReplayPage: Component = () => {
  const params = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = createSignal(true);
  const [session, setSession] = createSignal<GameSessionResponse | null>(null);
  const [campaignTitle, setCampaignTitle] = createSignal('');
  const [canvasRef, setCanvasRef] = createSignal<CampaignTreeCanvasRef | undefined>();
  const [treeLoaded, setTreeLoaded] = createSignal(false);
  const [treeJson, setTreeJson] = createSignal<string | undefined>();

  onMount(async () => {
    try {
      const [campaignRes, sessionRes] = await Promise.all([
        CampaignService.getCampaign(params.id),
        CampaignService.getSession(params.id, params.sessionId),
      ]);
      const campaign = mapCampaignResponse(campaignRes);
      setCampaignTitle(campaign.title);
      setSession(sessionRes);
      if (campaign.campaignTreeDefinition) {
        setTreeJson(campaign.campaignTreeDefinition);
      }
    } catch (err) {
      console.error('Failed to load session replay:', err);
    } finally {
      setLoading(false);
    }
  });

  // Called when canvas ref becomes available — import tree + apply highlights
  const handleCanvasRef = (ref: CampaignTreeCanvasRef) => {
    setCanvasRef(ref);
    if (treeJson()) {
      ref.importData(treeJson());
      applyHighlights(ref);
      setTreeLoaded(true);
    }
  };

  const applyHighlights = (ref: CampaignTreeCanvasRef) => {
    const s = session();
    if (!s || !ref) return;

    const visitedIds = s.entries.map(e => e.nodeId);
    // "sourceId::port" → traversed
    const traversedEdges = s.entries
      .filter(e => e.portUsed)
      .map(e => ({ sourceId: e.nodeId, port: e.portUsed! }));

    ref.highlightVisited?.(visitedIds, traversedEdges);
  };

  const statusConfig = {
    [GameSessionStatus.Active]: { label: 'En cours', color: 'text-emerald-400' },
    [GameSessionStatus.Completed]: { label: 'Terminée', color: 'text-blue-400' },
    [GameSessionStatus.Abandoned]: { label: 'Abandonnée', color: 'text-slate-400' },
  };

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f1a 100%)',
      color: '#d4d4d4', 'font-family': 'system-ui, -apple-system, sans-serif',
      display: 'flex', 'flex-direction': 'column',
    }}>
      {/* Header */}
      <header class="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/40 backdrop-blur-md z-20">
        <button onClick={() => navigate(`/campaigns/${params.id}/sessions`)} class="flex items-center gap-2 text-slate-300 hover:text-white transition-colors">
          <ArrowLeft class="w-5 h-5" />
          <span class="hidden sm:inline">Retour aux sessions</span>
        </button>
        <div class="text-center">
          <p class="text-xs text-purple-400 uppercase tracking-wider">Replay de session</p>
          <h1 class="font-display text-lg text-white">{campaignTitle()}</h1>
        </div>
        <Show when={session()}>
          {(s) => {
            const cfg = statusConfig[s().status];
            return <span class={`text-sm font-medium ${cfg?.color}`}>{cfg?.label}</span>;
          }}
        </Show>
      </header>

      <Show when={loading()}>
        <div class="flex-1 flex items-center justify-center">
          <Loader2 class="w-10 h-10 animate-spin text-purple-400" />
        </div>
      </Show>

      <Show when={!loading()}>
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Canvas — readonly tree with highlights */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <Show when={treeJson()} fallback={
              <div class="flex items-center justify-center h-full text-slate-500">
                <p>Aucun arbre de scénario disponible.</p>
              </div>
            }>
              <CampaignTreeCanvas
                ref={handleCanvasRef}
                readOnly={true}
                onNodeSelect={() => {}}
              />
            </Show>
          </div>

          {/* History panel */}
          <aside style={{
            width: '320px', 'flex-shrink': '0',
            background: '#0f0f1a', 'border-left': '1px solid #333',
            display: 'flex', 'flex-direction': 'column',
            overflow: 'hidden',
          }}>
            <div class="p-4 border-b border-white/10">
              <h2 class="text-white font-display text-lg">Journal de session</h2>
              <Show when={session()}>
                <p class="text-slate-400 text-sm mt-1">
                  {session()!.entries.length} bloc{session()!.entries.length !== 1 ? 's' : ''} parcourus
                </p>
              </Show>
            </div>

            <div style={{ flex: 1, 'overflow-y': 'auto', padding: '1rem' }}>
              <Show when={session()?.entries.length === 0}>
                <p class="text-slate-500 italic text-sm text-center py-8">Aucune entrée dans cette session.</p>
              </Show>

              <div class="flex flex-col gap-2">
                <For each={session()?.entries ?? []}>
                  {(entry, i) => {
                    const cfg = nodeTypeConfig[entry.nodeType] ?? { color: 'text-slate-400', label: entry.nodeType };
                    return (
                      <div class="bg-white/5 border border-white/10 rounded-xl p-3">
                        <div class="flex items-center gap-2 mb-1">
                          <span class="text-xs text-slate-500 font-mono">{String(i() + 1).padStart(2, '0')}</span>
                          <span class={`text-xs font-medium uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
                          <span class="text-slate-500 text-xs ml-auto">{formatTime(entry.visitedAt)}</span>
                        </div>
                        <p class="text-white text-sm font-medium">{entry.nodeTitle || 'Sans titre'}</p>
                        <Show when={entry.choiceText}>
                          <div class="mt-2 flex items-center gap-1.5 text-emerald-400 text-xs">
                            <ChevronRight class="w-3 h-3" />
                            <span class="italic">"{entry.choiceText}"</span>
                          </div>
                        </Show>
                      </div>
                    );
                  }}
                </For>
              </div>
            </div>
          </aside>
        </div>
      </Show>
    </div>
  );
};

export default CampaignSessionReplayPage;
