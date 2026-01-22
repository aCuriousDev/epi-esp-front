/**
 * Game State Store
 * 
 * Manages the main game state including phase, turn, and combat log
 */

import { createStore } from 'solid-js/store';
import { GameState, GamePhase, TurnPhase, CombatLogEntry, GameMode } from '../../types';

// ============================================
// DEFAULT STATE FACTORY
// ============================================

function createDefaultGameState(): GameState {
  return {
    mode: GameMode.COMBAT,
    phase: GamePhase.SETUP,
    turnPhase: TurnPhase.SELECT_UNIT,
    currentTurn: 0,
    turnOrder: [],
    currentUnitIndex: 0,
    selectedUnit: null,
    selectedAbility: null,
    highlightedTiles: [],
    pathPreview: [],
    targetableTiles: [],
    combatLog: [],
    mapId: null,
  };
}

// ============================================
// GAME STATE STORE
// ============================================

export const [gameState, setGameState] = createStore<GameState>(createDefaultGameState());

// ============================================
// COMBAT LOG HELPERS
// ============================================

export function addCombatLog(message: string, type: CombatLogEntry['type']): void {
  const newEntry: CombatLogEntry = {
    id: `${Date.now()}-${Math.random()}`,
    turn: gameState.currentTurn,
    timestamp: Date.now(),
    message,
    type,
  };
  
  setGameState('combatLog', (logs) => [...logs, newEntry]);
}

// ============================================
// GAME STATE QUERIES
// ============================================

export function getIsPlayerTurn(): boolean {
  return gameState.phase === GamePhase.PLAYER_TURN;
}

export function getIsGameOver(): boolean {
  return gameState.phase === GamePhase.GAME_OVER;
}

export function getCurrentMode(): GameMode {
  return gameState.mode;
}

export function getIsFreeRoamMode(): boolean {
  return gameState.mode === GameMode.FREE_ROAM;
}

export function getIsCombatMode(): boolean {
  return gameState.mode === GameMode.COMBAT;
}

// ============================================
// GAME STATE MANAGEMENT
// ============================================

export function resetGameState(): void {
  const defaultState = createDefaultGameState();
  setGameState(defaultState);
}

