import { Component, JSX } from "solid-js";
import { Compass, Swords, Castle, Users, Sparkles } from "lucide-solid";
import { A } from "@solidjs/router";
import PageMeta from "../layouts/PageMeta";
import SectionHeader from "../components/common/SectionHeader";
import { t } from "../i18n";

type Tone = "plum" | "indigo";

interface PracticeMode {
  href: string;
  icon: JSX.Element;
  title: string;
  subtitle: string;
  flavor: string;
  tone: Tone;
}

const TONE_BG: Record<Tone, string> = {
  plum:
    "radial-gradient(circle at 30% 30%, rgba(75,30,78,0.4), transparent 60%)",
  indigo:
    "radial-gradient(circle at 70% 30%, rgba(22,44,68,0.45), transparent 60%)",
};

const PracticeCard: Component<{ m: PracticeMode }> = (props) => {
  return (
    <A
      href={props.m.href}
      class="menu-card relative block no-underline text-inherit"
    >
      <div
        class="absolute inset-0 pointer-events-none rounded-[inherit]"
        style={{ background: TONE_BG[props.m.tone] }}
        aria-hidden="true"
      />
      <div class="relative z-10">
        <div class="flex items-center gap-4 mb-4">
          <span
            class="inline-flex items-center justify-center w-[52px] h-[52px] rounded-ds-md text-gold-300 shrink-0"
            style={{
              background:
                "linear-gradient(135deg, rgba(75,30,78,0.5) 0%, rgba(22,44,68,0.5) 100%)",
              border: "1px solid rgba(244,197,66,0.25)",
            }}
          >
            {props.m.icon}
          </span>
          <div class="min-w-0">
            <h3 class="font-display font-semibold text-[20px] tracking-[0.06em] text-high mb-1 leading-tight">
              {props.m.title}
            </h3>
            <p class="text-[12px] text-low leading-snug">{props.m.subtitle}</p>
          </div>
        </div>
        <p class="font-old italic text-[13px] text-mid pt-3 border-t border-white/6 m-0">
          &ldquo;{props.m.flavor}&rdquo;
        </p>
      </div>
    </A>
  );
};

export const PracticeModeSelectPage: Component = () => {
  const modes: PracticeMode[] = [
    {
      href: "/practice/exploration",
      icon: <Compass size={26} aria-hidden="true" />,
      title: t("page.practice.exploration.title"),
      subtitle: t("page.practice.exploration.subtitle"),
      flavor: t("page.practice.exploration.flavor"),
      tone: "plum",
    },
    {
      href: "/practice/combat",
      icon: <Swords size={26} aria-hidden="true" />,
      title: t("page.practice.combat.title"),
      subtitle: t("page.practice.combat.subtitle"),
      flavor: t("page.practice.combat.flavor"),
      tone: "indigo",
    },
    {
      href: "/practice/dungeon",
      icon: <Castle size={26} aria-hidden="true" />,
      title: t("page.practice.dungeon.title"),
      subtitle: t("page.practice.dungeon.subtitle"),
      flavor: t("page.practice.dungeon.flavor"),
      tone: "plum",
    },
    {
      href: "/practice/multiplayer",
      icon: <Users size={26} aria-hidden="true" />,
      title: t("page.practice.multiplayer.title"),
      subtitle: t("page.practice.multiplayer.subtitle"),
      flavor: t("page.practice.multiplayer.flavor"),
      tone: "indigo",
    },
  ];

  return (
    <>
      <PageMeta title={t("page.practice.title")} />

      <div class="max-w-[880px] mx-auto space-y-6">
        <div class="text-center">
          <Sparkles
            size={32}
            class="mx-auto text-gold-300 mb-3"
            aria-hidden="true"
          />
          <p class="text-mid text-ds-body max-w-2xl mx-auto">
            {t("page.practice.subtitle")}
          </p>
        </div>

        <div>
          <SectionHeader
            eyebrow={t("page.practice.sectionEyebrow")}
            counter={t("page.practice.sectionCounter").toUpperCase()}
          />
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {modes.map((m) => <PracticeCard m={m} />)}
          </div>
        </div>
      </div>
    </>
  );
};

export default PracticeModeSelectPage;
