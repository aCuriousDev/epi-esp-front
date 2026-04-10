/**
 * VFX Integration - Bridges game actions with visual effects
 * 
 * This module provides functions that game actions (CombatActions, TurnActions)
 * can call to trigger visual effects without directly depending on the engine.
 * 
 * The engine reference is set by GameCanvas when it mounts.
 */

import { GridPosition } from '../../types';
import type { BabylonEngine } from '../../engine/BabylonEngine';
import { VFXManager } from '../../engine/vfx/VFXManager';

let engineRef: BabylonEngine | null = null;

/**
 * Set the engine reference (called by GameCanvas on mount)
 */
export function setVFXEngine(engine: BabylonEngine | null): void {
  engineRef = engine;
}

/**
 * Play a spell VFX for an ability usage
 */
export async function playSpellEffect(
  origin: GridPosition,
  target: GridPosition,
  damageType: string,
  aoeRadius?: number,
  abilityId?: string
): Promise<void> {
  if (!engineRef) return;
  
  try {
    await engineRef.playSpellVFX({
      origin,
      target,
      type: VFXManager.damageTypeToVFX(damageType),
      aoeRadius,
      abilityId,
    });
  } catch (e) {
    console.warn('VFX playSpellEffect failed:', e);
  }
}

/**
 * Play a damage impact VFX
 */
export function playDamageEffect(position: GridPosition, damage: number): void {
  if (!engineRef) return;
  
  try {
    engineRef.playImpactVFX({
      position,
      type: 'damage',
      value: damage,
    });
  } catch (e) {
    console.warn('VFX playDamageEffect failed:', e);
  }
}

/**
 * Play a heal impact VFX
 */
export function playHealEffect(position: GridPosition): void {
  if (!engineRef) return;
  
  try {
    engineRef.playImpactVFX({
      position,
      type: 'heal',
    });
  } catch (e) {
    console.warn('VFX playHealEffect failed:', e);
  }
}

/**
 * Play death VFX for a killed unit
 */
export async function playDeathEffect(unitId: string, team: string): Promise<void> {
  if (!engineRef) return;
  
  try {
    await engineRef.playDeathVFX(unitId, team);
  } catch (e) {
    console.warn('VFX playDeathEffect failed:', e);
  }
}

/**
 * Play turn start VFX for the new active unit
 */
export function playTurnStartEffect(position: GridPosition, team: string): void {
  if (!engineRef) return;
  
  try {
    engineRef.playTurnStartVFX(position, team);
  } catch (e) {
    console.warn('VFX playTurnStartEffect failed:', e);
  }
}

/**
 * Play hit reaction animation on a unit (knockback micro-animation)
 */
export function playHitReactionEffect(unitId: string): void {
  if (!engineRef) return;
  
  try {
    engineRef.playHitReaction(unitId);
  } catch (e) {
    console.warn('VFX playHitReactionEffect failed:', e);
  }
}

/**
 * Play dust trail particles during unit movement
 */
export function playMovementDustEffect(fromPos: GridPosition, toPos: GridPosition): void {
  if (!engineRef) return;
  
  try {
    engineRef.playMovementDust(fromPos, toPos);
  } catch (e) {
    console.warn('VFX playMovementDustEffect failed:', e);
  }
}

/**
 * Shake camera for dramatic impact (explosion, death, big hit)
 */
export function playCameraShake(intensity?: number, durationMs?: number): void {
  if (!engineRef) return;
  
  try {
    engineRef.shakeCamera(intensity, durationMs);
  } catch (e) {
    console.warn('VFX playCameraShake failed:', e);
  }
}
