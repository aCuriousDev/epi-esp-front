import { Component } from "solid-js";
import { Hexagon, BookOpen } from "lucide-solid";
import { A } from "@solidjs/router";
import Button from "../common/Button";
import { t } from "../../i18n";

/**
 * Onboarding banner shown on Home when the user has no last-played campaign.
 * Replaces the ResumeHero in that state. Encourages the user to start their
 * first adventure with a primary CTA + secondary link to Practice.
 */
export const WelcomeBanner: Component = () => {
  return (
    <section
      class="relative overflow-hidden rounded-ds-xl border border-gold-400/20
             p-4 sm:p-6
             flex flex-col sm:flex-row items-center gap-4 sm:gap-6"
      style={{
        background:
          "linear-gradient(135deg, rgba(75,30,78,0.85) 0%, rgba(22,44,68,0.85) 100%)",
        "box-shadow":
          "0 10px 30px rgba(0,0,0,0.35), 0 0 0 1px rgba(244,197,66,0.08)",
      }}
      aria-label={t("home.welcome.title")}
    >
      <div
        class="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(circle at 8% 50%, rgba(244,197,66,0.08) 0%, transparent 40%)",
        }}
      />

      <div class="relative shrink-0 inline-flex items-center justify-center">
        <div
          class="absolute inset-0 rounded-full pointer-events-none"
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(circle, rgba(244,197,66,0.35) 0%, transparent 65%)",
            filter: "blur(12px)",
            transform: "scale(1.4)",
          }}
        />
        <div class="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full border border-gold-400/40 bg-ink-900/40 flex items-center justify-center">
          <Hexagon size={32} class="text-gold-300" aria-hidden="true" />
        </div>
      </div>

      <div class="relative flex-1 text-center sm:text-left">
        <p class="font-display text-ds-micro tracking-[0.2em] uppercase text-gold-300/80 mb-1">
          {t("home.welcome.eyebrow")}
        </p>
        <h2 class="font-display text-ds-h2 text-high tracking-wide mb-1">
          {t("home.welcome.title")}
        </h2>
        <p class="font-old text-ds-small text-mid italic">
          {t("home.welcome.flavor")}
        </p>
      </div>

      <div class="relative flex flex-col items-center sm:items-end gap-2 shrink-0">
        <Button href="/campaigns/create" leadingIcon={<BookOpen size={16} aria-hidden="true" />}>
          {t("home.welcome.primaryCta")}
        </Button>
        <A
          href="/practice"
          class="text-ds-small text-mid hover:text-high focus-ring-gold rounded transition-colors duration-ds-xs"
        >
          {t("home.welcome.secondaryCta")}
        </A>
      </div>
    </section>
  );
};

export default WelcomeBanner;
