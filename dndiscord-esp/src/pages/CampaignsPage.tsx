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
} from "lucide-solid";
import { createSignal, For, Show, onMount, createEffect } from "solid-js";
import {
  Campaign,
  CampaignStatus,
  CampaignVisibility,
} from "../types/campaign";
import { CampaignService, CampaignResponse } from "../services/campaign.service";
import CampaignCard from "../components/CampaignCard";
import PageMeta from "../layouts/PageMeta";
import Button from "../components/common/Button";
import SectionHeader from "../components/common/SectionHeader";
import { t } from "../i18n";

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
    <>
      <PageMeta
        title={t("page.campaigns.title")}
        rightSlot={
          <Button href="/campaigns/create" size="sm">
            {t("common.create")}
          </Button>
        }
      />

      <div class="space-y-6">
        <p class="font-old italic text-mid text-ds-body text-center max-w-2xl mx-auto">
          {t("page.campaigns.subtitle")}
        </p>

        <div class="flex flex-wrap items-center justify-center gap-2 mb-6">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={openSearchModal}
            leadingIcon={<Search class="w-3.5 h-3.5" aria-hidden="true" />}
          >
            Rechercher une campagne publique
          </Button>
        </div>

        {/* Join-by-code panel */}
        <div class="max-w-[560px] mx-auto mb-9 p-[22px] rounded-ds-lg surface-1 shadow-soft">
          <div class="flex items-center gap-2 mb-1.5">
            <BookOpen size={16} class="text-gold-300" aria-hidden="true" />
            <span class="font-display text-[14px] tracking-wide text-high">
              {t("page.campaigns.joinTitle")}
            </span>
          </div>
          <p class="text-[12px] text-low leading-relaxed mb-3.5">
            {t("page.campaigns.joinHelp")}
          </p>
          <div class="flex gap-2.5">
            <input
              id="invite-code-input"
              type="text"
              value={inviteCode()}
              onInput={(e) => setInviteCode(e.currentTarget.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleJoin(); }}
              disabled={joining()}
              placeholder={t("page.campaigns.placeholder.code")}
              aria-label={t("page.campaigns.joinTitle")}
              autocomplete="off"
              class="flex-1 px-3.5 py-2.5 bg-ink-600 border border-ink-500 rounded-ds-sm text-high font-mono text-[14px] tracking-[0.15em] text-center placeholder:text-low focus:border-gold-400/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/40 disabled:opacity-50 transition-colors"
            />
            <Button
              onClick={handleJoin}
              disabled={joining() || !inviteCode().trim()}
              size="md"
              leadingIcon={<Play size={12} />}
            >
              {t("page.campaigns.joinCta")}
            </Button>
          </div>
          <Show when={joinError()}>
            <p class="mt-2 text-red-400 text-[12px]" role="alert" aria-live="polite">
              {joinError()}
            </p>
          </Show>
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
      </div>

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
    </>
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
