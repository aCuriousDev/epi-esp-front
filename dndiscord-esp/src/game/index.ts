/**
 * Game Module - Main Barrel Export
 * 
 * Central export point for all game functionality.
 * Components should import from this file instead of individual modules.
 */

// ============================================
// TYPES
// ============================================

export { GameMode } from '../types';

// ============================================
// CONSTANTS
// ============================================

export { GRID_SIZE, TILE_SIZE } from './constants';

// ============================================
// UTILITIES
// ============================================

export { posToKey, keyToPos, gridToWorld } from './utils/GridUtils';

// ============================================
// STORES
// ============================================

export { 
  gameState, 
  setGameState,
  addCombatLog,
  getIsPlayerTurn,
  getIsGameOver,
  getCurrentMode,
  getIsFreeRoamMode,
  getIsCombatMode,
  getIsDungeonMode,
  getDungeonState,
  resetGameState,
} from './stores/GameStateStore';

export {
  units,
  setUnits,
  getCurrentUnit,
  getSelectedUnit,
  getPlayerUnits,
  getEnemyUnits,
  clearUnits,
} from './stores/UnitsStore';

export {
  tiles,
  setTiles,
  pathfinder,
  updatePathfinder,
  clearTiles,
} from './stores/TilesStore';

// ============================================
// ACTIONS
// ============================================

export {
  selectUnit,
  previewPath,
  moveUnit,
} from './actions/MovementActions';

export {
  selectAbility,
  useAbility,
  calculateDamage,
  checkGameOver,
} from './actions/CombatActions';

export {
  startGame,
  startCombatFromPreparation,
  nextTurn,
  endUnitTurn,
  transitionToNextRoom,
} from './actions/TurnActions';

// ============================================
// AI
// ============================================

export { executeEnemyTurn } from './ai/EnemyAI';

// ============================================
// INITIALIZATION
// ============================================

export { initializeGrid } from './initialization/InitGrid';
export { initializeUnits, getAllySpawnPositions } from './initialization/InitUnits';
export { initializeFreeRoam } from './initialization/InitFreeRoam';

// ============================================
// TURN MANAGEMENT
// ============================================

export * as TurnManager from './TurnManager';

// ============================================
// AUDIO
// ============================================

export { setSoundEngine, stopAmbientMusic } from './audio/SoundIntegration';

