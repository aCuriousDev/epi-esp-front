/**
 * session-map.store.ts
 *
 * Stores the MapNode configuration that is active for the current campaign session.
 * Written by CampaignSessionPage when the player launches a map from the scenario tree,
 * consumed by BoardGame + InitGrid + InitFreeRoam.
 *
 * The config itself is intentionally NOT a SolidJS reactive store — it's a plain module
 * singleton that acts as a one-shot handshake between two route-level components.
 * The `pendingSessionExit` signal IS reactive so BoardGame can display the DM banner.
 */
import { createRoot, createSignal } from 'solid-js';

export interface CellCoord { x: number; z: number; }

export interface ExitCell extends CellCoord {
  /** Index de cette sortie (0-based) — détermine le port draw2d à suivre. */
  exitIndex?: number;
}

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
  /** Cells that trigger progression to the next node or end the scenario */
  exitCells?: ExitCell[];
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

let _onExit: ((portName: string) => void) | null = null;

/** BoardGame calls this to register where to go when an EXIT tile is stepped on. */
export function setSessionExitCallback(cb: (portName: string) => void): void {
  _onExit = cb;
}

export function clearSessionExitCallback(): void {
  _onExit = null;
}

/** Called by BoardGame when the DM confirms the exit. */
export function triggerSessionExit(portName = 'exit-0'): void {
  _onExit?.(portName);
}

// ─── Pending exit request (reactive) ─────────────────────────────────────────
// When a player steps on an EXIT tile, movement sets this signal instead of
// triggering the exit immediately. BoardGame reacts: the DM sees a confirmation
// banner; regular players see a "waiting for DM" toast.

export interface PendingExitRequest {
  unitName: string;
  /** Nom du port draw2d à suivre dans l'arbre de campagne (ex: 'exit-0', 'exit-1'). */
  portName: string;
}

const [_pendingExit, _setPendingExit] =
  createRoot(() => createSignal<PendingExitRequest | null>(null));

/** Reactive signal — read in BoardGame to show DM banner / player toast. */
export const pendingSessionExit = _pendingExit;

/** Called by MovementActions when a player reaches an EXIT tile. */
export function requestSessionExit(req: PendingExitRequest): void {
  _setPendingExit(req);
}

/** Called by BoardGame when the DM confirms (or when leaving the board). */
export function clearPendingSessionExit(): void {
  _setPendingExit(null);
}
