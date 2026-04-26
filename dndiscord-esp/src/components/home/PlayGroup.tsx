import { Component } from "solid-js";
import { Swords, Users, Sparkles } from "lucide-solid";
import MenuCard from "../common/MenuCard";
import SectionHeader from "../common/SectionHeader";
import { t } from "../../i18n";

interface PlayGroupProps {
  charactersCount?: number;
  campaignsCount?: number;
  counter?: string;
}

// Avoid showing a "0" pill when there are no items (MenuCard renders any defined badge).
const badge = (n?: number) => (n && n > 0 ? n : undefined);

export const PlayGroup: Component<PlayGroupProps> = (props) => {
  return (
    <section aria-labelledby="home-play-heading">
      <SectionHeader
        id="home-play-heading"
        eyebrow={t("home.section.play")}
        counter={props.counter}
      />
      <div class="grid gap-3 sm:gap-4" style={{ "grid-template-columns": "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <MenuCard
          href="/campaigns"
          title={t("home.card.campaigns")}
          subtitle={t("home.card.campaigns.subtitle")}
          icon={<Users size={28} aria-hidden="true" />}
          badge={badge(props.campaignsCount)}
          data-tutorial="nav-campaigns"
        />
        <MenuCard
          href="/characters"
          title={t("home.card.characters")}
          subtitle={t("home.card.characters.subtitle")}
          icon={<Swords size={28} aria-hidden="true" />}
          badge={badge(props.charactersCount)}
          data-tutorial="nav-characters"
        />
        <MenuCard
          href="/practice"
          title={t("home.card.practice")}
          subtitle={t("home.card.practice.subtitle")}
          icon={<Sparkles size={28} aria-hidden="true" />}
        />
      </div>
    </section>
  );
};

export default PlayGroup;
