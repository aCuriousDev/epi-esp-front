import { Component, Show, createResource } from "solid-js";
import AnimatedD20 from "../components/common/AnimatedD20";
import ResumeHero from "../components/home/ResumeHero";
import WelcomeBanner from "../components/home/WelcomeBanner";
import PlayGroup from "../components/home/PlayGroup";
import CreateGroup from "../components/home/CreateGroup";
import { CampaignService } from "../services/campaign.service";
import { CharacterService } from "../services/character.service";
import { useLastCampaignId } from "../hooks/useLastCampaign";
import { t } from "../i18n";

export const Home: Component = () => {
  const lastId = useLastCampaignId();

  const [campaignsCount] = createResource(async () => {
    try {
      const res = await CampaignService.listCampaigns();
      return res.totalCount ?? 0;
    } catch {
      return 0;
    }
  });

  const [charactersCount] = createResource(async () => {
    try {
      const list = await CharacterService.getMyCharacters();
      return Array.isArray(list) ? list.length : 0;
    } catch {
      return 0;
    }
  });

  return (
    <div class="space-y-8">
      <header class="flex flex-col items-center text-center gap-3 pt-2">
        <div class="relative inline-flex items-center justify-center">
          <div
            class="absolute inset-0 rounded-full pointer-events-none"
            aria-hidden="true"
            style={{
              background:
                "radial-gradient(circle, rgba(244,197,66,0.25) 0%, rgba(75,30,78,0.15) 45%, transparent 70%)",
              filter: "blur(20px)",
              transform: "scale(1.5)",
            }}
          />
          <AnimatedD20 size={140} />
        </div>
        <h1 class="font-display text-ds-h1 text-high tracking-wide">DnDiscord</h1>
        <p class="text-mid text-ds-body max-w-xl">{t("home.subtitle")}</p>
      </header>

      <Show when={lastId()} fallback={<WelcomeBanner />}>
        <ResumeHero />
      </Show>
      <PlayGroup charactersCount={charactersCount()} campaignsCount={campaignsCount()} />
      <CreateGroup />
    </div>
  );
};

export default Home;
