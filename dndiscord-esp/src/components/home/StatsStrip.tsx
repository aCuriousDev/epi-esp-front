import { Component } from "solid-js";
import { t } from "../../i18n";

interface StatCellProps {
  value: number | string;
  unit?: string;
  label: string;
}

const StatCell: Component<StatCellProps> = (props) => (
  <div
    class="flex flex-col items-center justify-center py-4 px-3 gap-1
           border-r border-gold-200/5 last:border-r-0"
    style={{ background: "var(--ink-800, #1a1c2a)" }}
  >
    <div class="flex items-baseline gap-0.5">
      <span
        class="font-display font-bold text-[26px] text-white leading-none"
      >
        {props.value}
      </span>
      {props.unit && (
        <span
          class="text-low leading-none"
          style={{
            "font-family": "'JetBrains Mono', monospace",
            "font-size": "12px",
          }}
        >
          {props.unit}
        </span>
      )}
    </div>
    <span
      class="uppercase text-low"
      style={{
        "font-family": "'JetBrains Mono', monospace",
        "font-size": "10px",
        "letter-spacing": "0.18em",
      }}
    >
      {props.label}
    </span>
  </div>
);

interface StatsStripProps {
  characters: number;
  campaigns: number;
}

export const StatsStrip: Component<StatsStripProps> = (props) => {
  return (
    <div
      class="grid grid-cols-2 md:grid-cols-4 rounded-ds-md overflow-hidden
             border border-gold-200/5"
    >
      <StatCell value={props.characters} label={t("home.stats.characters")} />
      <StatCell value={props.campaigns} label={t("home.stats.campaigns")} />
      <StatCell value={0} label={t("home.stats.sessions")} />
      <StatCell value={0} unit={t("home.stats.unit.hours")} label={t("home.stats.hours")} />
    </div>
  );
};

export default StatsStrip;
