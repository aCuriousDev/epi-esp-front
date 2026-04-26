import { Component, createMemo } from "solid-js";
import { UnitInfoCard } from "./UnitInfoCard";
import { gameState } from "../../game/stores/GameStateStore";
import { GameMode, GamePhase } from "../../types";

interface UnitInfoCardTopProps {
  /** Current game mode (used to detect combat-style modes with a turn timeline). */
  mode: GameMode;
}

/**
 * Top-center placement for the floating UnitInfoCard. Stacks under the
 * turn-order timeline (combat) and/or the phase pill (free roam, prep) so
 * it never overlaps the right-side journal toggle. Card auto-hides when no
 * unit is hovered/selected so the slot only renders content when needed.
 */
export const UnitInfoCardTop: Component<UnitInfoCardTopProps> = (props) => {
  const topClass = createMemo(() => {
    const inCombat =
      (props.mode === GameMode.COMBAT || props.mode === GameMode.DUNGEON) &&
      gameState.turnOrder.length > 0;
    const pillVisible =
      gameState.phase !== GamePhase.PLAYER_TURN &&
      gameState.phase !== GamePhase.ENEMY_TURN;
    if (inCombat && pillVisible) return "top-[8.75rem] sm:top-[9.25rem]";
    if (inCombat || pillVisible) return "top-[3.75rem] sm:top-[4.25rem]";
    return "top-3 sm:top-4";
  });

  return (
    <div
      class={`absolute left-1/2 -translate-x-1/2 z-20 pointer-events-none max-w-[calc(100vw-2rem)] transition-all duration-200 ${topClass()}`}
    >
      <UnitInfoCard />
    </div>
  );
};
