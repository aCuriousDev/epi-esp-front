import { Component, Show, createResource } from "solid-js";
import { Play } from "lucide-solid";
import { useLastCampaignId } from "../../hooks/useLastCampaign";
import Button from "../common/Button";
import { CampaignService } from "../../services/campaign.service";
import { t } from "../../i18n";

export const ResumeHero: Component = () => {
  const lastId = useLastCampaignId();

  const [campaign] = createResource(lastId, async (id) => {
    if (!id) return null;
    try {
      return await CampaignService.getCampaign(id);
    } catch {
      return null;
    }
  });

  const lastPlayedLabel = (iso?: string | null): string => {
    if (!iso) return "";
    const d = new Date(iso);
    const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
    if (days <= 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 30) return `${days} days ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
  };

  return (
    <Show when={campaign()}>
      {(c) => (
        <section
          class="surface-1 rounded-ds-xl p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-4
                 shadow-soft hover:shadow-lift transition-shadow duration-ds-sm"
          aria-label={t("home.hero.resume")}
        >
          <div class="text-gold-300 shrink-0">
            <Play size={36} aria-hidden="true" />
          </div>
          <div class="flex-1 text-center sm:text-left">
            <p class="font-display text-ds-h3 text-high tracking-wide">{c().name}</p>
            <p class="text-ds-small text-mid">
              {t("home.hero.lastPlayed", {
                when: lastPlayedLabel(c().lastPlayedAt ?? c().updatedAt),
              })}
            </p>
          </div>
          <Button href={`/campaigns/${c().id}`} size="md">
            {t("home.hero.resume")}
          </Button>
        </section>
      )}
    </Show>
  );
};

export default ResumeHero;
