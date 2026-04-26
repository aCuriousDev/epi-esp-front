import { Component, Show } from "solid-js";
import { Users } from "lucide-solid";
import { Campaign, CampaignStatus } from "../types/campaign";
import { displayDungeonMasterName } from "../services/campaign.service";
import { authStore } from "../stores/auth.store";
import { t } from "../i18n";

interface CampaignCardProps {
  campaign: Campaign;
  onClick: () => void;
  /** Index in the grid — drives plum/indigo tone alternation. */
  index?: number;
}

const TONE_BY_INDEX = ["plum", "indigo"] as const;

const TONE_BG: Record<"plum" | "indigo", string> = {
  plum:
    "linear-gradient(135deg, rgba(75,30,78,0.55) 0%, rgba(43,15,46,0.7) 100%)",
  indigo:
    "linear-gradient(135deg, rgba(22,44,68,0.55) 0%, rgba(11,26,44,0.7) 100%)",
};

const STATUS_KEY: Record<string, string> = {
  active: "page.campaigns.statusActive",
  preparation: "page.campaigns.statusPreparation",
  in_preparation: "page.campaigns.statusPreparation",
  planning: "page.campaigns.statusPreparation",
  paused: "page.campaigns.statusPaused",
  completed: "page.campaigns.statusCompleted",
  archived: "page.campaigns.statusArchived",
};

function statusKeyFor(status: CampaignStatus | string | undefined): string {
  if (!status) return "page.campaigns.statusPreparation";
  const k = String(status).toLowerCase().replace(/-/g, "_");
  return STATUS_KEY[k] ?? "page.campaigns.statusPreparation";
}

function isActiveStatus(status: CampaignStatus | string | undefined): boolean {
  return String(status ?? "").toLowerCase() === "active";
}

const CampaignCard: Component<CampaignCardProps> = (props) => {
  const c = () => props.campaign;
  const tone = () => TONE_BY_INDEX[(props.index ?? 0) % TONE_BY_INDEX.length];
  const active = () => isActiveStatus(c().status);

  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-label={`Open campaign: ${c().title}`}
      class="menu-card !p-0 block w-full text-left overflow-hidden"
    >
      {/* Art header */}
      <div
        class="relative h-[110px] border-b"
        style={{
          background: TONE_BG[tone()],
          "border-color": "rgba(244,197,66,0.2)",
        }}
        aria-hidden="true"
      >
        <div
          class="absolute inset-0 pointer-events-none"
          style={{
            background:
              "repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0 2px, transparent 2px 12px)",
          }}
        />
        {/* Status pill */}
        <span
          class="absolute top-3 right-3 px-2.5 py-1 rounded-full font-mono text-[10px] uppercase tracking-[0.12em]"
          style={{
            background: active()
              ? "rgba(74,222,128,0.18)"
              : "rgba(106,144,192,0.18)",
            border: `1px solid ${active() ? "rgba(74,222,128,0.45)" : "rgba(106,144,192,0.45)"}`,
            color: active() ? "#86efac" : "#a4c0e0",
          }}
        >
          {t(statusKeyFor(c().status) as any)}
        </span>
        {/* Central rune */}
        <svg
          class="absolute top-1/2 left-1/2"
          style={{
            transform: "translate(-50%, -50%)",
            opacity: "0.7",
          }}
          width="56"
          height="56"
          viewBox="0 0 60 60"
          aria-hidden="true"
        >
          <circle
            cx="30"
            cy="30"
            r="22"
            fill="none"
            stroke="rgba(244,197,66,0.4)"
            stroke-width="0.8"
          />
          <polygon
            points="30,12 33,27 48,30 33,33 30,48 27,33 12,30 27,27"
            fill="rgba(244,197,66,0.65)"
          />
        </svg>
      </div>

      {/* Body */}
      <div class="px-5 pt-4 pb-5">
        <h3 class="font-display font-semibold text-[18px] text-high tracking-wide mb-1.5 line-clamp-1">
          {c().title}
        </h3>
        <Show when={c().description}>
          <p class="font-old italic text-[13px] text-mid line-clamp-1 mb-3.5 min-h-[1.25rem]">
            {c().description}
          </p>
        </Show>

        <div class="flex items-center gap-3 text-[12px] text-low">
          <span class="inline-flex items-center gap-1.5">
            <Users size={13} aria-hidden="true" />
            <span aria-label={`${c().currentPlayers} of ${c().maxPlayers}`}>
              {c().currentPlayers}/{c().maxPlayers}
            </span>
          </span>
          <span
            class="w-[3px] h-[3px] rounded-full bg-[var(--text-mute)]"
            aria-hidden="true"
          />
          <span class="inline-flex items-center gap-1.5 text-gold-300">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 2 L14 8 L20 8 L15 12 L17 18 L12 14 L7 18 L9 12 L4 8 L10 8 Z" />
            </svg>
            <span class="sr-only">{t("campaign.card.dm")}</span>
            <span aria-hidden="true">{t("campaign.card.dmAbbr")}</span>
            <span class="text-high font-medium">
              · {displayDungeonMasterName(c(), authStore.user()?.username)}
            </span>
          </span>
        </div>
      </div>
    </button>
  );
};

export default CampaignCard;
