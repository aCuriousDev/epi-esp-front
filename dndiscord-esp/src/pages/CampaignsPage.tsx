import { useNavigate } from "@solidjs/router";
import { Plus, BookOpen, LogIn } from "lucide-solid";
import { createSignal, For, Show, onMount } from "solid-js";
import {
  Campaign,
  CampaignStatus,
  CampaignVisibility,
} from "../types/campaign";
import {
  CampaignService,
  CampaignResponse,
} from "../services/campaign.service";
import CampaignCard from "../components/CampaignCard";
import PageMeta from "../layouts/PageMeta";
import Button from "../components/common/Button";
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
        <p class="text-mid text-ds-body text-center max-w-xl mx-auto">
          {t("page.campaigns.subtitle")}
        </p>

        {/* Join-by-code panel — the only way a non-creator enters a campaign */}
        <div class="mx-auto max-w-xl bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
          <label
            id="invite-code-label"
            for="invite-code-input"
            class="block text-sm text-slate-300 mb-1 font-medium"
          >
            {t("page.campaigns.joinTitle")}
          </label>
          <p id="invite-code-hint" class="text-xs text-slate-500 mb-3">
            {t("page.campaigns.joinHelp")}
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
              aria-label={t("page.campaigns.joinTitle")}
              autocomplete="off"
              class="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white font-mono tracking-wider placeholder:text-slate-500 focus:border-purple-400/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900 disabled:opacity-50 transition-colors"
            />
            <button
              onClick={handleJoin}
              disabled={joining() || !inviteCode().trim()}
              class="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            >
              <LogIn class="w-4 h-4" aria-hidden="true" />
              {joining() ? "…" : t("page.campaigns.joinCta")}
            </button>
          </div>
          <Show when={joinError()}>
            <p class="mt-2 text-red-400 text-sm" role="alert" aria-live="polite">
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
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <For each={campaigns()}>
              {(campaign) => (
                <CampaignCard
                  campaign={campaign}
                  onClick={() => navigate(`/campaigns/${campaign.id}`)}
                />
              )}
            </For>
          </div>
        </Show>
      </div>
    </>
  );
}
