import { Unit, GamePhase, TurnPhase } from '../types';

/**
 * TurnManager
 * 
 * Centralized module for managing turn order, round transitions, and turn progression.
 * Separated from GameStore to improve code organization and maintainability.
 */

/**
 * Calculate turn order based on unit initiative (highest first)
 * Only includes alive units
 */
export function calculateTurnOrder(units: Record<string, Unit>): string[] {
  const unitList = Object.values(units).filter((u) => u.isAlive);
  const sortedUnits = unitList.sort((a, b) => b.stats.initiative - a.stats.initiative);
  return sortedUnits.map((u) => u.id);
}

/**
 * Reset a unit's stats for a new round
 * Returns the unit with updated properties (for use with Solid's produce)
 */
export function resetUnitForNewRound(unit: Unit): void {
  unit.hasActed = false;
  unit.hasMoved = false;
  unit.stats.currentActionPoints = unit.stats.maxActionPoints;
  
  // Reduce cooldowns
  unit.abilities.forEach((ability) => {
    if (ability.currentCooldown > 0) {
      ability.currentCooldown--;
    }
  });
}

/**
 * Prepare data for starting a new round
 * Returns the new state and turn order without mutating anything
 */
export interface NewRoundData {
  turnOrder: string[];
  roundNumber: number;
  stateUpdates: {
    currentTurn: number;
    currentUnitIndex: number;
    turnOrder: string[];
    selectedUnit: null;
    selectedAbility: null;
    highlightedTiles: [];
    pathPreview: [];
    targetableTiles: [];
  };
}

export function prepareNewRound(
  units: Record<string, Unit>,
  currentRound: number
): NewRoundData {
  // Recalculate turn order based on initiative
  const newTurnOrder = calculateTurnOrder(units);
  const newRoundNumber = currentRound + 1;
  
  return {
    turnOrder: newTurnOrder,
    roundNumber: newRoundNumber,
    stateUpdates: {
      currentTurn: newRoundNumber,
      currentUnitIndex: 0,
      turnOrder: newTurnOrder,
      selectedUnit: null,
      selectedAbility: null,
      highlightedTiles: [],
      pathPreview: [],
      targetableTiles: [],
    },
  };
}

/**
 * Determine the game phase based on the current unit's team
 */
export function determinePhase(currentUnit: Unit | null): GamePhase {
  if (!currentUnit) {
    return GamePhase.PLAYER_TURN; // Default to player turn if no unit
  }
  
  return currentUnit.team === 'enemy' ? GamePhase.ENEMY_TURN : GamePhase.PLAYER_TURN;
}

/**
 * Validate turn order to ensure consistency
 */
export function validateTurnOrder(
  turnOrder: string[],
  units: Record<string, Unit>
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // Check if turn order is empty
  if (turnOrder.length === 0) {
    issues.push('Turn order is empty');
  }
  
  // Check if all units in turn order exist and are alive
  turnOrder.forEach((unitId, index) => {
    const unit = units[unitId];
    if (!unit) {
      issues.push(`Unit ${unitId} at index ${index} does not exist`);
    } else if (!unit.isAlive) {
      issues.push(`Unit ${unitId} (${unit.name}) at index ${index} is dead but still in turn order`);
    }
  });
  
  // Check if initiative order is correct (descending)
  for (let i = 0; i < turnOrder.length - 1; i++) {
    const currentUnit = units[turnOrder[i]];
    const nextUnit = units[turnOrder[i + 1]];
    
    if (currentUnit && nextUnit && currentUnit.stats.initiative < nextUnit.stats.initiative) {
      issues.push(
        `Initiative order violation: ${currentUnit.name} (${currentUnit.stats.initiative}) ` +
        `comes before ${nextUnit.name} (${nextUnit.stats.initiative})`
      );
    }
  }
  
  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Get a debug string representation of the turn order
 */
export function debugTurnOrder(turnOrder: string[], units: Record<string, Unit>): string {
  return turnOrder
    .map((id, idx) => {
      const unit = units[id];
      if (!unit) return `${idx}: ${id} (NOT FOUND)`;
      return `${idx}: ${unit.name} (Init: ${unit.stats.initiative}, Team: ${unit.team})`;
    })
    .join(' -> ');
}

