import { useNavigate } from "@solidjs/router";
import {
  Plus,
  BookOpen,
  Play,
  Search,
  X,
  UserPlus,
  Users,
  Crown,
  ArrowLeft,
} from "lucide-solid";
import { createSignal, For, Show, onMount, createEffect } from "solid-js";
import {
  Campaign,
  CampaignStatus,
  CampaignVisibility,
} from "../types/campaign";
import {
  CampaignService,
  CampaignResponse,
  displayDungeonMasterName,
  CampaignListResponse,
} from "../services/campaign.service";
import SectionHeader from "../components/common/SectionHeader";
import { t } from "../i18n";
import { authStore } from "../stores/auth.store";
import { getStatusColor, getStatusLabel } from "../types/campaign";

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
 * Map backend list-response to the front Campaign type.
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

  // Search-campaigns modal state
  const [searchModalOpen, setSearchModalOpen] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [searchResults, setSearchResults] = createSignal<CampaignResponse[]>([]);
  const [searchLoading, setSearchLoading] = createSignal(false);
  const [searchError, setSearchError] = createSignal<string | null>(null);
  const [joiningId, setJoiningId] = createSignal<string | null>(null);
  const [joinPublicError, setJoinPublicError] = createSignal<string | null>(null);

  let searchDebounce: ReturnType<typeof setTimeout>;

  const openSearchModal = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSearchError(null);
    setJoinPublicError(null);
    setSearchModalOpen(true);
  };

  const closeSearchModal = () => setSearchModalOpen(false);

  const runSearch = async (query: string) => {
    setSearchLoading(true);
    setSearchError(null);
    try {
      const res = await CampaignService.listCampaigns({
        page: 1,
        pageSize: 20,
        search: query || undefined,
        isPublic: true,
        roleFilter: "All",
      });
      setSearchResults(res.items);
    } catch {
      setSearchError("Impossible de charger les campagnes. Veuillez réessayer.");
    } finally {
      setSearchLoading(false);
    }
  };

  createEffect(() => {
    if (!searchModalOpen()) return;
    clearTimeout(searchDebounce);
    const q = searchQuery();
    searchDebounce = setTimeout(() => runSearch(q), 300);
  });

  const handleJoinPublic = async (campaignId: string) => {
    setJoiningId(campaignId);
    setJoinPublicError(null);
    try {
      await CampaignService.joinPublicCampaign(campaignId);
      // Refresh my campaigns list and close modal
      const response = await CampaignService.listCampaigns({ page: 1, pageSize: 100, roleFilter: "AsMember" });
      setCampaigns(response.items.map(mapCampaignResponse));
      closeSearchModal();
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ??
        err?.response?.data?.title ??
        "Impossible de rejoindre cette campagne.";
      setJoinPublicError(msg);
    } finally {
      setJoiningId(null);
    }
  };

  onMount(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await CampaignService.listCampaigns({
        page: 1,
        pageSize: 100,
        roleFilter: "AsMember",
      });
      setCampaigns(response.items.map(mapCampaignResponse));
    } catch (err) {
      console.error("Failed to load campaigns:", err);
      setError(t("page.campaigns.loadError"));
    } finally {
      setLoading(false);
    }
  });

  const handleJoin = async () => {
    const code = inviteCode().trim();
    if (!code) {
      setJoinError(t("page.campaigns.joinCodeRequired"));
      return;
    }
    setJoining(true);
    setJoinError(null);
    try {
      const joined = await CampaignService.joinCampaign({ inviteCode: code });
      navigate(`/campaigns/${joined.id}`);
    } catch (err: any) {
      console.error("Failed to join campaign:", err);
      const msg = err?.response?.data?.detail
        ?? err?.response?.data?.title
        ?? err?.response?.data?.error
        ?? t("page.campaigns.joinError");
      setJoinError(msg);
    } finally {
      setJoining(false);
    }
  };

  return (
    <div>
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

        <div class="flex items-center gap-2">
          <button
            onClick={openSearchModal}
            class="flex items-center gap-2 text-slate-300 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 rounded-lg px-2 py-1"
          >
            <Search class="w-3.5 h-3.5" aria-hidden="true" />
            <span class="hidden sm:inline">Rechercher une campagne publique</span>
          </button>
        </div>
      </header>

      <main class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div class="text-center mb-8">
          <h2 class="font-display text-4xl sm:text-5xl tracking-wide text-white drop-shadow-[0_2px_8px_rgba(139,92,246,0.5)]">
            Mes Campagnes
          </h2>
          <p class="mt-3 text-slate-300 max-w-xl mx-auto">
            Gérez vos aventures ou rejoignez une campagne existante via un code d'invitation.
          </p>
        </div>

        <Show when={error()}>
          <div
            class="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-center"
            role="alert"
            aria-live="assertive"
          >
            {error()}
          </div>
        </Show>

        <Show when={loading()}>
          <div class="text-center py-16" role="status" aria-label={t("common.loading")}>
            <div
              class="w-16 h-16 mx-auto mb-4 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"
              aria-hidden="true"
            />
            <p class="text-slate-300">{t("common.loading")}</p>
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
                  {t("page.campaigns.empty")}
                </h3>
                <p class="text-slate-400 mb-6 max-w-sm mx-auto">
                  {t("page.campaigns.emptyHint")}
                </p>
                <button
                  onClick={() => navigate("/campaigns/create")}
                  class="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl transition-all inline-flex items-center gap-2 shadow-lg shadow-purple-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                >
                  <Plus class="w-5 h-5" aria-hidden="true" />
                  {t("page.campaigns.createCta")}
                </button>
              </div>
            </Show>
          }
        >
          <div data-tutorial="campaigns-panel">
            <SectionHeader
              eyebrow={t("page.campaigns.yourCampaignsEyebrow")}
              counter={`${campaigns().length} ${t("page.campaigns.totalCounter")}`.toUpperCase()}
            />
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <For each={campaigns()}>
                {(campaign, i) => (
                  <CampaignCard
                    campaign={campaign}
                    onClick={() => navigate(`/campaigns/${campaign.id}`)}
                    index={i()}
                  />
                )}
              </For>
            </div>
          </div>
        </Show>

        {/* When no campaigns exist, still show the ghost card below the empty state */}
        <Show when={!loading() && campaigns().length === 0}>
          <div class="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <NewCampaignCard onClick={() => navigate("/campaigns/create")} />
          </div>
        </Show>
      </main>

      {/* ── Search campaigns modal ─────────────────────────────────────── */}
      <Show when={searchModalOpen()}>
        <div
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Rechercher une campagne"
        >
          {/* Backdrop */}
          <div
            class="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={closeSearchModal}
            aria-hidden="true"
          />

          {/* Panel */}
          <div class="relative w-full max-w-2xl bg-ink-800 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            {/* Header */}
            <div class="flex items-center gap-3 px-6 py-4 border-b border-white/10">
              <Search class="w-5 h-5 text-purple-400 shrink-0" aria-hidden="true" />
              <h2 class="font-display text-lg text-white flex-1">Rechercher une campagne</h2>
              <button
                onClick={closeSearchModal}
                aria-label="Fermer"
                class="text-slate-400 hover:text-white transition-colors rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60"
              >
                <X class="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Search input */}
            <div class="px-6 py-4 border-b border-white/10">
              <input
                type="search"
                placeholder="Nom de la campagne…"
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                autofocus
                class="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:border-purple-400/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900 transition-colors"
              />
            </div>

            {/* Results */}
            <div class="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              <Show when={searchLoading()}>
                <div class="flex items-center justify-center py-10" role="status" aria-label="Chargement">
                  <div class="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" aria-hidden="true" />
                </div>
              </Show>

              <Show when={searchError()}>
                <p class="text-center text-red-400 py-6 text-sm" role="alert">{searchError()}</p>
              </Show>

              <Show when={!searchLoading() && !searchError() && searchResults().length === 0}>
                <p class="text-center text-slate-500 py-10 text-sm">
                  {searchQuery() ? "Aucune campagne publique trouvée." : "Tapez un nom pour commencer la recherche."}
                </p>
              </Show>

              <For each={searchResults()}>
                {(c) => {
                  const alreadyJoined = () => campaigns().some((my) => my.id === c.id);
                  return (
                    <div class="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/8 hover:border-purple-500/30 transition-colors">
                      {/* Info */}
                      <div class="flex-1 min-w-0">
                        <p class="font-semibold text-white truncate">{c.name}</p>
                        <Show when={c.description}>
                          <p class="text-sm text-slate-400 line-clamp-1 mt-0.5">{c.description}</p>
                        </Show>
                        <div class="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                          <span class="flex items-center gap-1">
                            <Users class="w-3.5 h-3.5" aria-hidden="true" />
                            {c.memberCount}/{c.maxPlayers}
                          </span>
                          <span class="flex items-center gap-1">
                            <Crown class="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                            MJ
                          </span>
                        </div>
                      </div>

                      {/* Join button */}
                      <Show
                        when={!alreadyJoined()}
                        fallback={
                          <span class="text-xs text-emerald-400 font-medium px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 shrink-0">
                            Déjà membre
                          </span>
                        }
                      >
                        <button
                          onClick={() => handleJoinPublic(c.id)}
                          disabled={joiningId() === c.id}
                          aria-label={`Rejoindre la campagne ${c.name}`}
                          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-medium transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60"
                        >
                          <Show
                            when={joiningId() !== c.id}
                            fallback={<div class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />}
                          >
                            <UserPlus class="w-3.5 h-3.5" aria-hidden="true" />
                          </Show>
                          Rejoindre
                        </button>
                      </Show>
                    </div>
                  );
                }}
              </For>

              <Show when={joinPublicError()}>
                <p class="text-red-400 text-sm text-center py-2" role="alert" aria-live="polite">{joinPublicError()}</p>
              </Show>
            </div>

            {/* Footer hint */}
            <div class="px-6 py-3 border-t border-white/10 text-center">
              <p class="text-xs text-slate-500">Seules les campagnes publiques apparaissent ici. Pour une campagne privée, utilisez un code d'invitation.</p>
            </div>
          </div>
        </div>
      </Show>

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
