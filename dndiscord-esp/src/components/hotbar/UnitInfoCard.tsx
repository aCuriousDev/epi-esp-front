import { Component, Show } from "solid-js";
import { Heart, Shield, Swords } from "lucide-solid";
import { gameState } from "../../game/stores/GameStateStore";
import { units } from "../../game/stores/UnitsStore";
import { Team } from "../../types";

/**
 * Floating compact info card for whatever unit the viewer currently has
 * selected — renders top-center above the canvas so it doesn't clash with
 * the bottom-center hotbar. Works for both enemies and allies; the portrait
 * border colour + label shift based on team.
 */
export const UnitInfoCard: Component = () => {
  const selectedUnit = () => {
    const id = gameState.selectedUnit;
    return id ? (units[id] ?? null) : null;
  };

  const hpPct = (current: number, max: number) =>
    max <= 0 ? 0 : Math.max(0, Math.min(100, (current / max) * 100));

  return (
    <Show when={selectedUnit()}>
      {(u) => {
        const isEnemy = () => u().team === Team.ENEMY;
        const hp = () => hpPct(u().stats.currentHealth, u().stats.maxHealth);
        const colourClass = () =>
          isEnemy()
            ? "border-red-500/50 from-red-950/95 to-rose-900/90 ring-red-500/20"
            : "border-emerald-500/40 from-emerald-950/95 to-teal-900/90 ring-emerald-500/20";
        const hpBar = () =>
          isEnemy()
            ? "from-red-500 to-rose-400"
            : "from-emerald-500 to-teal-400";
        const label = () => (isEnemy() ? "Ennemi" : "Allié");
        const labelColour = () =>
          isEnemy() ? "text-red-300" : "text-emerald-300";

        return (
          <div
            class={`pointer-events-auto px-4 py-3 min-w-[240px] max-w-[320px] bg-gradient-to-br border rounded-xl shadow-2xl ring-1 backdrop-blur-sm ${colourClass()}`}
            style={{ "box-shadow": "0 8px 32px rgba(0,0,0,0.6)" }}
          >
            <div class="flex items-center gap-3 mb-2">
              <span
                class={`w-2 h-2 rounded-full ${
                  isEnemy() ? "bg-red-400" : "bg-emerald-400"
                } shadow-[0_0_6px_currentColor]`}
              />
              <span
                class={`text-[9px] uppercase tracking-widest font-bold ${labelColour()}`}
              >
                {label()}
              </span>
              <span class="text-sm font-semibold text-white truncate flex-1">
                {u().name}
              </span>
            </div>

            {/* HP */}
            <div class="flex items-center gap-2 mb-1.5">
              <Heart class="w-3 h-3 text-red-300" />
              <div class="relative flex-1 h-2 rounded-full bg-black/40 border border-white/10 overflow-hidden">
                <div
                  class={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${hpBar()} transition-all duration-300`}
                  style={{ width: `${hp()}%` }}
                />
              </div>
              <span class="text-[10px] font-mono text-white/85 tabular-nums min-w-[50px] text-right">
                {u().stats.currentHealth}/{u().stats.maxHealth}
              </span>
            </div>

            {/* Stats row */}
            <div class="flex items-center gap-3 mt-2 text-[10px] text-white/70">
              <span class="flex items-center gap-1">
                <Shield class="w-3 h-3 text-sky-300" />
                <span class="font-mono tabular-nums">{u().stats.defense}</span>
              </span>
              <span class="flex items-center gap-1">
                <Swords class="w-3 h-3 text-amber-300" />
                <span class="font-mono tabular-nums">
                  {u().stats.attackDamage}
                </span>
              </span>
              <span class="ml-auto text-[9px] text-white/50 uppercase tracking-wider">
                Init {u().stats.initiative}
              </span>
            </div>
          </div>
        );
      }}
    </Show>
  );
};
