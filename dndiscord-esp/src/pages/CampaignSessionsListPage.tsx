import { Component, createSignal, For, onMount, Show } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { BookOpen, ChevronRight, Clock, Loader2 } from 'lucide-solid';
import {
  CampaignService,
  type GameSessionResponse,
  GameSessionStatus,
} from '@/services/campaign.service';
import PageMeta from '../layouts/PageMeta';
import { t } from '../i18n';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STATUS_CFG: Record<GameSessionStatus, { labelKey: string; cls: string }> = {
  [GameSessionStatus.Active]: {
    labelKey: 'sessionsList.status.active',
    cls: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
  },
  [GameSessionStatus.Completed]: {
    labelKey: 'sessionsList.status.completed',
    cls: 'text-purple-400 bg-purple-500/15 border-purple-500/30',
  },
  [GameSessionStatus.Abandoned]: {
    labelKey: 'sessionsList.status.abandoned',
    cls: 'text-slate-400 bg-slate-500/15 border-slate-500/30',
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

const CampaignSessionsListPage: Component = () => {
  const params   = useParams();
  const navigate = useNavigate();

  const [loading, setLoading]         = createSignal(true);
  const [error, setError]             = createSignal<string | null>(null);
  const [sessions, setSessions]       = createSignal<GameSessionResponse[]>([]);
  const [campaignName, setCampaignName] = createSignal('');

  onMount(async () => {
    try {
      const [camp, list] = await Promise.all([
        CampaignService.getCampaign(params.id),
        CampaignService.listSessions(params.id),
      ]);
      setCampaignName(camp.name);
      // API already returns desc order; keep it
      setSessions(list.items);
    } catch (e) {
      console.error('[SessionsList] Failed to load sessions:', e);
      setError(t('sessionsList.loadError'));
    } finally {
      setLoading(false);
    }
  });

  return (
    <div
      style={{
        width: '100vw',
        'min-height': '100vh',
        color: '#d4d4d4',
        'font-family': 'system-ui,sans-serif',
      }}
    >
      <PageMeta title={t('page.sessionsList.title')} />

      <main class="max-w-3xl mx-auto px-4 py-10">
        {/* Loading */}
        <Show when={loading()}>
          <div class="flex flex-col items-center gap-4 py-24 text-slate-400">
            <Loader2 class="w-10 h-10 animate-spin text-purple-400" />
            <p>{t('sessionsList.loading')}</p>
          </div>
        </Show>

        {/* Error */}
        <Show when={!loading() && error()}>
          <div class="text-center py-24">
            <p class="text-red-400 mb-4">{error()}</p>
            <button
              onClick={() => navigate(`/campaigns/${params.id}`)}
              class="px-6 py-3 bg-white/10 hover:bg-white/15 border border-white/20 text-white rounded-xl transition-all"
            >
              {t('topbar.back')}
            </button>
          </div>
        </Show>

        {/* Content */}
        <Show when={!loading() && !error()}>
          {/* Empty state */}
          <Show when={sessions().length === 0}>
            <div class="flex flex-col items-center gap-4 py-24 text-slate-500">
              <BookOpen class="w-14 h-14 opacity-25" />
              <p class="text-lg">{t('sessionsList.empty')}</p>
              <p class="text-sm text-slate-600">
                {t('sessionsList.emptyHint')}
              </p>
            </div>
          </Show>

          {/* Session list */}
          <div class="space-y-3">
            <For each={sessions()}>
              {(session, i) => {
                const cfg =
                  STATUS_CFG[session.status] ??
                  STATUS_CFG[GameSessionStatus.Abandoned];
                return (
                  <button
                    onClick={() =>
                      navigate(
                        `/campaigns/${params.id}/sessions/${session.id}`,
                      )
                    }
                    class="w-full text-left bg-game-dark/60 backdrop-blur-xl border border-white/10 hover:border-purple-500/40 rounded-2xl px-6 py-5 transition-all hover:bg-white/5 group"
                  >
                    <div class="flex items-center justify-between gap-4">
                      {/* Left */}
                      <div class="flex items-center gap-4 flex-1 min-w-0">
                        {/* Index badge */}
                        <div class="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0 text-purple-400 font-bold text-sm">
                          #{sessions().length - i()}
                        </div>

                        <div class="min-w-0">
                          <div class="flex items-center gap-2 flex-wrap mb-1">
                            <span
                              class={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.cls}`}
                            >
                              {t(cfg.labelKey as any)}
                            </span>
                            <span class="text-xs text-slate-500">
                              {formatDate(session.startedAt)}
                            </span>
                          </div>
                          <div class="flex items-center gap-4 text-sm text-slate-400">
                            <span class="flex items-center gap-1.5">
                              <Clock class="w-3.5 h-3.5" />
                              {formatDuration(session.startedAt, session.endedAt)}
                            </span>
                            <span class="flex items-center gap-1.5">
                              <BookOpen class="w-3.5 h-3.5" />
                              {session.entries.length}{' '}
                              {session.entries.length === 1
                                ? t('sessionsList.blocVisited.one')
                                : t('sessionsList.blocVisited.other')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Arrow */}
                      <ChevronRight class="w-5 h-5 text-slate-600 group-hover:text-white transition-colors flex-shrink-0" />
                    </div>
                  </button>
                );
              }}
            </For>
          </div>
        </Show>
      </main>
    </div>
  );
};

export default CampaignSessionsListPage;
