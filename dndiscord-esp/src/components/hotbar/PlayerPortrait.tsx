import { Component, For, Show, createMemo } from "solid-js";
import type { Unit } from "../../types";

interface PlayerPortraitProps {
  unit: Unit | null;
  onClick?: () => void;
}

/**
 * Left cluster of the hotbar — compact identity + vitals.
 * Shows the local player's unit name initials, an HP bar, and AP pips.
 * Clicking opens the player's own character sheet (read-only).
 */
export const PlayerPortrait: Component<PlayerPortraitProps> = (props) => {
  const initials = () => {
    const name = props.unit?.name ?? "";
    return name
      .split(/\s+/)
      .map((w) => w[0]?.toUpperCase())
      .filter(Boolean)
      .slice(0, 2)
      .join("") || "?";
  };

  const hpPct = () => {
    const u = props.unit;
    if (!u || u.stats.maxHealth <= 0) return 0;
    return Math.max(0, Math.min(100, (u.stats.currentHealth / u.stats.maxHealth) * 100));
  };

  // Reactive list of AP pip indices — using <For> rather than .map() keeps the
  // rendered pips in sync if maxActionPoints ever changes at runtime (buff /
  // debuff). .map() in JSX produces a static snapshot in SolidJS.
  const apPipIndices = createMemo(() => {
    const max = props.unit?.stats.maxActionPoints ?? 0;
    return Array.from({ length: max }, (_, i) => i);
  });

  return (
    <Show when={props.unit}>
      {(u) => (
        <div class="flex items-center gap-3 pl-2 pr-3 py-2 rounded-xl bg-gradient-to-br from-indigo-950/90 to-purple-950/90 border border-indigo-500/30 shadow-lg backdrop-blur-sm">
          <button
            type="button"
            onClick={props.onClick}
            disabled={!props.onClick}
            title={props.onClick ? "Voir ma fiche" : undefined}
            class="relative w-14 h-14 rounded-lg bg-gradient-to-br from-amber-500/30 to-orange-700/40 border-2 border-amber-400/60 flex items-center justify-center shadow-inner transition-all enabled:hover:border-amber-300 enabled:hover:shadow-[0_0_12px_rgba(251,191,36,0.45)] enabled:cursor-pointer disabled:cursor-default"
          >
            <span class="font-display text-2xl text-amber-100 drop-shadow">
              {initials()}
            </span>
          </button>
          <div class="min-w-[110px]">
            <div class="text-xs text-amber-200 font-semibold tracking-wide truncate max-w-[140px]">
              {u().name}
            </div>
            {/* HP */}
            <div class="mt-1 flex items-center gap-1.5">
              <span class="text-[9px] font-bold text-red-300/80 uppercase tracking-wider w-4">
                PV
              </span>
              <div class="relative flex-1 h-2 rounded-full bg-black/40 border border-white/10 overflow-hidden">
                <div
                  class="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-red-500 to-rose-400 transition-all duration-300"
                  style={{ width: `${hpPct()}%` }}
                />
              </div>
              <span class="text-[10px] font-mono text-white/80 tabular-nums min-w-[40px] text-right">
                {u().stats.currentHealth}/{u().stats.maxHealth}
              </span>
            </div>
            {/* AP */}
            <div class="mt-1 flex items-center gap-1.5">
              <span class="text-[9px] font-bold text-sky-300/80 uppercase tracking-wider w-4">
                PA
              </span>
              <div class="flex items-center gap-0.5">
                <For each={apPipIndices()}>
                  {(i) => (
                    <span
                      class={`w-1.5 h-3 rounded-sm border ${
                        i < u().stats.currentActionPoints
                          ? "bg-sky-400/90 border-sky-200/60 shadow-[0_0_4px_rgba(125,211,252,0.7)]"
                          : "bg-sky-900/40 border-sky-700/40"
                      }`}
                    />
                  )}
                </For>
              </div>
              <span class="text-[10px] font-mono text-white/60 tabular-nums ml-1">
                {u().stats.currentActionPoints}/{u().stats.maxActionPoints}
              </span>
            </div>
          </div>
        </div>
      )}
    </Show>
  );
};
