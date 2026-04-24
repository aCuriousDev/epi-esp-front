import { useNavigate } from "@solidjs/router";
import {
  ArrowLeft,
  Plus,
  Users,
  Crown,
  BookOpen,
  LogIn,
} from "lucide-solid";
import { createSignal, For, Show, onMount } from "solid-js";
import {
  Campaign,
  CampaignStatus,
  getStatusColor,
  getStatusLabel,
  CampaignVisibility,
} from "../types/campaign";
import {
  CampaignService,
  CampaignResponse,
  displayDungeonMasterName,
} from "../services/campaign.service";
import { authStore } from "../stores/auth.store";

/**
 * Map backend campaign status to frontend status
 */
function mapCampaignStatus(status: number | string): CampaignStatus {
  const statusNum = typeof status === "number" ? status : parseInt(status);
  switch (statusNum) {
    case 0: return CampaignStatus.Planning;
    case 1: return CampaignStatus.Active;
    case 2: return CampaignStatus.Paused;
    case 3: return CampaignStatus.Completed;
    case 4: return CampaignStatus.Archived;
    default: return CampaignStatus.Planning;
  }
}

/**
 * Map backend list-response to the front Campaign type. Only keeps fields the
 * backend actually persists; fabricated "sessions / level / tags / DM name"
 * scaffolding was removed because none of it round-tripped.
 */
function mapCampaignResponse(response: CampaignResponse): Campaign {
  return {
    id: response.id,
    title: response.name,
    description: response.description,
    coverImageUrl: response.imageUrl,
    status: mapCampaignStatus(response.status),
    visibility: response.isPublic
      ? CampaignVisibility.Public
      : CampaignVisibility.Private,
    dungeonMasterId: response.dungeonMasterId,
    maxPlayers: response.maxPlayers,
    currentPlayers: response.memberCount,
    createdAt: response.createdAt,
    updatedAt: response.updatedAt,
  };
}

