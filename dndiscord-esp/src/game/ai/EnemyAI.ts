/**
 * Enemy AI
 * 
 * Contains the AI logic for enemy unit behavior
 */

import { Team } from '../../types';
import { addCombatLog } from '../stores/GameStateStore';
import { units, getCurrentUnit } from '../stores/UnitsStore';
import { pathfinder } from '../stores/TilesStore';
import { selectUnit, moveUnit, previewPath } from '../actions/MovementActions';
import { selectAbility, useAbility } from '../actions/CombatActions';
import { endUnitTurn } from '../actions/TurnActions';

// ============================================
// ENEMY TURN EXECUTION
// ============================================

export async function executeEnemyTurn(): Promise<void> {
  const currentUnit = getCurrentUnit();

  // Every exit goes through endUnitTurn — in multiplayer it routes through
  // the hub's EndTurn command so peers see the advance. `nextTurn()` was the
  // legacy local-only path and would desync if the AI hit an early exit on
  // the DM's client in session.
  if (!currentUnit || currentUnit.team !== Team.ENEMY) {
    endUnitTurn();
    return;
  }

  addCombatLog(`${currentUnit.name}'s turn!`, 'system');

  const playerUnits = Object.values(units).filter(
    (u) => u.team === Team.PLAYER && u.isAlive
  );

  if (playerUnits.length === 0) {
    endUnitTurn();
    return;
  }
  
  // Find nearest player unit
  let nearestPlayer = playerUnits[0];
  let nearestDistance = Infinity;
  
  for (const player of playerUnits) {
    const dist = Math.abs(player.position.x - currentUnit.position.x) + 
                 Math.abs(player.position.z - currentUnit.position.z);
    if (dist < nearestDistance) {
      nearestDistance = dist;
      nearestPlayer = player;
    }
  }
  
  if (!nearestPlayer || !pathfinder) {
    endUnitTurn();
    return;
  }

  // Select this unit (local UI only — selectedUnit is per-client)
  selectUnit(currentUnit.id);
  await delay(500);
  
  // Try to move towards player if we have AP
  if (currentUnit.stats.currentActionPoints >= 1) {
    // Limit enemy movement by remaining AP
    const effectiveRange = Math.min(currentUnit.stats.movementRange, currentUnit.stats.currentActionPoints);
    const reachable = pathfinder.getReachableTiles(
      currentUnit.position,
      effectiveRange
    );
    
    // Find best position (closest to target)
    let bestPos = null;
    let bestDistance = nearestDistance;
    
    for (const [, data] of reachable) {
      const dist = Math.abs(data.position.x - nearestPlayer.position.x) + 
                   Math.abs(data.position.z - nearestPlayer.position.z);
      if (dist < bestDistance) {
        bestDistance = dist;
        bestPos = data.position;
      }
    }
    
    if (bestPos) {
      previewPath(bestPos);
      await delay(300);
      moveUnit(bestPos);
      await delay(500);
    }
  }
  
  // Try to attack
  const attackAbility = currentUnit.abilities[0]; // Use first ability
  if (attackAbility && currentUnit.stats.currentActionPoints >= attackAbility.apCost) {
    // Check if any player is in range
    const newDistance = Math.abs(nearestPlayer.position.x - units[currentUnit.id].position.x) + 
                        Math.abs(nearestPlayer.position.z - units[currentUnit.id].position.z);
    
    if (newDistance <= attackAbility.range) {
      selectAbility(attackAbility.id);
      await delay(300);
      useAbility(nearestPlayer.position);
      await delay(500);
    }
  }
  
  // End turn
  endUnitTurn();
}

// ============================================
// UTILITY
// ============================================

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

