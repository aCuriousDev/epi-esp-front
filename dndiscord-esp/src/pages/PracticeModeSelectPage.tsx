import { Component } from "solid-js";
import { Compass, Swords, Castle, Users, Sparkles } from "lucide-solid";
import MenuCard from "../components/common/MenuCard";
import PageMeta from "../layouts/PageMeta";
import { t } from "../i18n";

export const PracticeModeSelectPage: Component = () => {
  return (
    <>
      <PageMeta title={t("page.practice.title")} />

      <div class="space-y-6">
        <div class="flex flex-col items-center gap-3">
          <Sparkles size={32} class="text-gold-300" aria-hidden="true" />
          <p class="text-mid text-ds-body text-center max-w-2xl mx-auto">
            {t("page.practice.subtitle")}
          </p>
          <div class="mx-auto h-px w-32 bg-gradient-to-r from-transparent via-gold-400/60 to-transparent" />
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3 sm:gap-4 max-w-3xl mx-auto">
          <MenuCard
            href="/practice/exploration"
            title={t("page.practice.exploration.title")}
            subtitle={t("page.practice.exploration.subtitle")}
            icon={<Compass size={48} aria-hidden="true" />}
            class="min-h-[200px]"
          />
          <MenuCard
            href="/practice/combat"
            title={t("page.practice.combat.title")}
            subtitle={t("page.practice.combat.subtitle")}
            icon={<Swords size={48} aria-hidden="true" />}
            class="min-h-[200px]"
          />
          <MenuCard
            href="/practice/dungeon"
            title={t("page.practice.dungeon.title")}
            subtitle={t("page.practice.dungeon.subtitle")}
            icon={<Castle size={48} aria-hidden="true" />}
            class="min-h-[200px]"
          />
          <MenuCard
            href="/practice/multiplayer"
            title={t("page.practice.multiplayer.title")}
            subtitle={t("page.practice.multiplayer.subtitle")}
            icon={<Users size={48} aria-hidden="true" />}
            class="min-h-[200px]"
          />
        </div>
      </div>
    </>
  );
};

export default PracticeModeSelectPage;
