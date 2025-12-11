/**
 * Units Store
 * 
 * Manages all unit state and provides helper queries
 */

import { createStore } from 'solid-js/store';
import { Unit, Team } from '../../types';
import { gameState } from './GameStateStore';

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
  setUnits({});
}

