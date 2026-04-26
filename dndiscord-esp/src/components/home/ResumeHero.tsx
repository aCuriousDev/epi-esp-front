import { Component, Show, createResource } from "solid-js";
import { Play } from "lucide-solid";
import { useLastCampaignId } from "../../hooks/useLastCampaign";
import Button from "../common/Button";
import { CampaignService } from "../../services/campaign.service";
import { t } from "../../i18n";

const lastPlayedLabel = (iso?: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
};

/** Decorative SVG rune: 8-pointed star + concentric circles */
const RuneSVG: Component = () => (
  <svg
    width="80"
    height="80"
    viewBox="0 0 80 80"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    style={{ opacity: "0.55" }}
  >
    <circle cx="40" cy="40" r="38" stroke="rgba(244,197,66,0.5)" stroke-width="0.8" />
    <circle cx="40" cy="40" r="28" stroke="rgba(244,197,66,0.35)" stroke-width="0.6" />
    <circle cx="40" cy="40" r="16" stroke="rgba(244,197,66,0.3)" stroke-width="0.6" />
    {/* 8-pointed star */}
    <path
      d="M40 4 L43 37 L76 40 L43 43 L40 76 L37 43 L4 40 L37 37 Z"
      fill="rgba(244,197,66,0.6)"
    />
    <path
      d="M40 4 L42.8 37.2 L76 40 L42.8 42.8 L40 76 L37.2 42.8 L4 40 L37.2 37.2 Z"
      fill="none"
      stroke="rgba(244,197,66,0.4)"
      stroke-width="0.5"
    />
    {/* Diagonal axes */}
    <line x1="11.7" y1="11.7" x2="35.8" y2="35.8" stroke="rgba(244,197,66,0.4)" stroke-width="0.5" />
    <line x1="44.2" y1="44.2" x2="68.3" y2="68.3" stroke="rgba(244,197,66,0.4)" stroke-width="0.5" />
    <line x1="68.3" y1="11.7" x2="44.2" y2="35.8" stroke="rgba(244,197,66,0.4)" stroke-width="0.5" />
    <line x1="35.8" y1="44.2" x2="11.7" y2="68.3" stroke="rgba(244,197,66,0.4)" stroke-width="0.5" />
  </svg>
);

export const ResumeHero: Component = () => {
  const lastId = useLastCampaignId();

  const [campaign] = createResource(lastId, async (id) => {
    if (!id) return null;
    try {
      return await CampaignService.getCampaign(id);
    } catch {
      return null;
    }
  });

  return (
    <Show when={campaign()}>
      {(c) => (
        <section
          class="rounded-ds-lg border border-gold-400/25 overflow-hidden
                 hover:-translate-y-0.5 hover:shadow-lift transition-all duration-ds-sm"
          style={{
            background:
              "linear-gradient(135deg, rgba(75,30,78,0.55) 0%, rgba(22,44,68,0.60) 55%, rgba(16,18,28,0.70) 100%)",
            "box-shadow": "0 8px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(244,197,66,0.08)",
            padding: "22px 24px",
          }}
          aria-label={t("home.hero.resume")}
        >
          {/* 3-column grid: art | meta | actions */}
          <div class="grid grid-cols-1 sm:grid-cols-[220px_1fr_auto] gap-4 sm:gap-5 items-start">

            {/* ── Art panel ── */}
            <div
              class="relative rounded-ds-md overflow-hidden border border-gold-400/30
                     w-full sm:w-[220px] aspect-[16/10] shrink-0 flex items-center justify-center"
              style={{
                background:
                  "linear-gradient(135deg, var(--plum-900, #2a0f2d) 0%, var(--arcindigo-900, #0d1c3d) 100%)",
              }}
            >
              {/* Radial gold/plum spots */}
              <div
                class="absolute inset-0 pointer-events-none"
                aria-hidden="true"
                style={{
                  background:
                    "radial-gradient(ellipse at 20% 30%, rgba(244,197,66,0.12) 0%, transparent 50%), " +
                    "radial-gradient(ellipse at 75% 70%, rgba(75,30,78,0.25) 0%, transparent 55%)",
                }}
              />
              {/* Diagonal stripes */}
              <div
                class="absolute inset-0 pointer-events-none"
                aria-hidden="true"
                style={{
                  background:
                    "repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0 2px, transparent 2px 12px)",
                }}
              />
              {/* Central rune */}
              <div class="relative z-10">
                <RuneSVG />
              </div>
              {/* "CAMPAIGN ART" label */}
              <span
                class="absolute bottom-2 left-2 z-20 uppercase text-gold-300/60"
                style={{
                  "font-family": "'JetBrains Mono', monospace",
                  "font-size": "10px",
                  "letter-spacing": "0.08em",
                }}
              >
                Campaign Art
              </span>
            </div>

            {/* ── Meta column ── */}
            <div class="flex flex-col gap-2 min-w-0">
              {/* Eyebrow */}
              <p
                class="uppercase text-gold-300"
                style={{
                  "font-family": "'JetBrains Mono', monospace",
                  "font-size": "11px",
                  "letter-spacing": "0.18em",
                }}
              >
                {t("home.resume.eyebrow")}
              </p>

              {/* Campaign title */}
              <h2
                class="font-display font-bold text-[28px] tracking-[0.03em] text-high leading-tight truncate"
              >
                {c().name}
              </h2>

              {/* Flavor / description */}
              <p class="font-old italic text-[14px] text-mid line-clamp-2">
                {(c() as { description?: string }).description?.trim() ||
                  t("home.resume.flavor.fallback")}
              </p>

              {/* Last played row */}
              <div class="flex items-center gap-2 mt-0.5">
                <span class="text-[12px] text-low font-mono">
                  {t("home.resume.lastPlayed", {
                    when: lastPlayedLabel(
                      (c() as { lastPlayedAt?: string }).lastPlayedAt ?? c().updatedAt
                    ),
                  })}
                </span>
              </div>
            </div>

            {/* ── Actions column ── */}
            <div class="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
              <Button
                href={`/campaigns/${c().id}`}
                leadingIcon={<Play size={14} aria-hidden="true" />}
              >
                {t("home.hero.resume")}
              </Button>
              <Button href={`/campaigns/${c().id}`} variant="ghost" size="sm">
                {t("home.resume.details")}
              </Button>
            </div>

          </div>
        </section>
      )}
    </Show>
  );
};

export default ResumeHero;
