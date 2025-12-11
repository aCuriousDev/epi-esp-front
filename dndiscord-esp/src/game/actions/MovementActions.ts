/**
 * Movement Actions
 * 
 * Handles unit selection, movement, and path preview
 */

import { batch } from 'solid-js';
import { produce } from 'solid-js/store';
import { GridPosition, GamePhase, TurnPhase } from '../../types';
import { gameState, setGameState, addCombatLog, getIsFreeRoamMode } from '../stores/GameStateStore';
import { units, setUnits } from '../stores/UnitsStore';
import { tiles, setTiles, pathfinder, updatePathfinder } from '../stores/TilesStore';
import { posToKey } from '../utils/GridUtils';

// ============================================
// UNIT SELECTION
// ============================================

export function selectUnit(unitId: string): void {
  const unit = units[unitId];
  if (!unit || !unit.isAlive) return;
  
  const isFreeRoam = getIsFreeRoamMode();
  const currentUnitId = gameState.turnOrder[gameState.currentUnitIndex];
  const isCurrentUnit = unitId === currentUnitId;
  const isPlayerTurn = gameState.phase === GamePhase.PLAYER_TURN || isFreeRoam;
  
  console.log('[selectUnit]', unit.name, '| mode:', isFreeRoam ? 'Free Roam' : 'Combat', '| currentUnit:', units[currentUnitId]?.name, '| isCurrentUnit:', isCurrentUnit, '| isPlayerTurn:', isPlayerTurn);
  
  // Allow selecting any unit to view stats
  // But only show movement/action options for the current unit (or any player unit in Free Roam)
  batch(() => {
    setGameState({
      selectedUnit: unitId,
      selectedAbility: null,
      turnPhase: (isCurrentUnit && isPlayerTurn) || isFreeRoam ? TurnPhase.MOVE : TurnPhase.SELECT_UNIT,
    });
    
    // Show movement range in Free Roam for any player unit, or in Combat for current unit
    const shouldShowMovement = isFreeRoam ? true : (isCurrentUnit && isPlayerTurn && unit.stats.currentActionPoints >= 1);
    
    if (shouldShowMovement && pathfinder) {
      // In Free Roam, use full movement range; in Combat, limit by AP
      const effectiveRange = isFreeRoam 
        ? unit.stats.movementRange 
        : Math.min(unit.stats.movementRange, unit.stats.currentActionPoints);
      
      const reachable = pathfinder.getReachableTiles(
        unit.position,
        effectiveRange
      );
      const highlighted = Array.from(reachable.values()).map((r) => r.position);
      setGameState('highlightedTiles', highlighted);
    } else {
      setGameState('highlightedTiles', []);
    }
    
    setGameState('pathPreview', []);
    setGameState('targetableTiles', []);
  });
}

// ============================================
// PATH PREVIEW
// ============================================

export function previewPath(targetPos: GridPosition): void {
  const unit = gameState.selectedUnit ? units[gameState.selectedUnit] : null;
  if (!unit || !pathfinder) return;
  
  // Limit path by remaining AP
  const maxCost = Math.min(unit.stats.movementRange, unit.stats.currentActionPoints);
  const path = pathfinder.findPath(
    unit.position,
    targetPos,
    maxCost
  );
  
  setGameState('pathPreview', path || []);
}

// ============================================
// UNIT MOVEMENT
// ============================================

export function moveUnit(targetPos: GridPosition): boolean {
  const unit = gameState.selectedUnit ? units[gameState.selectedUnit] : null;
  if (!unit || !pathfinder) return false;
  
  const isFreeRoam = getIsFreeRoamMode();
  
  // In Combat mode, only allow movement if it's the current unit's turn
  if (!isFreeRoam) {
    const currentUnitId = gameState.turnOrder[gameState.currentUnitIndex];
    if (unit.id !== currentUnitId) {
      return false;
    }
  }
  
  // Limit path by remaining AP (or full range in Free Roam)
  const maxCost = isFreeRoam 
    ? unit.stats.movementRange 
    : Math.min(unit.stats.movementRange, unit.stats.currentActionPoints);
  
  const path = pathfinder.findPath(
    unit.position,
    targetPos,
    maxCost
  );
  
  if (!path || path.length === 0) return false;
  
  // Calculate movement cost
  const movementCost = path.length - 1; // Don't count starting position
  
  // Check if unit has enough AP for this move (skip in Free Roam)
  if (!isFreeRoam && unit.stats.currentActionPoints < movementCost) return false;
  
  batch(() => {
    // Clear old tile
    setTiles(posToKey(unit.position), 'occupiedBy', null);
    
    // Update unit position and deduct AP (skip AP deduction in Free Roam)
    setUnits(unit.id, produce((u) => {
      u.position = targetPos;
      if (!isFreeRoam) {
        u.stats.currentActionPoints -= movementCost;
      }
    }));
    
    // Set new tile as occupied
    setTiles(posToKey(targetPos), 'occupiedBy', unit.id);
    
    // Clear path preview
    setGameState('pathPreview', []);
    
    // Recalculate movement range
    const updatedUnit = units[unit.id];
    if (pathfinder) {
      // In Free Roam, always show full range; in Combat, check remaining AP
      const canStillMove = isFreeRoam || updatedUnit.stats.currentActionPoints >= 1;
      
      if (canStillMove) {
        const effectiveRange = isFreeRoam 
          ? updatedUnit.stats.movementRange 
          : Math.min(updatedUnit.stats.movementRange, updatedUnit.stats.currentActionPoints);
        
        const reachable = pathfinder.getReachableTiles(
          targetPos,
          effectiveRange
        );
        const highlighted = Array.from(reachable.values()).map((r) => r.position);
        setGameState('highlightedTiles', highlighted);
      } else {
        setGameState('highlightedTiles', []);
      }
    }
    
    // Only log in Combat mode
    if (!isFreeRoam) {
      addCombatLog(`${unit.name} moves to (${targetPos.x}, ${targetPos.z})`, 'move');
    }
  });
  
  // Update pathfinder with new tile state
  updatePathfinder();
  
  return true;
}

