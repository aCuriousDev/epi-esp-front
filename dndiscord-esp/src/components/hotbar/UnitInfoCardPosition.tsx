import { Component } from "solid-js";
import { UnitInfoCard } from "./UnitInfoCard";

/**
 * Positions the UnitInfoCard at the top-right corner of the canvas so it
 * doesn't collide with the always-visible turn-order banner at top-center
 * or the "Infos" / "Journal" drawer toggles at top-left/right. The card
 * auto-hides when nothing is selected so this slot only draws attention
 * when the viewer actually has a unit in focus.
 */
export const UnitInfoCardTop: Component = () => {
  return (
    <div class="fixed top-16 right-4 z-20 pointer-events-none max-w-[calc(100vw-2rem)]">
      <UnitInfoCard />
    </div>
  );
};
