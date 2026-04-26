import { Component, Show } from "solid-js";
import { Play, Loader2 } from "lucide-solid";
import Button from "../common/Button";
import { sessionState, isHost } from "../../stores/session.store";
import { SessionState } from "../../types/multiplayer";
import { t } from "../../i18n";

interface LiveSessionHeroProps {
  onResume: () => void;
  recovering?: boolean;
}

export const LiveSessionHero: Component<LiveSessionHeroProps> = (props) => {
  const session = () => sessionState.session;
  const playerCount = () => session()?.players.length ?? 0;

  const roleLabel = () =>
    isHost() ? t("home.live.role.dm") : t("home.live.role.player");

  const stateLabel = () =>
    session()?.state === SessionState.InProgress
      ? t("home.live.state.inGame")
      : t("home.live.state.lobby");

  const playersLabel = () =>
    playerCount() === 1
      ? t("home.live.players", { n: 1 })
      : t("home.live.playersPlural", { n: playerCount() });

  const flavor = () =>
    isHost() ? t("home.live.flavorDm") : t("home.live.flavorPlayer");

  const title = () =>
    session()?.campaignName ?? t("home.live.title");

  return (
    <section
      class="dnd-live-pulse rounded-ds-lg border border-emerald-400/40 overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, rgba(6,78,59,0.55) 0%, rgba(22,44,68,0.65) 55%, rgba(16,18,28,0.75) 100%)",
        padding: "20px 22px",
      }}
      aria-label={t("home.live.title")}
    >
      <div class="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 sm:gap-5 items-center">
        {/* Meta column */}
        <div class="flex flex-col gap-1.5 min-w-0">
          {/* Eyebrow with pulsing dot */}
          <div class="flex items-center gap-2">
            <span
              class="dnd-live-dot inline-block w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]"
              aria-hidden="true"
            />
            <p
              class="uppercase text-emerald-300"
              style={{
                "font-family": "'JetBrains Mono', monospace",
                "font-size": "11px",
                "letter-spacing": "0.18em",
              }}
            >
              {t("home.live.eyebrow")}
            </p>
          </div>

          {/* Title — campaign name or generic */}
          <h2 class="font-display font-bold text-[24px] sm:text-[26px] tracking-[0.03em] text-high leading-tight truncate">
            {title()}
          </h2>

          {/* Flavor */}
          <p class="font-old italic text-[13px] text-mid line-clamp-2">
            {flavor()}
          </p>

          {/* Meta strip — role · state · players */}
          <div class="flex items-center gap-2 mt-1 flex-wrap">
            <span class="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-200 border border-emerald-400/30 font-mono">
              {roleLabel()}
            </span>
            <span class="text-[11px] px-2 py-0.5 rounded-full bg-white/5 text-slate-300 border border-white/10 font-mono">
              {stateLabel()}
            </span>
            <span class="text-[11px] text-low font-mono">
              {playersLabel()}
            </span>
          </div>
        </div>

        {/* Action column */}
        <div class="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
          <Button
            onClick={props.onResume}
            disabled={!!props.recovering}
            leadingIcon={
              <Show
                when={props.recovering}
                fallback={<Play size={14} aria-hidden="true" />}
              >
                <Loader2 size={14} class="animate-spin" aria-hidden="true" />
              </Show>
            }
          >
            {props.recovering
              ? t("home.live.recovering")
              : t("home.live.cta")}
          </Button>
        </div>
      </div>
    </section>
  );
};

export default LiveSessionHero;
