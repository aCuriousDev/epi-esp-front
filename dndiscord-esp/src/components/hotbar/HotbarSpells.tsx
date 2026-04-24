import { Component, For, Show } from "solid-js";
import { Swords, Zap } from "lucide-solid";
import type { Unit } from "../../types";
import { gameState } from "../../game/stores/GameStateStore";
import { selectAbility } from "../../game/actions/CombatActions";

interface HotbarSpellsProps {
  unit: Unit | null;
  /** True when the player can currently pick an ability (their turn + own unit). */
  canAct: boolean;
}

/**
 * Middle cluster of the hotbar — one slot per ability on the local player's
 * unit. Clicking enters targeting mode via the existing selectAbility flow.
 */
export const HotbarSpells: Component<HotbarSpellsProps> = (props) => {
  const abilities = () => props.unit?.abilities ?? [];
  const selectedId = () => gameState.selectedAbility;

  const handleClick = (abilityId: string) => {
    if (!props.canAct) return;
    selectAbility(abilityId);
  };

  return (
    <div class="flex items-end gap-1.5 px-2 py-2 rounded-xl bg-gradient-to-br from-zinc-950/85 to-slate-950/85 border border-amber-500/20 shadow-lg backdrop-blur-sm">
      <Show when={abilities().length === 0}>
        <div class="flex items-center gap-1.5 px-3 py-2 text-[10px] text-slate-400 italic">
          <Swords class="w-3 h-3 opacity-50" />
          Aucune capacité
        </div>
      </Show>
      <For each={abilities()}>
        {(ability) => {
          const isSelected = () => selectedId() === ability.id;
          const onCooldown = () => ability.currentCooldown > 0;
          const tooExpensive = () =>
            props.unit ? ability.apCost > props.unit.stats.currentActionPoints : false;
          const disabled = () => !props.canAct || onCooldown() || tooExpensive();

          return (
            <button
              onClick={() => handleClick(ability.id)}
              disabled={disabled()}
              class={`relative w-12 h-12 rounded-lg border-2 flex flex-col items-center justify-center transition-all focus-ring-gold ${
                isSelected()
                  ? "border-amber-300 bg-amber-500/30 shadow-[0_0_12px_rgba(251,191,36,0.5)] scale-105"
                  : disabled()
                  ? "border-slate-700/60 bg-slate-900/50 opacity-50 cursor-not-allowed"
                  : "border-amber-500/40 bg-amber-900/20 hover:bg-amber-500/20 hover:border-amber-400 cursor-pointer"
              }`}
              title={`${ability.name}\n${ability.description}\nCoût: ${ability.apCost} PA · Portée: ${ability.range}`}
            >
              <Zap
                class={`w-4 h-4 ${
                  isSelected() ? "text-amber-100" : "text-amber-300/70"
                }`}
              />
              <span
                class={`text-[8px] font-semibold mt-0.5 max-w-[44px] truncate ${
                  isSelected() ? "text-white" : "text-amber-200/70"
                }`}
              >
                {ability.name}
              </span>
              {/* AP cost corner badge */}
              <span class="absolute -top-1 -left-1 min-w-[14px] h-3.5 px-1 rounded-full bg-sky-500 border border-sky-300/50 text-[8px] font-bold text-white flex items-center justify-center leading-none">
                {ability.apCost}
              </span>
              {/* Cooldown overlay */}
              <Show when={onCooldown()}>
                <div class="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center">
                  <span class="text-sm font-bold text-white font-mono">
                    {ability.currentCooldown}
                  </span>
                </div>
              </Show>
            </button>
          );
        }}
      </For>
    </div>
  );
};
