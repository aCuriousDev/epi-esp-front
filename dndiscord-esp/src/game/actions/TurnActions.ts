/**
 * Turn Actions
 * 
 * Manages game start, turn progression, and phase transitions
 */

import { batch } from 'solid-js';
import { produce } from 'solid-js/store';
import { GamePhase, TurnPhase, GameMode } from '../../types';
import { gameState, setGameState, addCombatLog } from '../stores/GameStateStore';
import { units, setUnits, getCurrentUnit } from '../stores/UnitsStore';
import { tiles } from '../stores/TilesStore';
import { initializeGrid } from '../initialization/InitGrid';
import { initializeUnits } from '../initialization/InitUnits';
import { initializeFreeRoam } from '../initialization/InitFreeRoam';
import * as TurnManager from '../TurnManager';
import { checkGameOver } from './CombatActions';
import { playTurnStartEffect } from '../vfx/VFXIntegration';
import { playTurnStartSound, playNewRoundSound, playAmbientMusic } from '../audio/SoundIntegration';

// ============================================
// GAME START
// ============================================

export function startGame(mode: GameMode = GameMode.COMBAT): void {
  console.log('[startGame] ===== STARTING GAME =====');
  console.log('[startGame] Mode:', mode);
  console.log('[startGame] Current units count:', Object.keys(units).length);
  console.log('[startGame] Current tiles count:', Object.keys(tiles).length);
  
  if (mode === GameMode.FREE_ROAM) {
    console.log('[startGame] Initializing FREE ROAM mode...');
    initializeFreeRoam();
  } else {
    console.log('[startGame] Initializing COMBAT mode...');
    initializeCombat();
  }
  
  console.log('[startGame] After init - Units:', Object.keys(units).length, 'Tiles:', Object.keys(tiles).length);
  console.log('[startGame] ===== GAME START COMPLETE =====');
}

// ============================================
// COMBAT INITIALIZATION
// ============================================

function initializeCombat(): void {
  console.log('[initializeCombat] Initializing grid...');
  initializeGrid();
  console.log('[initializeCombat] Grid initialized, tiles:', Object.keys(tiles).length);
  
  console.log('[initializeCombat] Initializing units...');
  initializeUnits();
  console.log('[initializeCombat] Units initialized, count:', Object.keys(units).length);
  
  // Calculate turn order using TurnManager
  const turnOrder = TurnManager.calculateTurnOrder(units);
  
  console.log('[initializeCombat] Initial turn order:', TurnManager.debugTurnOrder(turnOrder, units));
  
  batch(() => {
    setGameState({
      mode: GameMode.COMBAT,
      phase: GamePhase.PLAYER_TURN,
      turnPhase: TurnPhase.SELECT_UNIT,
      currentTurn: 1,
      turnOrder,
      currentUnitIndex: 0,
      selectedUnit: null,
      selectedAbility: null,
      highlightedTiles: [],
      pathPreview: [],
      targetableTiles: [],
    });
    
    addCombatLog('Battle begins!', 'system');
  });

  // Start combat ambient music
  playAmbientMusic('combat');
  
  console.log('[initializeCombat] Combat initialization complete');
}

// ============================================
// TURN PROGRESSION
// ============================================

