/**
 * session-map.store.ts
 *
 * Stores the MapNode configuration that is active for the current campaign session.
 * Written by CampaignSessionPage when the player launches a map from the scenario tree,
 * consumed by BoardGame + InitGrid + InitFreeRoam.
 *
 * Intentionally NOT a SolidJS reactive store — it's a plain module singleton that
 * acts as a one-shot handshake between two route-level components.
 */

export interface CellCoord { x: number; z: number; }

export interface SessionMapConfig {
  /** Campaign being played */
  campaignId: string;
  /** Backend session ID (may be null if offline) */
  sessionId: string | null;
  /** ID of the MapNode in the tree */
  nodeId: string;
  /** Map to load (key in localStorage) */
  mapId: string;
  /** Where players appear on this map */
  spawnPoint?: CellCoord;
  /** Cells that trigger progression to the next node */
  exitCells?: CellCoord[];
  /** Cells that apply trap damage/effects */
  trapCells?: CellCoord[];
}

let _config: SessionMapConfig | null = null;

export function setSessionMapConfig(config: SessionMapConfig): void {
  _config = config;
}

export function getSessionMapConfig(): SessionMapConfig | null {
  return _config;
}

export function clearSessionMapConfig(): void {
  _config = null;
}

/** Convenience — true when a session-launched map is in progress. */
export function isSessionMapActive(): boolean {
  return _config !== null;
}

// ─── Exit callback ────────────────────────────────────────────────────────────
// Registered by BoardGame so the game engine can navigate back to the session
// without importing the router (keeps the game layer framework-agnostic).

let _onExit: (() => void) | null = null;

/** BoardGame calls this to register where to go when an EXIT tile is stepped on. */
export function setSessionExitCallback(cb: () => void): void {
  _onExit = cb;
}

export function clearSessionExitCallback(): void {
  _onExit = null;
}

/** Called by MovementActions when a player steps on a TileType.EXIT cell. */
export function triggerSessionExit(): void {
  _onExit?.();
}
