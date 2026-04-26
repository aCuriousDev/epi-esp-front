import { Component, createResource } from "solid-js";
import AnimatedD20 from "../components/common/AnimatedD20";
import ResumeHero from "../components/home/ResumeHero";
import PlayGroup from "../components/home/PlayGroup";
import CreateGroup from "../components/home/CreateGroup";
import { CampaignService } from "../services/campaign.service";
import { CharacterService } from "../services/character.service";
import { t } from "../i18n";

export const Home: Component = () => {
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
        <AnimatedD20 size={72} />
        <h1 class="font-display text-ds-h1 text-high tracking-wide">DnDiscord</h1>
        <p class="text-mid text-ds-body max-w-xl">{t("home.subtitle")}</p>
      </header>

      <ResumeHero />
      <PlayGroup charactersCount={charactersCount()} campaignsCount={campaignsCount()} />
      <CreateGroup />
    </div>
  );
};

export default Home;
