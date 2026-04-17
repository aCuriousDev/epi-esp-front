/**
 * Store for DM tools state (hidden rolls log, granted items, etc.)
 */

import { createStore, produce } from "solid-js/store";
import type { DmHiddenRollPayload, ItemGrantedPayload } from "../types/multiplayer";

export interface DmToolsState {
  /** Hidden roll results (only visible to DM). */
  hiddenRolls: DmHiddenRollPayload[];
  /** Items granted during the session (visible to all). */
  grantedItems: ItemGrantedPayload[];
}

const [state, setState] = createStore<DmToolsState>({
  hiddenRolls: [],
  grantedItems: [],
});

export { state as dmToolsState };

/** Add a hidden roll result (DM only). */
export function addHiddenRoll(roll: DmHiddenRollPayload): void {
  setState("hiddenRolls", (prev) => [...prev, roll]);
}

/** Add a granted item (broadcast to all). */
export function addGrantedItem(item: ItemGrantedPayload): void {
  setState("grantedItems", (prev) => [...prev, item]);
}

/** Clear all DM tools state (on session leave/end). */
export function clearDmToolsState(): void {
  setState({ hiddenRolls: [], grantedItems: [] });
}
