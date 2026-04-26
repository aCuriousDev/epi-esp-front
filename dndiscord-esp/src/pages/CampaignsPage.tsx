import { useNavigate } from "@solidjs/router";
import { Plus, BookOpen, Play } from "lucide-solid";
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
        <p class="font-old italic text-mid text-ds-body text-center max-w-2xl mx-auto">
          {t("page.campaigns.subtitle")}
        </p>

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
      </div>
    </>
  );
}
