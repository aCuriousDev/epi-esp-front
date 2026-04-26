import { Component } from "solid-js";
import { Compass, Swords, Castle, Users } from "lucide-solid";
import MenuCard from "../components/common/MenuCard";
import PageMeta from "../layouts/PageMeta";
import { t } from "../i18n";

export const PracticeModeSelectPage: Component = () => {
  return (
    <>
      <PageMeta title={t("page.practice.title")} />

      <div class="space-y-6">
        <p class="text-mid text-ds-body text-center max-w-2xl mx-auto">
          {t("page.practice.subtitle")}
        </p>

        <div
          class="grid gap-3 sm:gap-4"
          style={{ "grid-template-columns": "repeat(auto-fit, minmax(220px, 1fr))" }}
        >
          <MenuCard
            href="/practice/exploration"
            title={t("page.practice.exploration.title")}
            subtitle={t("page.practice.exploration.subtitle")}
            icon={<Compass size={32} aria-hidden="true" />}
          />
          <MenuCard
            href="/practice/combat"
            title={t("page.practice.combat.title")}
            subtitle={t("page.practice.combat.subtitle")}
            icon={<Swords size={32} aria-hidden="true" />}
          />
          <MenuCard
            href="/practice/dungeon"
            title={t("page.practice.dungeon.title")}
            subtitle={t("page.practice.dungeon.subtitle")}
            icon={<Castle size={32} aria-hidden="true" />}
          />
          <MenuCard
            href="/practice/multiplayer"
            title={t("page.practice.multiplayer.title")}
            subtitle={t("page.practice.multiplayer.subtitle")}
            icon={<Users size={32} aria-hidden="true" />}
          />
        </div>
      </div>
    </>
  );
};

export default PracticeModeSelectPage;
