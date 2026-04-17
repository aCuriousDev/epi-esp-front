/**
 * Store for DM tools state (hidden rolls log, granted items, active modes, etc.)
 */

import { createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import type { DmHiddenRollPayload, ItemGrantedPayload } from "../types/multiplayer";

export interface SpawnedEnemyEntry {
  name: string;
  x: number;
  z: number;
}

export interface DmToolsState {
  /** Hidden roll results (only visible to DM). */
  hiddenRolls: DmHiddenRollPayload[];
  /** Items granted during the session (visible to all). */
  grantedItems: ItemGrantedPayload[];
  /** Recently spawned enemies (for toast notifications). */
  spawnedEnemies: SpawnedEnemyEntry[];
}

const [state, setState] = createStore<DmToolsState>({
  hiddenRolls: [],
  grantedItems: [],
  spawnedEnemies: [],
});

export { state as dmToolsState };

// --- DM interactive mode signals ---

/** Which DM tool tab is active: "move" | "spawn" | null */
const [dmActiveMode, setDmActiveMode] = createSignal<"move" | "spawn" | null>(null);
export { dmActiveMode, setDmActiveMode };

/** Unit ID selected by DM for drag-move (click-to-place). null = inactive */
const [dmDragUnit, setDmDragUnit] = createSignal<string | null>(null);
export { dmDragUnit, setDmDragUnit };

/** DM spawn mode: template ID being placed. null = inactive */
const [dmSpawnTemplate, setDmSpawnTemplate] = createSignal<string | null>(null);
export { dmSpawnTemplate, setDmSpawnTemplate };

/** Add a hidden roll result (DM only). */
export function addHiddenRoll(roll: DmHiddenRollPayload): void {
  setState("hiddenRolls", (prev) => [...prev, roll]);
}

/** Add a granted item (broadcast to all). */
export function addGrantedItem(item: ItemGrantedPayload): void {
  setState("grantedItems", (prev) => [...prev, item]);
}

/** Record a spawned enemy (for toast notifications). */
export function addSpawnedEnemy(entry: SpawnedEnemyEntry): void {
  setState("spawnedEnemies", (prev) => [...prev, entry]);
}

/** Clear all DM tools state (on session leave/end). */
export function clearDmToolsState(): void {
  setState({ hiddenRolls: [], grantedItems: [], spawnedEnemies: [] });
  setDmActiveMode(null);
  setDmDragUnit(null);
  setDmSpawnTemplate(null);
}
