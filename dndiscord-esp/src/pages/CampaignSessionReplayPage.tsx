import { Component, createSignal, For, onMount, Show } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import {
  BookOpen,
  ChevronRight,
  Clock,
  Loader2,
} from 'lucide-solid';
import {
  CampaignService,
  type GameSessionResponse,
  GameSessionStatus,
} from '@/services/campaign.service';
import {
  CampaignTreeCanvas,
  type CampaignTreeCanvasRef,
} from '@/components/campaign-tree-canvas/CampagnTreeCanvas';
import PageMeta from '../layouts/PageMeta';
import { t } from '../i18n';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(startedAt: string, endedAt?: string): string {
  const ms =
    (endedAt ? new Date(endedAt) : new Date()).getTime() -
    new Date(startedAt).getTime();
  const totalMin = Math.floor(ms / 60_000);
  if (totalMin < 1) return '< 1 min';
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

const NODE_TYPE_CFG: Record<
  string,
  { labelKey: string; color: string; icon: string }
> = {
  scene:   { labelKey: 'sessionReplay.nodeType.scene',   color: '#a855f7', icon: '📖' },
  choices: { labelKey: 'sessionReplay.nodeType.choices', color: '#22c55e', icon: '🔀' },
  combat:  { labelKey: 'sessionReplay.nodeType.combat',  color: '#ef4444', icon: '⚔️' },
  map:     { labelKey: 'sessionReplay.nodeType.map',     color: '#3b82f6', icon: '🗺️' },
};

const STATUS_CFG: Record<GameSessionStatus, { labelKey: string; cls: string }> = {
  [GameSessionStatus.Active]:    { labelKey: 'sessionsList.status.active',    cls: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30' },
  [GameSessionStatus.Completed]: { labelKey: 'sessionsList.status.completed', cls: 'text-purple-400  bg-purple-500/15  border-purple-500/30'  },
  [GameSessionStatus.Abandoned]: { labelKey: 'sessionsList.status.abandoned', cls: 'text-slate-400   bg-slate-500/15   border-slate-500/30'   },
};

// ─── Component ────────────────────────────────────────────────────────────────

const CampaignSessionReplayPage: Component = () => {
  const params   = useParams();
  const navigate = useNavigate();

  const [loading, setLoading]           = createSignal(true);
  const [error, setError]               = createSignal<string | null>(null);
  const [session, setSession]           = createSignal<GameSessionResponse | null>(null);
  const [campaignName, setCampaignName] = createSignal('');
  const [canvasLoaded, setCanvasLoaded] = createSignal(false);

  let canvasRef: CampaignTreeCanvasRef | undefined;

  // Called by the CampaignTreeCanvas once it mounts and exposes its methods
  const handleCanvasRef = (ref: CampaignTreeCanvasRef) => {
    canvasRef = ref;
  };

  /**
   * Once the canvas is ready AND the session is loaded, import tree + highlight.
   * @param treeDefinition  Raw draw2d canvas JSON from campaignTreeDefinition (backend).
   *                        Do NOT pass the `dnd-campaign-tree-*` custom format —
   *                        it is incompatible with importData().
   */
  const applyHighlight = (sess: GameSessionResponse, treeDefinition: string | null | undefined) => {
    // Import the draw2d canvas data so the visual tree is rendered
    if (treeDefinition && canvasRef) {
      try {
        canvasRef.importData(JSON.parse(treeDefinition));
      } catch (e) {
        console.warn('[Replay] Failed to import canvas data:', e);
      }
    }

    // Build visited node IDs + traversed edges from session history
    const visitedIds = sess.entries.map((e) => e.nodeId);
    // Also include the last currentNodeId if the session is still active
    if (sess.currentNodeId && !visitedIds.includes(sess.currentNodeId)) {
      visitedIds.push(sess.currentNodeId);
    }

    const traversedEdges = sess.entries
      .filter((e) => e.portUsed)
      .map((e) => ({ sourceId: e.nodeId, port: e.portUsed! }));

    // Small delay to let draw2d render the imported figures before colouring them
    setTimeout(() => {
      try {
        canvasRef?.highlightVisited(visitedIds, traversedEdges);
      } catch (e) {
        console.warn('[Replay] Failed to highlight visited nodes:', e);
      } finally {
        // Always unblock the canvas spinner, even if highlighting threw
        setCanvasLoaded(true);
      }
    }, 300);
  };

  onMount(async () => {
    try {
      const [camp, sess] = await Promise.all([
        CampaignService.getCampaign(params.id),
        CampaignService.getSession(params.id, params.sessionId),
      ]);
      setCampaignName(camp.name);
      setSession(sess);
      // Use the draw2d canvas definition from the backend — the per-campaign
      // localStorage key (`dnd-campaign-tree-*`) stores a different custom
      // format that is incompatible with canvas.importData().
      applyHighlight(sess, camp.campaignTreeDefinition);
    } catch (e) {
      console.error('[Replay] Failed to load session:', e);
      setError(t('sessionReplay.loadError'));
      setCanvasLoaded(true); // unblock spinner on error too
    } finally {
      setLoading(false);
    }
  });

  // ── Type icon helper ──────────────────────────────────────────────────────
  const TypeIcon = (props: { type: string }) => {
    const cfg = NODE_TYPE_CFG[props.type];
    if (!cfg) return <span class="text-sm">📌</span>;
    return <span class="text-sm">{cfg.icon}</span>;
  };

  const sess = () => session();

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        'flex-direction': 'column',
        color: '#d4d4d4',
        'font-family': 'system-ui,sans-serif',
        overflow: 'hidden',
      }}
    >
      <PageMeta title={t('page.sessionReplay.title')} />

      {/* ── Loading / Error ─────────────────────────────────────────────────── */}
      <Show when={loading()}>
        <div class="flex-1 flex flex-col items-center justify-center gap-4 text-slate-400">
          <Loader2 class="w-10 h-10 animate-spin text-purple-400" />
          <p>{t('sessionReplay.loading')}</p>
        </div>
      </Show>

      <Show when={!loading() && error()}>
        <div class="flex-1 flex flex-col items-center justify-center gap-4 text-center px-4">
          <p class="text-red-400">{error()}</p>
          <button
            onClick={() => navigate(`/campaigns/${params.id}/sessions`)}
            class="px-6 py-3 bg-white/10 hover:bg-white/15 border border-white/20 text-white rounded-xl transition-all"
          >
            {t('topbar.back')}
          </button>
        </div>
      </Show>

      {/* ── Main two-panel layout ────────────────────────────────────────────── */}
      <Show when={!loading() && !error() && sess()}>
        <div class="flex-1 flex overflow-hidden">

          {/* ── Left: Canvas ─────────────────────────────────────────────────── */}
          <div class="flex-1 relative overflow-hidden border-r border-white/10">
            <Show when={!canvasLoaded()}>
              <div class="absolute inset-0 flex items-center justify-center z-10 bg-black/30 backdrop-blur-sm">
                <div class="flex flex-col items-center gap-3 text-slate-400">
                  <Loader2 class="w-8 h-8 animate-spin text-purple-400" />
                  <p class="text-sm">{t('sessionReplay.loadingScenario')}</p>
                </div>
              </div>
            </Show>

            {/* Legend overlay */}
            <div class="absolute top-3 left-3 z-10 flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-xl border border-white/10 text-xs text-slate-400">
              <span class="w-3 h-3 rounded-sm bg-[#166534] border border-[#22c55e] flex-shrink-0" />
              {t('sessionReplay.legend.visitedNode')}
              <span class="w-6 h-0.5 bg-[#22c55e] flex-shrink-0 ml-1" />
              {t('sessionReplay.legend.traversedPath')}
            </div>

            <CampaignTreeCanvas
              ref={handleCanvasRef}
              readOnly={true}
              canvasId="campaign-replay-canvas"
            />
          </div>

          {/* ── Right: History journal ─────────────────────────────────────── */}
          <aside class="w-80 flex-shrink-0 flex flex-col bg-black/30 overflow-hidden">
            <div class="px-5 py-4 border-b border-white/10">
              <h2 class="font-display text-base text-white flex items-center gap-2">
                <BookOpen class="w-4 h-4 text-purple-400" />
                {t('sessionReplay.journal.title')}
              </h2>
              <p class="text-xs text-slate-500 mt-0.5">
                {sess()!.entries.length}{' '}
                {sess()!.entries.length !== 1
                  ? t('sessionReplay.journal.steps.other')
                  : t('sessionReplay.journal.steps.one')}
              </p>
            </div>

            <div class="flex-1 overflow-y-auto px-4 py-4 space-y-2">
              <Show when={sess()!.entries.length === 0}>
                <p class="text-slate-600 text-sm italic text-center py-8">
                  {t('sessionReplay.journal.empty')}
                </p>
              </Show>

              <For each={sess()!.entries}>
                {(entry, i) => {
                  const cfg = NODE_TYPE_CFG[entry.nodeType];
                  return (
                    <div class="flex gap-3">
                      {/* Timeline line */}
                      <div class="flex flex-col items-center flex-shrink-0">
                        <div
                          class="w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0"
                          style={{
                            background: `${cfg?.color ?? '#888'}22`,
                            border: `1px solid ${cfg?.color ?? '#888'}44`,
                          }}
                        >
                          <TypeIcon type={entry.nodeType} />
                        </div>
                        <Show when={i() < sess()!.entries.length - 1}>
                          <div class="w-px flex-1 bg-white/10 mt-1" />
                        </Show>
                      </div>

                      {/* Content */}
                      <div class="pb-4 min-w-0">
                        <p class="text-white text-sm font-medium truncate">
                          {entry.nodeTitle || entry.nodeType}
                        </p>
                        <Show when={entry.choiceText}>
                          <p class="text-xs text-emerald-400 mt-0.5 flex items-center gap-1">
                            <ChevronRight class="w-3 h-3 flex-shrink-0" />
                            <span class="truncate">{entry.choiceText}</span>
                          </p>
                        </Show>
                        <p class="text-xs text-slate-600 mt-0.5">
                          {new Date(entry.visitedAt).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  );
                }}
              </For>

              {/* End state */}
              <Show when={sess()!.status !== GameSessionStatus.Active}>
                <div class="flex gap-3 mt-2">
                  <div class="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xs flex-shrink-0">
                    🏁
                  </div>
                  <div class="pb-2">
                    <p class="text-slate-400 text-sm font-medium">
                      {sess()!.status === GameSessionStatus.Completed
                        ? t('sessionReplay.endState.completed')
                        : t('sessionReplay.endState.abandoned')}
                    </p>
                    <Show when={sess()!.endedAt}>
                      <p class="text-xs text-slate-600">
                        {formatDate(sess()!.endedAt!)}
                      </p>
                    </Show>
                  </div>
                </div>
              </Show>
            </div>
          </aside>
        </div>
      </Show>
    </div>
  );
};

export default CampaignSessionReplayPage;