export default function CampaignsPage() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = createSignal<Campaign[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  // Join-by-code state
  const [inviteCode, setInviteCode] = createSignal("");
  const [joining, setJoining] = createSignal(false);
  const [joinError, setJoinError] = createSignal<string | null>(null);

  onMount(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await CampaignService.listCampaigns({
        page: 1,
        pageSize: 100,
      });
      setCampaigns(response.items.map(mapCampaignResponse));
    } catch (err) {
      console.error("Failed to load campaigns:", err);
      setError("Impossible de charger les campagnes. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  });

  const handleJoin = async () => {
    const code = inviteCode().trim();
    if (!code) {
      setJoinError("Saisissez un code d'invitation.");
      return;
    }
    setJoining(true);
    setJoinError(null);
    try {
      const joined = await CampaignService.joinCampaign({ inviteCode: code });
      navigate(`/campaigns/${joined.id}`);
    } catch (err: any) {
      console.error("Failed to join campaign:", err);
      // ASP.NET's ProblemDetails puts the human-readable reason in `detail`
      // (lowercase). Reading only `title`/`error` silently swallowed the real
      // message ("Invalid invite code", "You are already a member", etc.).
      const msg = err?.response?.data?.detail
        ?? err?.response?.data?.title
        ?? err?.response?.data?.error
        ?? "Code invalide ou campagne introuvable.";
      setJoinError(msg);
    } finally {
      setJoining(false);
    }
  };

  return (
    <div class="campaigns-page min-h-screen w-full bg-brand-gradient">
      <div class="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div class="absolute top-1/4 -left-32 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        <div
          class="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse"
          style="animation-delay: 1s"
        />
        <div class="absolute top-3/4 left-1/3 w-64 h-64 bg-violet-500/8 rounded-full blur-3xl" />
      </div>

      <div class="vignette absolute inset-0" aria-hidden="true" />

      <header class="relative z-20 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-game-dark/70 backdrop-blur-md">
        <button
          onClick={() => navigate("/")}
          aria-label="Retour au menu"
          class="flex items-center gap-2 text-slate-300 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 rounded-lg px-2 py-1"
        >
          <ArrowLeft class="w-5 h-5" aria-hidden="true" />
          <span class="hidden sm:inline">Retour au menu</span>
        </button>

        <h1 class="font-display text-xl text-white tracking-wide">Campagnes</h1>

        <button
          onClick={() => navigate("/campaigns/create")}
          aria-label="Créer une nouvelle campagne"
          class="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl transition-all shadow-lg shadow-purple-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        >
          <Plus class="w-4 h-4" aria-hidden="true" />
          <span class="hidden sm:inline">Créer</span>
        </button>
      </header>

      <main class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div class="text-center mb-8">
          <h2 class="font-display text-4xl sm:text-5xl tracking-wide text-white drop-shadow-[0_2px_8px_rgba(139,92,246,0.5)]">
            Mes Campagnes
          </h2>
          <p class="mt-3 text-slate-300 max-w-xl mx-auto">
            Gérez vos aventures ou rejoignez une campagne existante via un code d'invitation.
          </p>
          <div class="mt-6 mx-auto decorative-divider" />
        </div>

        {/* Join-by-code panel — the only way a non-creator enters a campaign */}
        <div class="mb-8 mx-auto max-w-xl bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
          <label
            id="invite-code-label"
            for="invite-code-input"
            class="block text-sm text-slate-300 mb-1 font-medium"
          >
            Rejoindre avec un code d'invitation
          </label>
          <p id="invite-code-hint" class="text-xs text-slate-500 mb-3">
            Ce code est généré par le MJ depuis la page de la campagne (bouton "Générer un code").
            Il est distinct du code de session affiché en partie.
          </p>
          <div class="flex flex-col sm:flex-row gap-2">
            <input
              id="invite-code-input"
              type="text"
              value={inviteCode()}
              onInput={(e) => setInviteCode(e.currentTarget.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleJoin(); }}
              disabled={joining()}
              placeholder="XXXX-XXXX"
              aria-labelledby="invite-code-label"
              aria-describedby="invite-code-hint"
              aria-label="Code d'invitation"
              autocomplete="off"
              class="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white font-mono tracking-wider placeholder:text-slate-500 focus:border-purple-400/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900 disabled:opacity-50 transition-colors"
            />
            <button
              onClick={handleJoin}
              disabled={joining() || !inviteCode().trim()}
              class="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            >
              <LogIn class="w-4 h-4" aria-hidden="true" />
              {joining() ? "…" : "Rejoindre"}
            </button>
          </div>
          <Show when={joinError()}>
            <p class="mt-2 text-red-400 text-sm" role="alert" aria-live="polite">{joinError()}</p>
          </Show>
        </div>

        <Show when={error()}>
          <div class="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-center" role="alert" aria-live="assertive">
            {error()}
          </div>
        </Show>

        <Show when={loading()}>
          <div class="text-center py-16" role="status" aria-label="Chargement des campagnes">
            <div class="w-16 h-16 mx-auto mb-4 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" aria-hidden="true" />
            <p class="text-slate-300">Chargement des campagnes...</p>
          </div>
        </Show>

        <Show
          when={!loading() && campaigns().length > 0}
          fallback={
            <Show when={!loading()}>
              <div class="text-center py-16">
                <div class="w-20 h-20 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
                  <BookOpen class="w-10 h-10 text-slate-500" aria-hidden="true" />
                </div>
                <h3 class="text-xl font-semibold text-white mb-2">
                  Pas encore de campagne
                </h3>
                <p class="text-slate-400 mb-6 max-w-sm mx-auto">
                  Créez-en une ou rejoignez-en une avec un code d'invitation ci-dessus.
                </p>
                <button
                  onClick={() => navigate("/campaigns/create")}
                  class="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl transition-all inline-flex items-center gap-2 shadow-lg shadow-purple-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                >
                  <Plus class="w-5 h-5" aria-hidden="true" />
                  Créer une campagne
                </button>
              </div>
            </Show>
          }
        >
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <For each={campaigns()}>
              {(campaign) => (
                <CampaignCard
                  campaign={campaign}
                  onClick={() => navigate(`/campaigns/${campaign.id}`)}
                />
              )}
            </For>
            {/* "Nouvelle Campagne" ghost card — lives in the grid, not isolated below */}
            <NewCampaignCard onClick={() => navigate("/campaigns/create")} />
          </div>
        </Show>

        {/* When no campaigns exist, still show the ghost card below the empty state */}
        <Show when={!loading() && campaigns().length === 0}>
          <div class="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <NewCampaignCard onClick={() => navigate("/campaigns/create")} />
          </div>
        </Show>
      </main>

      <style jsx>{`
        .campaigns-page {
          background: linear-gradient(
            135deg,
            var(--ink-700) 0%,
            var(--ink-800) 50%,
            var(--ink-900) 100%
          );
        }

        @media (prefers-reduced-motion: no-preference) {
          .campaign-card {
            animation: cardFadeIn 0.4s ease-out;
          }

          @keyframes cardFadeIn {
            from {
              opacity: 0;
              transform: translateY(12px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .campaign-card:nth-child(1) { animation-delay: 0ms; }
          .campaign-card:nth-child(2) { animation-delay: 80ms; }
          .campaign-card:nth-child(3) { animation-delay: 160ms; }
          .campaign-card:nth-child(4) { animation-delay: 240ms; }
          .campaign-card:nth-child(5) { animation-delay: 320ms; }
          .campaign-card:nth-child(6) { animation-delay: 400ms; }
        }
      `}</style>
    </div>
  );
}

/**
 * Campaign card — minimalist, shows only backend-persisted fields.
 */
function CampaignCard(props: { campaign: Campaign; onClick: () => void }) {
  const campaign = () => props.campaign;

  return (
    <button
      onClick={props.onClick}
      aria-label={`Ouvrir la campagne : ${campaign().title}`}
      class="campaign-card group relative bg-ink-700 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-xl motion-safe:hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-purple-500/10 hover:border-purple-500/40 transition-all text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
    >
      <div class="h-28 bg-gradient-to-br from-purple-800/50 via-indigo-800/40 to-violet-800/50 relative">
        <div class="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.08%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-50" aria-hidden="true" />
        <div class="absolute top-3 right-3">
          <span
            class={`px-2.5 py-1 text-xs font-medium rounded-lg border backdrop-blur-sm ${getStatusColor(campaign().status)}`}
            aria-label={`Statut : ${getStatusLabel(campaign().status)}`}
          >
            {getStatusLabel(campaign().status)}
          </span>
        </div>
        <div class="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-ink-700 to-transparent" aria-hidden="true" />
      </div>

      <div class="p-5 pt-2">
        <h3 class="font-display text-lg text-white group-hover:text-purple-300 transition-colors mb-2 line-clamp-1">
          {campaign().title}
        </h3>

        <Show when={campaign().description}>
          <p class="text-sm text-slate-400 line-clamp-2 mb-3 min-h-[2.5rem]">
            {campaign().description}
          </p>
        </Show>

        <div class="flex items-center gap-3 text-sm text-slate-300 mb-3">
          <div class="flex items-center gap-1.5">
            <Users class="w-4 h-4 text-slate-400" aria-hidden="true" />
            <span aria-label={`${campaign().currentPlayers} joueurs sur ${campaign().maxPlayers}`}>
              {campaign().currentPlayers}/{campaign().maxPlayers}
            </span>
          </div>
        </div>

        <div class="pt-3 border-t border-white/10 flex items-center gap-2">
          <Crown class="w-4 h-4 text-amber-400" aria-hidden="true" />
          <span class="text-sm text-slate-500 sr-only">Maître du jeu</span>
          <span class="text-sm text-slate-500" aria-hidden="true">MJ</span>
          <span class="text-sm text-white font-medium">
            {displayDungeonMasterName(campaign(), authStore.user()?.username)}
          </span>
        </div>
      </div>

      <div class="absolute inset-0 bg-gradient-to-t from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" aria-hidden="true" />
    </button>
  );
}

/**
 * Ghost card to create a new campaign — lives inside the grid so it respects
 * the same column rhythm as the campaign cards.
 */
function NewCampaignCard(props: { onClick: () => void }) {
  return (
    <button
      onClick={props.onClick}
      aria-label="Créer une nouvelle campagne"
      class="group flex flex-col items-center justify-center gap-4 px-6 py-8 bg-game-dark/80 backdrop-blur-xl border-2 border-dashed border-purple-500/30 rounded-2xl hover:bg-purple-500/10 hover:border-purple-500/60 motion-safe:hover:-translate-y-0.5 transition-all min-h-[180px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
    >
      <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600/30 to-indigo-600/30 border border-purple-500/30 flex items-center justify-center group-hover:from-purple-600/50 group-hover:to-indigo-600/50 transition-all">
        <Plus class="w-6 h-6 text-purple-300" aria-hidden="true" />
      </div>
      <div class="text-center">
        <p class="font-semibold text-white group-hover:text-purple-200 transition-colors">
          Nouvelle Campagne
        </p>
        <p class="text-sm text-slate-400 mt-0.5">
          Créez et gérez votre propre aventure
        </p>
      </div>
    </button>
  );
}
