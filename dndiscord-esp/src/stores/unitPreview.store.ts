import { createSignal } from "solid-js";

/**
 * Unit ID surfaced into the floating UnitInfoCard from places other than the
 * canvas selection (e.g. hovering / clicking a turn-order tile). Hover state
 * is transient (cleared on mouse-leave); pinned state persists until the
 * user pins another unit or clicks the same tile again.
 *
 * Resolution order in UnitInfoCard: hovered → pinned → gameState.selectedUnit.
 */
const [hoveredUnitId, setHoveredUnitId] = createSignal<string | null>(null);
const [pinnedUnitId, setPinnedUnitId] = createSignal<string | null>(null);

export { hoveredUnitId, setHoveredUnitId, pinnedUnitId, setPinnedUnitId };

export const previewedUnitId = (): string | null =>
  hoveredUnitId() ?? pinnedUnitId();

export function togglePinnedUnit(unitId: string): void {
  setPinnedUnitId((prev) => (prev === unitId ? null : unitId));
}

export function clearUnitPreview(): void {
  setHoveredUnitId(null);
  setPinnedUnitId(null);
}
