import { Component, For, Show, createMemo } from "solid-js";
import { Skull, Zap, Flag } from "lucide-solid";
import { units } from "../../game/stores/UnitsStore";
import { gameState } from "../../game/stores/GameStateStore";
import { getCurrentUnit, endUnitTurn } from "../../game";
import { selectAbility, selectUnit } from "../../game";
import { GamePhase, Team } from "../../types";
import { isDm, isInSession } from "../../stores/session.store";

/**
 * DM-only hotbar that surfaces during an enemy's turn so the DM can actively
 * play the acting enemy — select abilities, attack players, end the turn.
 * Without this the DM could only teleport enemies (DmPanel → Déplacer) or
 * skip the whole turn (Passer tour ennemi). Replaces the disabled auto-AI
 * in multiplayer.
 *
 * Self-gates on: DM in a session, phase=ENEMY_TURN, current unit exists and
 * is an enemy. Silently renders nothing otherwise.
 */
export const EnemyHotbar: Component = () => {
  const currentEnemy = createMemo(() => {
    if (gameState.phase !== GamePhase.ENEMY_TURN) return null;
    const current = getCurrentUnit();
    if (!current || current.team !== Team.ENEMY) return null;
    return current;
  });

  const abilities = () => currentEnemy()?.abilities ?? [];
  const selectedId = () => gameState.selectedAbility;

  const hpPct = () => {
    const e = currentEnemy();
    if (!e || e.stats.maxHealth <= 0) return 0;
    return Math.max(0, Math.min(100, (e.stats.currentHealth / e.stats.maxHealth) * 100));
  };

  const apPipIndices = createMemo(() => {
    const max = currentEnemy()?.stats.maxActionPoints ?? 0;
    return Array.from({ length: max }, (_, i) => i);
  });

  // Auto-select the acting enemy so ability targeting has something to bind to.
  const ensureSelected = () => {
    const e = currentEnemy();
    if (e && gameState.selectedUnit !== e.id) {
      selectUnit(e.id);
    }
  };

  const handleAbility = (abilityId: string) => {
    ensureSelected();
    selectAbility(abilityId);
  };

  const visible = createMemo(() => isInSession() && isDm() && !!currentEnemy());

  return (
    <Show when={visible()}>
      <div
        class="fixed bottom-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
        data-testid="enemy-hotbar"
      >
        <div class="flex items-end gap-2 pointer-events-auto">
          {/* Enemy portrait */}
          <Show when={currentEnemy()}>
            {(e) => (
              <div class="flex items-center gap-3 pl-2 pr-3 py-2 rounded-xl bg-gradient-to-br from-red-950/90 to-rose-950/90 border border-red-500/40 shadow-lg backdrop-blur-sm">
                <div class="relative w-14 h-14 rounded-lg bg-gradient-to-br from-red-700/40 to-rose-900/50 border-2 border-red-400/60 flex items-center justify-center shadow-inner">
                  <Skull class="w-6 h-6 text-red-200" />
                </div>
                <div class="min-w-[110px]">
                  <div class="text-[10px] uppercase tracking-widest font-bold text-red-300/80">
                    DM plays
                  </div>
                  <div class="text-xs text-red-100 font-semibold tracking-wide truncate max-w-[140px]">
                    {e().name}
                  </div>
                  <div class="mt-1 flex items-center gap-1.5">
                    <span class="text-[9px] font-bold text-red-300/80 uppercase tracking-wider w-4">
                      HP
                    </span>
                    <div class="relative flex-1 h-2 rounded-full bg-black/40 border border-white/10 overflow-hidden">
                      <div
                        class="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-red-500 to-rose-400 transition-all duration-300"
                        style={{ width: `${hpPct()}%` }}
                      />
                    </div>
                    <span class="text-[10px] font-mono text-white/80 tabular-nums min-w-[40px] text-right">
                      {e().stats.currentHealth}/{e().stats.maxHealth}
                    </span>
                  </div>
                  <div class="mt-1 flex items-center gap-1.5">
                    <span class="text-[9px] font-bold text-sky-300/80 uppercase tracking-wider w-4">
                      AP
                    </span>
                    <div class="flex items-center gap-0.5">
                      <For each={apPipIndices()}>
                        {(i) => (
                          <span
                            class={`w-1.5 h-3 rounded-sm border ${
                              i < e().stats.currentActionPoints
                                ? "bg-sky-400/90 border-sky-200/60 shadow-[0_0_4px_rgba(125,211,252,0.7)]"
                                : "bg-sky-900/40 border-sky-700/40"
                            }`}
                          />
                        )}
                      </For>
                    </div>
                    <span class="text-[10px] font-mono text-white/60 tabular-nums ml-1">
                      {e().stats.currentActionPoints}/{e().stats.maxActionPoints}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </Show>

          {/* Enemy abilities — same interaction as the player hotbar, reusing
              the existing selectAbility flow. DM clicks an ability, then
              clicks a player tile to fire. */}
          <div class="flex items-end gap-1.5 px-2 py-2 rounded-xl bg-gradient-to-br from-zinc-950/85 to-slate-950/85 border border-red-500/20 shadow-lg backdrop-blur-sm">
            <Show when={abilities().length === 0}>
              <div class="flex items-center gap-1.5 px-3 py-2 text-[10px] text-slate-400 italic">
                <Zap class="w-3 h-3 opacity-50" />
                No abilities
              </div>
            </Show>
            <For each={abilities()}>
              {(ability) => {
                const isSelected = () => selectedId() === ability.id;
                const onCooldown = () => ability.currentCooldown > 0;
                const tooExpensive = () => {
                  const e = currentEnemy();
                  return e ? ability.apCost > e.stats.currentActionPoints : false;
                };
                const disabled = () => onCooldown() || tooExpensive();

                return (
                  <button
                    onClick={() => handleAbility(ability.id)}
                    disabled={disabled()}
                    class={`relative w-12 h-12 rounded-lg border-2 flex flex-col items-center justify-center transition-all focus-ring-gold ${
                      isSelected()
                        ? "border-red-300 bg-red-500/30 shadow-[0_0_12px_rgba(251,113,133,0.5)] scale-105"
                        : disabled()
                        ? "border-slate-700/60 bg-slate-900/50 opacity-50 cursor-not-allowed"
                        : "border-red-500/40 bg-red-900/20 hover:bg-red-500/20 hover:border-red-400 cursor-pointer"
                    }`}
                    title={`${ability.name}\n${ability.description}\nCost: ${ability.apCost} AP · Range: ${ability.range}`}
                  >
                    <Zap
                      class={`w-4 h-4 ${
                        isSelected() ? "text-red-100" : "text-red-300/70"
                      }`}
                    />
                    <span
                      class={`text-[8px] font-semibold mt-0.5 max-w-[44px] truncate ${
                        isSelected() ? "text-white" : "text-red-200/70"
                      }`}
                    >
                      {ability.name}
                    </span>
                    <span class="absolute -top-1 -left-1 min-w-[14px] h-3.5 px-1 rounded-full bg-sky-500 border border-sky-300/50 text-[8px] font-bold text-white flex items-center justify-center leading-none">
                      {ability.apCost}
                    </span>
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

          {/* End-turn for the current enemy. Parallels the player hotbar's
              end-turn slot; tailored red so the DM sees at a glance they're
              acting as the antagonist. */}
          <button
            onClick={() => endUnitTurn()}
            class="flex flex-col items-center justify-center w-14 h-14 rounded-xl border-2 border-red-400 bg-gradient-to-br from-red-600 to-rose-700 text-white hover:from-red-500 hover:to-rose-600 shadow-lg shadow-red-500/30 transition-colors focus-ring-gold font-bold"
            title="Fin du tour de l'ennemi"
          >
            <Flag class="w-4 h-4" />
            <span class="text-[9px] mt-0.5 uppercase tracking-wider">Fin</span>
          </button>
        </div>
      </div>
    </Show>
  );
};
