/**
 * Store for DM tools state (hidden rolls log, granted items, active modes, etc.)
 */

import { createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import type {
  DmHiddenRollPayload,
  ItemGrantedPayload,
  CharacterProgressedPayload,
  GoldGrantedPayload,
} from "../types/multiplayer";

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
  /** Character progression events (XP / level-up) from DM actions. */
  characterProgressions: CharacterProgressedPayload[];
  /** Gold grants/removals from DM actions. */
  goldGranted: GoldGrantedPayload[];
  /** Recently spawned enemies (for toast notifications). */
  spawnedEnemies: SpawnedEnemyEntry[];
  /** DM's choice of whether the enemy AI auto-plays on its turn. When false,
   * the DM controls enemies manually via the EnemyHotbar. In solo mode this
   * toggle is ignored — the AI always runs. */
  aiAutoPlay: boolean;
}

const [state, setState] = createStore<DmToolsState>({
  hiddenRolls: [],
  grantedItems: [],
  characterProgressions: [],
  goldGranted: [],
  spawnedEnemies: [],
  aiAutoPlay: true,
});

/** Toggle whether enemy AI auto-plays. DM-facing control. */
export function setAiAutoPlay(next: boolean): void {
  setState("aiAutoPlay", next);
}

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

/** Unit ID (player) the DM is currently inspecting. null = closed */
const [dmInspectedUnit, setDmInspectedUnit] = createSignal<string | null>(null);
export { dmInspectedUnit, setDmInspectedUnit };

/** Add a hidden roll result (DM only). */
export function addHiddenRoll(roll: DmHiddenRollPayload): void {
  setState("hiddenRolls", (prev) => [...prev, roll]);
}

/** Add a granted item (broadcast to all). */
export function addGrantedItem(item: ItemGrantedPayload): void {
  setState("grantedItems", (prev) => [...prev, item]);
}

export function addCharacterProgressed(evt: CharacterProgressedPayload): void {
  setState("characterProgressions", (prev) => [...prev, evt]);
}

export function addGoldGranted(evt: GoldGrantedPayload): void {
  setState("goldGranted", (prev) => [...prev, evt]);
}

/** Record a spawned enemy (for toast notifications). */
export function addSpawnedEnemy(entry: SpawnedEnemyEntry): void {
  setState("spawnedEnemies", (prev) => [...prev, entry]);
}

/** Clear all DM tools state (on session leave/end). */
export function clearDmToolsState(): void {
  setState({
    hiddenRolls: [],
    grantedItems: [],
    characterProgressions: [],
    goldGranted: [],
    spawnedEnemies: [],
    aiAutoPlay: true,
  });
  setDmActiveMode(null);
  setDmDragUnit(null);
  setDmSpawnTemplate(null);
  setDmInspectedUnit(null);
}
