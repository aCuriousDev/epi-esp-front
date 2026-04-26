import { Component } from "solid-js";
import { ScrollText, Map } from "lucide-solid";
import MenuCard from "../common/MenuCard";
import SectionHeader from "../common/SectionHeader";
import { t } from "../../i18n";

export const CreateGroup: Component = () => {
  return (
    <section aria-labelledby="home-create-heading">
      <SectionHeader
        id="home-create-heading"
        eyebrow={t("home.section.create")}
      />
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
