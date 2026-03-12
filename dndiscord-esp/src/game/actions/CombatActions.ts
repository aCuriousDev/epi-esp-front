/**
 * Combat Actions
 * 
 * Handles ability selection, usage, and damage calculations
 */

import { batch } from 'solid-js';
import { produce } from 'solid-js/store';
import { GridPosition, TurnPhase, Unit, Ability, GameMode, GamePhase } from '../../types';
import { gameState, setGameState, addCombatLog } from '../stores/GameStateStore';
import { units, setUnits, getPlayerUnits, getEnemyUnits } from '../stores/UnitsStore';
import { tiles, setTiles, pathfinder, updatePathfinder } from '../stores/TilesStore';
import { posToKey } from '../utils/GridUtils';

// ============================================
// ABILITY SELECTION
// ============================================

export function selectAbility(abilityId: string): void {
  const unit = gameState.selectedUnit ? units[gameState.selectedUnit] : null;
  if (!unit) return;
  
  // Only allow ability selection if it's the current unit's turn
  const currentUnitId = gameState.turnOrder[gameState.currentUnitIndex];
  if (unit.id !== currentUnitId) {
    return;
  }
  
  const ability = unit.abilities.find((a) => a.id === abilityId);
  if (!ability || ability.currentCooldown > 0) return;
  if (unit.stats.currentActionPoints < ability.apCost) return;
  
  batch(() => {
    setGameState({
      selectedAbility: abilityId,
      turnPhase: TurnPhase.ACTION,
    });
    
    // Calculate targetable tiles
    if (pathfinder) {
      const targets = pathfinder.getTilesInRange(unit.position, ability.range);
      setGameState('targetableTiles', targets);
    }
    
    setGameState('highlightedTiles', []);
  });
}

// ============================================
// ABILITY USAGE
// ============================================

export function useAbility(targetPos: GridPosition): boolean {
  const unit = gameState.selectedUnit ? units[gameState.selectedUnit] : null;
  const ability = gameState.selectedAbility 
    ? unit?.abilities.find((a) => a.id === gameState.selectedAbility)
    : null;
  
  if (!unit || !ability) return false;
  if (unit.stats.currentActionPoints < ability.apCost) return false;
  
  // Check range
  const distance = Math.abs(targetPos.x - unit.position.x) + Math.abs(targetPos.z - unit.position.z);
  if (distance > ability.range) return false;
  
  // Find targets in AOE
  const targetUnitIds: string[] = [];
  
  if (ability.aoeRadius > 0) {
    // AOE ability
    for (let x = targetPos.x - ability.aoeRadius; x <= targetPos.x + ability.aoeRadius; x++) {
      for (let z = targetPos.z - ability.aoeRadius; z <= targetPos.z + ability.aoeRadius; z++) {
        const dist = Math.abs(x - targetPos.x) + Math.abs(z - targetPos.z);
        if (dist <= ability.aoeRadius) {
          const tileKey = posToKey({ x, z });
          const tile = tiles[tileKey];
          if (tile?.occupiedBy && tile.occupiedBy !== unit.id) {
            targetUnitIds.push(tile.occupiedBy);
          }
        }
      }
    }
  } else {
    // Single target
    const tileKey = posToKey(targetPos);
    const tile = tiles[tileKey];
    if (tile?.occupiedBy && tile.occupiedBy !== unit.id) {
      targetUnitIds.push(tile.occupiedBy);
    }
  }
  
  batch(() => {
    // Apply damage to targets
    targetUnitIds.forEach((targetId) => {
      const target = units[targetId];
      if (!target) return;
      
      const damage = calculateDamage(unit, target, ability);
      
      setUnits(targetId, produce((t) => {
        t.stats.currentHealth = Math.max(0, t.stats.currentHealth - damage);
        if (t.stats.currentHealth <= 0) {
          t.isAlive = false;
          // Clear tile occupation
          setTiles(posToKey(t.position), 'occupiedBy', null);
        }
      }));
      
      addCombatLog(
        `${unit.name} uses ${ability.name} on ${target.name} for ${damage} damage!`,
        'damage'
      );
      
      if (units[targetId].stats.currentHealth <= 0) {
        addCombatLog(`${target.name} has been defeated!`, 'system');
      }
    });
    
    if (targetUnitIds.length === 0) {
      addCombatLog(`${unit.name} uses ${ability.name} but misses!`, 'ability');
    }
    
    // Consume AP and set cooldown
    setUnits(unit.id, produce((u) => {
      u.stats.currentActionPoints -= ability.apCost;
      const abilityIndex = u.abilities.findIndex((a) => a.id === ability.id);
      if (abilityIndex >= 0) {
        u.abilities[abilityIndex].currentCooldown = ability.cooldown;
      }
      u.hasActed = true;
    }));
    
    // Clear ability selection
    setGameState({
      selectedAbility: null,
      targetableTiles: [],
      turnPhase: TurnPhase.MOVE,
    });
    
    // Recalculate movement range based on remaining AP
    const updatedUnit = units[unit.id];
    if (updatedUnit.stats.currentActionPoints >= 1 && pathfinder) {
      // Movement range is limited by both the unit's movement stat and remaining AP
      const effectiveRange = Math.min(updatedUnit.stats.movementRange, updatedUnit.stats.currentActionPoints);
      const reachable = pathfinder.getReachableTiles(
        updatedUnit.position,
        effectiveRange
      );
      const highlighted = Array.from(reachable.values()).map((r) => r.position);
      setGameState('highlightedTiles', highlighted);
    } else {
      setGameState('highlightedTiles', []);
    }
  });
  
  // Update pathfinder
  updatePathfinder();
  
  // Check game over
  checkGameOver();
  
  return true;
}

// ============================================
// DAMAGE CALCULATION
// ============================================

export function calculateDamage(attacker: Unit, defender: Unit, ability: Ability): number {
  const baseDamage = ability.baseDamage + attacker.stats.attackDamage;
  const defense = defender.stats.defense;
  const reduction = defense / (defense + 50); // Diminishing returns formula
  const damage = Math.floor(baseDamage * (1 - reduction));
  return Math.max(1, damage); // Minimum 1 damage
}

// ============================================
// GAME OVER CHECK
// ============================================

export function checkGameOver(): void {
  const playerUnits = getPlayerUnits();
  const enemyUnits = getEnemyUnits();
  
  if (playerUnits.length === 0) {
    setGameState('phase', GamePhase.GAME_OVER);
    addCombatLog('Defeat! All your units have fallen.', 'system');
    return;
  }

  if (enemyUnits.length === 0) {
    if (gameState.mode === GameMode.DUNGEON && gameState.dungeon) {
      const isLastRoom = gameState.dungeon.currentRoomIndex === gameState.dungeon.totalRooms - 1;
      if (isLastRoom) {
        setGameState('phase', GamePhase.GAME_OVER);
        addCombatLog('Victoire ! Le donjon est terminé ! Tous les ennemis de la dernière salle sont vaincus !', 'system');
      } else {
        addCombatLog('Tous les ennemis de cette salle sont vaincus ! Avancez vers le portail de téléportation.', 'system');
      }
    } else {
      setGameState('phase', GamePhase.GAME_OVER);
      addCombatLog('Victory! All enemies have been defeated!', 'system');
    }
  }
}

