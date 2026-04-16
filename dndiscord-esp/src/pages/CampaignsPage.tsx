import { A, useNavigate } from "@solidjs/router";
import {
  ArrowLeft,
  Plus,
  Users,
  Calendar,
  Crown,
  BookOpen,
} from "lucide-solid";
import { createSignal, For, Show, onMount, createResource } from "solid-js";
import {
  Campaign,
  CampaignStatus,
  getStatusColor,
  getStatusLabel,
  CampaignVisibility,
} from "../types/campaign";
import { authStore } from "../stores/auth.store";
import { AuthService } from "../services/auth.service";
import {
  CampaignService,
  CampaignResponse,
  CampaignStatus as APICampaignStatus,
} from "../services/campaign.service";

/**
 * Map backend campaign status to frontend status
 */
function mapCampaignStatus(status: number | string): CampaignStatus {
  // Backend sends integers (or as strings in JSON)
  const statusNum = typeof status === "number" ? status : parseInt(status);

  switch (statusNum) {
    case 0: // Draft
      return CampaignStatus.Planning;
    case 1: // Active
      return CampaignStatus.Active;
    case 2: // Paused (was OnHold)
      return CampaignStatus.Paused;
    case 3: // Completed
      return CampaignStatus.Completed;
    case 4: // Archived
      return CampaignStatus.Archived;
    default:
      return CampaignStatus.Planning;
  }
}