export function nextTurn(): void {
  console.log('=== nextTurn START ===');
  console.log('[nextTurn] Current index:', gameState.currentUnitIndex);
  console.log('[nextTurn] Current turn order:', TurnManager.debugTurnOrder(gameState.turnOrder, units));
  
  const currentUnitBefore = getCurrentUnit();
  console.log('[nextTurn] Current unit before advance:', currentUnitBefore?.name);
  
  // Reset all units for new round if needed
  let nextIndex = gameState.currentUnitIndex + 1;
  console.log('[nextTurn] Next index (before skip):', nextIndex);
  
  // Skip dead units
  while (nextIndex < gameState.turnOrder.length) {
    const unit = units[gameState.turnOrder[nextIndex]];
    console.log('[nextTurn] Checking index', nextIndex, ':', unit?.name, 'alive:', unit?.isAlive);
    if (unit && unit.isAlive) break;
    nextIndex++;
  }
  
  console.log('[nextTurn] Next index (after skip):', nextIndex, '/', gameState.turnOrder.length);
  
  if (nextIndex >= gameState.turnOrder.length) {
    // Start new round - delegate to TurnManager
    const newRoundData = TurnManager.prepareNewRound(units, gameState.currentTurn);
    
    console.log('[nextTurn] Starting new round');
    console.log('[nextTurn] Old turn order:', TurnManager.debugTurnOrder(gameState.turnOrder, units));
    console.log('[nextTurn] New turn order:', TurnManager.debugTurnOrder(newRoundData.turnOrder, units));
    
    batch(() => {
      // Reset all units using TurnManager
      Object.keys(units).forEach((unitId) => {
        setUnits(unitId, produce((u) => {
          TurnManager.resetUnitForNewRound(u);
        }));
      });
      
      // Apply new state from TurnManager
      setGameState(newRoundData.stateUpdates);
    });
    
    // Log AFTER state is set (using the already-incremented value)
    addCombatLog(`Round ${gameState.currentTurn} begins!`, 'system');
    playNewRoundSound();
    
    // Validate turn order
    const validation = TurnManager.validateTurnOrder(gameState.turnOrder, units);
    if (!validation.valid) {
      console.error('[nextTurn] Turn order validation failed:', validation.issues);
    }
  } else {
    // Normal turn advance
    const nextUnit = units[gameState.turnOrder[nextIndex]];
    console.log('[nextTurn] Normal turn advance to:', nextUnit?.name, 'at index', nextIndex);
    
    setGameState({
      currentUnitIndex: nextIndex,
      selectedUnit: null,
      selectedAbility: null,
      highlightedTiles: [],
      pathPreview: [],
      targetableTiles: [],
    });
  }
  
  // Determine phase AFTER state is committed
  updateGamePhase();
  
  // Play turn start VFX + sound for the new active unit
  const currentUnitAfter = getCurrentUnit();
  if (currentUnitAfter && currentUnitAfter.isAlive) {
    playTurnStartEffect(currentUnitAfter.position, currentUnitAfter.team as string);
    playTurnStartSound();
  }
  
  console.log('[nextTurn] Current unit after advance:', currentUnitAfter?.name, 'team:', currentUnitAfter?.team);
  console.log('[nextTurn] Game phase:', gameState.phase);
  console.log('=== nextTurn END ===\n');
  
  // Check for game over
  checkGameOver();
}

/**
 * Update game phase based on current unit
 * Separated from nextTurn for clarity
 */
function updateGamePhase(): void {
  const currentUnit = getCurrentUnit();
  const newPhase = TurnManager.determinePhase(currentUnit);
  
  setGameState('phase', newPhase);
  
  if (newPhase === GamePhase.PLAYER_TURN) {
    setGameState('turnPhase', TurnPhase.SELECT_UNIT);
  }
}

// ============================================
// END TURN
// ============================================

export function endUnitTurn(): void {
  const unit = gameState.selectedUnit ? units[gameState.selectedUnit] : null;
  
  console.log('[endUnitTurn] Called for unit:', unit?.name, 'Current index:', gameState.currentUnitIndex);
  
  // If no unit is selected, still proceed to next turn (handles edge cases)
  if (!unit) {
    console.log('[endUnitTurn] No unit selected, advancing turn anyway');
    nextTurn();
    return;
  }
  
  batch(() => {
    setUnits(unit.id, produce((u) => {
      u.hasActed = true;
    }));
    
    setGameState({
      selectedUnit: null,
      selectedAbility: null,
      highlightedTiles: [],
      pathPreview: [],
      targetableTiles: [],
      turnPhase: TurnPhase.END_TURN,
    });
    
    addCombatLog(`${unit.name} ends their turn.`, 'system');
  });
  
  nextTurn();
}

