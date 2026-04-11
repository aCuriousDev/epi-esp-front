import { Component, createSignal, onMount, Show, For } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { ArrowLeft, Play, Clock, CheckCircle, BookOpen, ChevronRight, Loader2 } from 'lucide-solid';
import { CampaignService, GameSessionResponse, GameSessionStatus } from '@/services/campaign.service';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDuration(start: string, end?: string) {
  const ms = new Date(end ?? new Date()).getTime() - new Date(start).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h${(mins % 60).toString().padStart(2, '0')}`;
}

const statusConfig = {
  [GameSessionStatus.Active]: { label: 'En cours', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  [GameSessionStatus.Completed]: { label: 'Terminée', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30' },
  [GameSessionStatus.Abandoned]: { label: 'Abandonnée', color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/30' },
};

const CampaignSessionsListPage: Component = () => {
  const params = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = createSignal(true);
  const [sessions, setSessions] = createSignal<GameSessionResponse[]>([]);
  const [campaignTitle, setCampaignTitle] = createSignal('');

  onMount(async () => {
    try {
      const [campaignRes, sessionsRes] = await Promise.all([
        CampaignService.getCampaign(params.id),
        CampaignService.listSessions(params.id),
      ]);
      setCampaignTitle(campaignRes.name);
      setSessions(sessionsRes.items);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoading(false);
    }
  });

  return (
    <div style={{
      width: '100vw', 'min-height': '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f1a 100%)',
      color: '#d4d4d4', 'font-family': 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Header */}
      <header class="sticky top-0 z-20 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/40 backdrop-blur-md">
        <button onClick={() => navigate(`/campaigns/${params.id}`)} class="flex items-center gap-2 text-slate-300 hover:text-white transition-colors">
          <ArrowLeft class="w-5 h-5" />
          <span class="hidden sm:inline">Retour à la campagne</span>
        </button>
        <div class="text-center">
          <p class="text-xs text-purple-400 uppercase tracking-wider">Historique</p>
          <h1 class="font-display text-lg text-white">{campaignTitle()}</h1>
        </div>
        <button
          onClick={() => navigate(`/campaigns/${params.id}/session`)}
          class="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl transition-all"
        >
          <Play class="w-4 h-4" />
          <span class="hidden sm:inline">Nouvelle session</span>
        </button>
      </header>

      <main class="max-w-3xl mx-auto px-4 py-10">
        <Show when={loading()}>
          <div class="flex items-center justify-center py-20"><Loader2 class="w-8 h-8 animate-spin text-purple-400" /></div>
        </Show>

        <Show when={!loading() && sessions().length === 0}>
          <div class="text-center py-20">
            <BookOpen class="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p class="text-slate-400 text-lg mb-2">Aucune session pour l'instant</p>
            <p class="text-slate-500 text-sm mb-6">Lancez une session depuis la page de la campagne.</p>
            <button onClick={() => navigate(`/campaigns/${params.id}/session`)} class="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-semibold transition-all hover:from-purple-500 hover:to-indigo-500">
              Lancer une session
            </button>
          </div>
        </Show>

        <Show when={!loading() && sessions().length > 0}>
          <div class="flex flex-col gap-3">
            <For each={sessions()}>
              {(session) => {
                const cfg = statusConfig[session.status] ?? statusConfig[GameSessionStatus.Abandoned];
                return (
                  <div
                    class="bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex items-center gap-4 hover:border-white/20 transition-all cursor-pointer group"
                    onClick={() => navigate(`/campaigns/${params.id}/sessions/${session.id}`)}
                  >
                    <div class="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
                      <Show when={session.status === GameSessionStatus.Completed} fallback={<Play class="w-5 h-5 text-purple-400" />}>
                        <CheckCircle class="w-5 h-5 text-blue-400" />
                      </Show>
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-1">
                        <span class={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                        <span class="text-slate-400 text-sm">{session.entries.length} bloc{session.entries.length !== 1 ? 's' : ''} parcourus</span>
                      </div>
                      <p class="text-white font-medium">{formatDate(session.startedAt)}</p>
                      <div class="flex items-center gap-1 text-slate-500 text-sm mt-0.5">
                        <Clock class="w-3 h-3" />
                        <span>{formatDuration(session.startedAt, session.endedAt)}</span>
                      </div>
                    </div>
                    <ChevronRight class="w-5 h-5 text-slate-500 group-hover:text-white transition-colors flex-shrink-0" />
                  </div>
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
