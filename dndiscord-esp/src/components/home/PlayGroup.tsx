import { Component, Show } from "solid-js";
import { Swords, Users, Sparkles } from "lucide-solid";
import MenuCard from "../common/MenuCard";
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
      <header class="flex items-center gap-3 mb-4">
        <h2 id="home-play-heading" class="font-display text-ds-micro tracking-[0.2em] uppercase text-gold-300">
          {t("home.section.play")}
        </h2>
        <div class="flex-1 h-px bg-gradient-to-r from-gold-400/30 via-gold-400/15 to-transparent" />
        <Show when={props.counter}>
          <span
            class="font-mono text-[11px] text-low tracking-[0.1em] shrink-0"
          >
            {props.counter}
          </span>
        </Show>
      </header>
      <div class="grid gap-3 sm:gap-4" style={{ "grid-template-columns": "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <MenuCard
          href="/campaigns"
          title={t("home.card.campaigns")}
          subtitle={t("home.card.campaigns.subtitle")}
          icon={<Users size={28} aria-hidden="true" />}
          badge={badge(props.campaignsCount)}
        />
        <MenuCard
          href="/characters"
          title={t("home.card.characters")}
          subtitle={t("home.card.characters.subtitle")}
          icon={<Swords size={28} aria-hidden="true" />}
          badge={badge(props.charactersCount)}
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
