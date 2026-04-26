import { Component } from "solid-js";
import { ScrollText, Map } from "lucide-solid";
import MenuCard from "../common/MenuCard";
import { t } from "../../i18n";

export const CreateGroup: Component = () => {
  return (
    <section aria-labelledby="home-create-heading">
      <h2 id="home-create-heading" class="font-display text-ds-h2 text-high tracking-wide mb-4 text-center">
        {t("home.section.create")}
      </h2>
      <div class="mb-4 mx-auto h-px w-24 bg-gradient-to-r from-transparent via-gold-400/60 to-transparent" />
      <div class="grid gap-3 sm:gap-4" style={{ "grid-template-columns": "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <MenuCard
          href="/campaigns/create"
          title={t("home.card.createCampaign")}
          icon={<ScrollText size={28} aria-hidden="true" />}
          tone="ghost"
        />
        <MenuCard
          href="/map-editor"
          title={t("home.card.mapEditor")}
          icon={<Map size={28} aria-hidden="true" />}
          tone="ghost"
        />
      </div>
    </section>
  );
};

export default CreateGroup;
