import { Component } from "solid-js";
import { UnitInfoCard } from "./UnitInfoCard";

/**
 * Positions the UnitInfoCard at the top-center of the canvas. Kept separate
 * from the card itself so the same card can be reused in different slots
 * (e.g. a DM-side dock) without duplicating CSS.
 */
export const UnitInfoCardTop: Component = () => {
  return (
    <div class="fixed top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
      <UnitInfoCard />
    </div>
  );
};
