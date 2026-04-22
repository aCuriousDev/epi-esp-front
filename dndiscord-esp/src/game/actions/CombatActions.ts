/**
 * Combat Actions
 * 
 * Handles ability selection, usage, and damage calculations
 */

import { batch } from 'solid-js';
import { produce } from 'solid-js/store';
import { GridPosition, TurnPhase, Unit, Ability, DamageType, GameMode, GamePhase } from '../../types';
import { gameState, setGameState, addCombatLog } from '../stores/GameStateStore';
import { units, setUnits, getPlayerUnits, getEnemyUnits } from '../stores/UnitsStore';
import { tiles, setTiles, pathfinder, updatePathfinder } from '../stores/TilesStore';
import { posToKey } from '../utils/GridUtils';
import { calculateDamage } from '../utils/DamageCalc';
import { isInSession } from '../../stores/session.store';
import { signalRService } from '../../services/signalr/SignalRService';
import { playSpellEffect, playDamageEffect, playDeathEffect, playHitReactionEffect, playCameraShake } from '../vfx/VFXIntegration';
import { playSpellCastSound, playImpactSound, playDeathSound, playSwordHitSound, playVictorySound, playDefeatSound, playSelectSound, playArrowShotSound, playShieldBashSound, playClawAttackSound } from '../audio/SoundIntegration';

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
  
  playSelectSound();
  
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
  
  // Fire spell VFX (async, doesn't block game logic)
  playSpellEffect(
    unit.position,
    targetPos,
    ability.damageType,
    ability.aoeRadius > 0 ? ability.aoeRadius : undefined,
    ability.id
  );

  // Sound: per-ability attack sounds
  if (ability.damageType === DamageType.PHYSICAL) {
    if (ability.id === 'arrow_shot') {
      playArrowShotSound();
    } else if (ability.id === 'shield_bash') {
      playShieldBashSound();
    } else if (ability.id === 'claw') {
      playClawAttackSound();
    } else {
      playSwordHitSound();
    }
  } else {
    playSpellCastSound(ability.damageType);
  }
  
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
  
  // Pre-compute damage per target (same calc as before, runs on the caller).
  const damages: Array<{ targetId: string; damage: number; target: Unit }> = [];
  for (const targetId of targetUnitIds) {
    const target = units[targetId];
    if (!target) continue;
    damages.push({ targetId, damage: calculateDamage(unit, target, ability), target });
  }

  // Fire VFX + sound locally for immediate attacker feedback — these never
  // depend on the authoritative broadcast and are purely presentational.
  for (const { targetId, damage, target } of damages) {
    playDamageEffect(target.position, damage);
    playImpactSound();
    playHitReactionEffect(targetId);
    playCameraShake(Math.min(0.05 + damage * 0.005, 0.2), 200);
  }

  // In a multiplayer session the hub broadcasts AbilityUsed to the whole group
  // (including the caller). The gameSync AbilityUsed handler applies HP / AP /
  // cooldown on every client identically — no local mutation here. Without this
  // the attacker's client was the only one seeing HP drop (the useAbility
  // desync flagged by the audit).
  if (isInSession()) {
    const effects = damages.map(({ targetId, damage }) => ({
      type: "Damage",
      targetId,
      value: damage,
    }));
    signalRService
      .invoke("SendAbilityUsed", {
        unitId: unit.id,
        abilityId: ability.id,
        targets: targetUnitIds,
        effects,
        apCost: ability.apCost,
        cooldown: ability.cooldown,
      })
      .catch((err) => console.warn("[useAbility] Hub SendAbilityUsed failed:", err));

    // Local UI reset — these don't propagate to peers (transient attacker state).
    batch(() => {
      setGameState({
        selectedAbility: null,
        targetableTiles: [],
        turnPhase: TurnPhase.MOVE,
        highlightedTiles: [],
      });
    });

    if (targetUnitIds.length === 0) {
      addCombatLog(`${unit.name} uses ${ability.name} but misses!`, 'ability');
    }
    return true;
  }

  // Solo path: apply everything locally, no hub involvement.
  batch(() => {
    for (const { targetId, damage, target } of damages) {
      setUnits(targetId, produce((t) => {
        t.stats.currentHealth = Math.max(0, t.stats.currentHealth - damage);
        if (t.stats.currentHealth <= 0) {
          t.isAlive = false;
          setTiles(posToKey(t.position), 'occupiedBy', null);
        }
      }));

      addCombatLog(
        `${unit.name} uses ${ability.name} on ${target.name} for ${damage} damage!`,
        'damage'
      );

      if (units[targetId].stats.currentHealth <= 0) {
        addCombatLog(`${target.name} has been defeated!`, 'system');
        playDeathEffect(targetId, target.team as string);
        playDeathSound();
        playCameraShake(0.2, 400);
      }
    }

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

    setGameState({
      selectedAbility: null,
      targetableTiles: [],
      turnPhase: TurnPhase.MOVE,
    });

    // Recalculate movement range based on remaining AP
    const updatedUnit = units[unit.id];
    if (updatedUnit.stats.currentActionPoints >= 1 && pathfinder) {
      const effectiveRange = Math.min(updatedUnit.stats.movementRange, updatedUnit.stats.currentActionPoints);
      const reachable = pathfinder.getReachableTiles(updatedUnit.position, effectiveRange);
      const highlighted = Array.from(reachable.values()).map((r) => r.position);
      setGameState('highlightedTiles', highlighted);
    } else {
      setGameState('highlightedTiles', []);
    }
  });

  updatePathfinder();
  checkGameOver();
  return true;
}

// ============================================
// DAMAGE CALCULATION
// ============================================

export { calculateDamage } from '../utils/DamageCalc';

// ============================================
// GAME OVER CHECK
// ============================================

export function checkGameOver(): void {
  const playerUnits = getPlayerUnits();
  const enemyUnits = getEnemyUnits();
  
  if (playerUnits.length === 0) {
    setGameState('phase', GamePhase.GAME_OVER);
    addCombatLog('Defeat! All your units have fallen.', 'system');
    playDefeatSound();
    return;
  }

  if (enemyUnits.length === 0) {
    if (gameState.mode === GameMode.DUNGEON && gameState.dungeon) {
      const isLastRoom = gameState.dungeon.currentRoomIndex === gameState.dungeon.totalRooms - 1;
      if (isLastRoom) {
        setGameState('phase', GamePhase.GAME_OVER);
        addCombatLog('Victoire ! Le donjon est terminé ! Tous les ennemis de la dernière salle sont vaincus !', 'system');
        playVictorySound();
      } else {
        addCombatLog('Tous les ennemis de cette salle sont vaincus ! Avancez vers le portail de téléportation.', 'system');
      }
    } else {
      setGameState('phase', GamePhase.GAME_OVER);
      addCombatLog('Victory! All enemies have been defeated!', 'system');
      playVictorySound();
    }
  }
}