/**
 * Map backend campaign response to frontend campaign type
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
    dungeonMasterName: "Maître du Jeu", // TODO: Get from user data
    maxPlayers: response.maxPlayers,
    currentPlayers: response.memberCount,
    totalSessions: 0, // TODO: Add to backend
    startingLevel: 1, // TODO: Add to backend
    tags: [], // TODO: Add to backend
    createdAt: response.createdAt,
    updatedAt: response.updatedAt,
    nextSessionDate: response.lastPlayedAt,
  };
}

export default function CampaignsPage() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = createSignal<Campaign[]>([]);
  const [filter, setFilter] = createSignal<"all" | "dm" | "player">("all");
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  // Load campaigns on mount
  onMount(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await CampaignService.listCampaigns({
        page: 1,
        pageSize: 100,
      });
      const mappedCampaigns = response.items.map(mapCampaignResponse);
      setCampaigns(mappedCampaigns);
    } catch (err) {
      console.error("Failed to load campaigns:", err);
      setError("Impossible de charger les campagnes. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  });

  const user = () => authStore.user();
  const avatarUrl = () => {
    const u = user();
    return u ? AuthService.getAvatarUrl(u) : "";
  };

  const filteredCampaigns = () => {
    const f = filter();
    if (f === "all") return campaigns();
    // In real app, filter by user's role in campaign
    return campaigns();
  };

  return (
    <div class="campaigns-page min-h-screen w-full bg-brand-gradient">
      {/* Background effects */}
      <div class="absolute inset-0 overflow-hidden pointer-events-none">
        <div class="absolute top-1/4 -left-32 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        <div
          class="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse"
          style="animation-delay: 1s"
        />
        <div class="absolute top-3/4 left-1/3 w-64 h-64 bg-violet-500/8 rounded-full blur-3xl" />
      </div>

      {/* Vignette */}
      <div class="vignette absolute inset-0" />

      {/* Header */}
      <header class="relative z-20 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-game-dark/70 backdrop-blur-md">
        <button
          onClick={() => navigate("/")}
          class="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
        >
          <ArrowLeft class="w-5 h-5" />
          <span class="hidden sm:inline">Retour au menu</span>
        </button>

        <h1 class="font-display text-xl text-white tracking-wide">Campagnes</h1>

        <button
          onClick={() => navigate("/campaigns/create")}
          class="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl transition-all shadow-lg shadow-purple-500/20"
        >
          <Plus class="w-4 h-4" />
          <span class="hidden sm:inline">Créer</span>
        </button>
      </header>

      {/* Main content */}
      <main class="relative z-10 max-w-6xl mx-auto p-6">
        {/* Title Section */}
        <div class="text-center mb-8">
          <h2 class="font-display text-4xl sm:text-5xl tracking-wide text-white drop-shadow-[0_2px_8px_rgba(139,92,246,0.5)]">
            Mes Campagnes
          </h2>
          <p class="mt-3 text-slate-300 max-w-xl mx-auto">
            Gérez vos aventures, rejoignez de nouvelles quêtes et créez des
            mondes épiques.
          </p>
          <div class="mt-6 mx-auto decorative-divider" />
        </div>

        {/* Filter tabs */}
        <div class="flex justify-center gap-2 mb-8">
          <FilterTab
            active={filter() === "all"}
            onClick={() => setFilter("all")}
            label="Toutes"
            count={campaigns().length}
          />
          <FilterTab
            active={filter() === "dm"}
            onClick={() => setFilter("dm")}
            label="Maître du Jeu"
            icon={<Crown class="w-4 h-4" />}
          />
          <FilterTab
            active={filter() === "player"}
            onClick={() => setFilter("player")}
            label="Joueur"
            icon={<Users class="w-4 h-4" />}
          />
        </div>

        {/* Error message */}
        <Show when={error()}>
          <div class="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-center">
            {error()}
          </div>
        </Show>

        {/* Loading state */}
        <Show when={loading()}>
          <div class="text-center py-16">
            <div class="w-16 h-16 mx-auto mb-4 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
            <p class="text-slate-300">Chargement des campagnes...</p>
          </div>
        </Show>

        {/* Campaigns Grid */}
        <Show
          when={!loading() && filteredCampaigns().length > 0}
          fallback={
            <Show when={!loading()}>
              <div class="text-center py-16">
                <div class="w-20 h-20 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
                  <BookOpen class="w-10 h-10 text-slate-500" />
                </div>
                <h3 class="text-xl font-semibold text-white mb-2">
                  Aucune campagne
                </h3>
                <p class="text-slate-400 mb-6">
                  Créez votre première campagne ou rejoignez-en une existante.
                </p>
                <button
                  onClick={() => navigate("/campaigns/create")}
                  class="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-colors inline-flex items-center gap-2"
                >
                  <Plus class="w-5 h-5" />
                  Créer une campagne
                </button>
              </div>
            </Show>
          }
        >
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <For each={filteredCampaigns()}>
              {(campaign) => (
                <CampaignCard
                  campaign={campaign}
                  onClick={() => navigate(`/campaigns/${campaign.id}`)}
                />
              )}
            </For>
          </div>
        </Show>

        {/* Quick action to create */}
        <div class="mt-8 flex justify-center">
          <button
            onClick={() => navigate("/campaigns/create")}
            class="group flex items-center gap-4 px-6 py-4 bg-game-dark/80 backdrop-blur-xl border-2 border-dashed border-purple-500/30 rounded-2xl hover:bg-purple-500/10 hover:border-purple-500/60 transition-all"
          >
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600/30 to-indigo-600/30 border border-purple-500/30 flex items-center justify-center group-hover:from-purple-600/50 group-hover:to-indigo-600/50 transition-all">
              <Plus class="w-6 h-6 text-purple-300" />
            </div>
            <div class="text-left">
              <p class="font-semibold text-white group-hover:text-purple-200 transition-colors">
                Nouvelle Campagne
              </p>
              <p class="text-sm text-slate-400">
                Créez et gérez votre propre aventure
              </p>
            </div>
          </button>
        </div>
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

        .campaign-card:nth-child(1) {
          animation-delay: 0ms;
        }
        .campaign-card:nth-child(2) {
          animation-delay: 80ms;
        }
        .campaign-card:nth-child(3) {
          animation-delay: 160ms;
        }
        .campaign-card:nth-child(4) {
          animation-delay: 240ms;
        }
        .campaign-card:nth-child(5) {
          animation-delay: 320ms;
        }
        .campaign-card:nth-child(6) {
          animation-delay: 400ms;
        }
      `}</style>
    </div>
  );
}

/**
 * Filter tab component
 */
function FilterTab(props: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: any;
  count?: number;
}) {
  return (
    <button
      onClick={props.onClick}
      class={`flex items-center gap-2 px-5 py-2.5 rounded-xl border font-medium transition-all ${
        props.active
          ? "bg-gradient-to-r from-purple-600/40 to-indigo-600/40 border-purple-500/50 text-white shadow-lg shadow-purple-500/10"
          : "bg-game-dark/60 border-white/10 text-slate-400 hover:text-white hover:bg-white/10 hover:border-white/20"
      }`}
    >
      {props.icon}
      <span>{props.label}</span>
      <Show when={props.count !== undefined}>
        <span
          class={`text-xs px-2 py-0.5 rounded-full font-semibold ${
            props.active
              ? "bg-purple-500/60 text-white"
              : "bg-white/10 text-slate-300"
          }`}
        >
          {props.count}
        </span>
      </Show>
    </button>
  );
}

/**
 * Campaign card component
 */
function CampaignCard(props: { campaign: Campaign; onClick: () => void }) {
  const campaign = () => props.campaign;

  const formatNextSession = () => {
    if (!campaign().nextSessionDate) return null;
    const date = new Date(campaign().nextSessionDate!);
    return date.toLocaleDateString("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <button
      onClick={props.onClick}
      class="campaign-card group relative bg-ink-700 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl hover:shadow-purple-500/10 hover:border-purple-500/40 transition-all text-left w-full"
    >
      {/* Cover gradient */}
      <div class="h-28 bg-gradient-to-br from-purple-800/50 via-indigo-800/40 to-violet-800/50 relative">
        <div class="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.08%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-50" />

        {/* Status badge */}
        <div class="absolute top-3 right-3">
          <span
            class={`px-2.5 py-1 text-xs font-medium rounded-lg border backdrop-blur-sm ${getStatusColor(campaign().status)}`}
          >
            {getStatusLabel(campaign().status)}
          </span>
        </div>

        {/* Gradient overlay at bottom - matches card bg color */}
        <div class="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-ink-700 to-transparent" />
      </div>

      {/* Content */}
      <div class="p-5 pt-2">
        {/* Title */}
        <h3 class="font-display text-lg text-white group-hover:text-purple-300 transition-colors mb-2 line-clamp-1">
          {campaign().title}
        </h3>

        {/* Description */}
        <Show when={campaign().description}>
          <p class="text-sm text-slate-400 line-clamp-2 mb-3 min-h-[2.5rem]">
            {campaign().description}
          </p>
        </Show>

        {/* Stats row */}
        <div class="flex items-center gap-3 text-sm text-slate-300 mb-3">
          <div class="flex items-center gap-1.5">
            <Users class="w-4 h-4 text-slate-400" />
            <span>
              {campaign().currentPlayers}/{campaign().maxPlayers}
            </span>
          </div>
          <div class="flex items-center gap-1.5">
            <BookOpen class="w-4 h-4 text-slate-400" />
            <span>{campaign().totalSessions} sessions</span>
          </div>
          <Show when={campaign().currentLevel}>
            <span class="text-purple-400 font-medium">
              Niv. {campaign().currentLevel}
            </span>
          </Show>
        </div>

        {/* Tags */}
        <Show when={campaign().tags && campaign().tags!.length > 0}>
          <div class="flex flex-wrap gap-1.5 mb-3">
            <For each={campaign().tags!.slice(0, 3)}>
              {(tag) => (
                <span class="px-2 py-0.5 text-xs bg-white/10 text-slate-300 rounded-full border border-white/5">
                  {tag}
                </span>
              )}
            </For>
          </div>
        </Show>

        {/* Next session */}
        <Show when={formatNextSession()}>
          <div class="flex items-center gap-2 p-2.5 bg-green-500/15 border border-green-500/30 rounded-xl text-sm mb-3">
            <Calendar class="w-4 h-4 text-green-400 flex-shrink-0" />
            <span class="text-green-300 text-xs">
              Prochaine session: {formatNextSession()}
            </span>
          </div>
        </Show>

        {/* DM info */}
        <div class="pt-3 border-t border-white/10 flex items-center gap-2">
          <Crown class="w-4 h-4 text-amber-400" />
          <span class="text-sm text-slate-500">MJ:</span>
          <span class="text-sm text-white font-medium">
            {campaign().dungeonMasterName}
          </span>
        </div>
      </div>

      {/* Hover effect overlay */}
      <div class="absolute inset-0 bg-gradient-to-t from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </button>
  );
}
