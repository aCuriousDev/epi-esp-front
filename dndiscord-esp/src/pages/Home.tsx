import { Component, Show, createResource, createMemo } from "solid-js";
import AnimatedD20 from "../components/common/AnimatedD20";
import ResumeHero from "../components/home/ResumeHero";
import WelcomeBanner from "../components/home/WelcomeBanner";
import PlayGroup from "../components/home/PlayGroup";
import CreateGroup from "../components/home/CreateGroup";
import StatsStrip from "../components/home/StatsStrip";
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

  const totalItems = createMemo(
    () => (campaignsCount() ?? 0) + (charactersCount() ?? 0)
  );

  const counterLabel = createMemo(() => {
    const n = totalItems();
    return n > 0 ? `${n} ITEMS` : undefined;
  });

  const hasData = createMemo(() => totalItems() > 0);

  return (
    <div class="max-w-[1080px] mx-auto space-y-5">
      {/* Hero block */}
      <header class="flex flex-col items-center text-center gap-2 pt-2 mb-4">
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
          <span class="dnd-d20-float relative">
            <AnimatedD20 size={96} />
          </span>
        </div>
        <h1 class="title-shine font-display font-bold text-[36px] tracking-[0.06em] mb-1">
          DnDiscord
        </h1>
        <p class="font-old italic text-[15px] text-mid max-w-[520px] mx-auto leading-snug">
          {t("home.subtitle")}
        </p>
      </header>

      <Show when={lastId()} fallback={<WelcomeBanner />}>
        <ResumeHero />
      </Show>

      <PlayGroup
        charactersCount={charactersCount()}
        campaignsCount={campaignsCount()}
        counter={counterLabel()}
      />

      <CreateGroup />

      <Show when={hasData()}>
        <div class="mt-2">
          <StatsStrip
            characters={charactersCount() ?? 0}
            campaigns={campaignsCount() ?? 0}
          />
        </div>
      </Show>
    </div>
  );
};

export default Home;
