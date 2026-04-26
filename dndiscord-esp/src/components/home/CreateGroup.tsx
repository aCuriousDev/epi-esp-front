import { Component } from "solid-js";
import { ScrollText, Map } from "lucide-solid";
import MenuCard from "../common/MenuCard";
import { t } from "../../i18n";

export const CreateGroup: Component = () => {
  return (
    <section aria-labelledby="home-create-heading">
      <header class="flex items-center gap-3 mb-4">
        <h2 id="home-create-heading" class="font-display text-ds-micro tracking-[0.2em] uppercase text-gold-300">
          {t("home.section.create")}
        </h2>
        <div class="flex-1 h-px bg-gradient-to-r from-gold-400/30 via-gold-400/15 to-transparent" />
      </header>
      <div class="grid gap-3 sm:gap-4" style={{ "grid-template-columns": "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <MenuCard
          href="/campaigns/create"
          title={t("home.card.createCampaign")}
          subtitle={t("home.card.createCampaign.subtitle")}
          icon={<ScrollText size={28} aria-hidden="true" />}
          tone="ghost"
        />
        <MenuCard
          href="/map-editor"
          title={t("home.card.mapEditor")}
          subtitle={t("home.card.mapEditor.subtitle")}
          icon={<Map size={28} aria-hidden="true" />}
          tone="ghost"
        />
      </div>
    </section>
  );
};

export default CreateGroup;
