/**
 * Units Store
 * 
 * Manages all unit state and provides helper queries
 */

import { createStore, produce } from 'solid-js/store';
import { Unit, Team } from '../../types';
import { gameState } from './GameStateStore';
import { clearOccupancyByUnitIds } from './TilesStore';

// ============================================
// UNITS STORE
// ============================================

export const [units, setUnits] = createStore<Record<string, Unit>>({});

// ============================================
// UNIT QUERIES
// ============================================

export function getCurrentUnit(): Unit | null {
  const unitId = gameState.turnOrder[gameState.currentUnitIndex];
  return unitId ? units[unitId] : null;
}

export function getSelectedUnit(): Unit | null {
  return gameState.selectedUnit ? units[gameState.selectedUnit] : null;
}

export function getPlayerUnits(): Unit[] {
  return Object.values(units).filter(u => u.team === Team.PLAYER && u.isAlive);
}

export function getEnemyUnits(): Unit[] {
  return Object.values(units).filter(u => u.team === Team.ENEMY && u.isAlive);
}

// ============================================
// UNIT MANAGEMENT
// ============================================

export function clearUnits(): void {
  // SolidJS createStore's top-level setter merges objects — passing `{}`
  // is a no-op because there are no keys to write. Need produce + explicit
  // deletes to actually empty the record. Previously every "clear" left the
  // prior session's units alive in the store and surfaced as ghost
  // enemies carrying over on rejoin / new session.
  setUnits(
    produce((draft) => {
      for (const id of Object.keys(draft)) {
        delete (draft as any)[id];
      }
    }),
  );
}

/**
 * Add a single unit to the store (used by DM spawn, etc.).
 */
export function addUnit(unit: Unit): void {
  setUnits(
    produce((draft) => {
      (draft as any)[unit.id] = unit;
    }),
  );
}

/**
 * Remove all units owned by a given user (used when a player leaves a multiplayer session).
 * Also clears tile occupancy for the removed units.
 */
export function removeUnitsByOwnerUserId(ownerUserId: string): void {
  const target = String(ownerUserId ?? "").toLowerCase();
  if (!target) return;

  const toRemove: string[] = [];
  for (const u of Object.values(units)) {
    const owner = String(u.ownerUserId ?? "").toLowerCase();
    if (owner && owner === target) {
      toRemove.push(u.id);
    }
  }
  if (toRemove.length === 0) return;

  clearOccupancyByUnitIds(toRemove);
  setUnits(
    produce((draft) => {
      for (const id of toRemove) {
        delete (draft as any)[id];
      }
    }),
  );
}

