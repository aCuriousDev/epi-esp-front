/**
 * Ability Definitions
 * 
 * Contains all ability data for different character classes
 */

import { Ability, AbilityTargetType, DamageType } from '../../types';

// ============================================
// WARRIOR ABILITIES
// ============================================

export const WARRIOR_ABILITIES: Ability[] = [
  {
    id: 'slash',
    name: 'Slash',
    description: 'A powerful melee attack',
    apCost: 2,
    range: 1,
    aoeRadius: 0,
    targetType: AbilityTargetType.SINGLE,
    damageType: DamageType.PHYSICAL,
    baseDamage: 25,
    cooldown: 0,
    currentCooldown: 0,
    effects: [{ type: 'damage', value: 25 }],
  },
  {
    id: 'shield_bash',
    name: 'Shield Bash',
    description: 'Stun an enemy for 1 turn',
    apCost: 3,
    range: 1,
    aoeRadius: 0,
    targetType: AbilityTargetType.SINGLE,
    damageType: DamageType.PHYSICAL,
    baseDamage: 10,
    cooldown: 3,
    currentCooldown: 0,
    effects: [{ type: 'damage', value: 10 }, { type: 'debuff', value: 1, duration: 1 }],
  },
];

// ============================================
// MAGE ABILITIES
// ============================================

export const MAGE_ABILITIES: Ability[] = [
  {
    id: 'fireball',
    name: 'Fireball',
    description: 'Launches a fireball dealing area damage',
    apCost: 3,
    range: 5,
    aoeRadius: 1,
    targetType: AbilityTargetType.AOE_CIRCLE,
    damageType: DamageType.FIRE,
    baseDamage: 30,
    cooldown: 2,
    currentCooldown: 0,
    effects: [{ type: 'damage', value: 30 }],
  },
  {
    id: 'ice_shard',
    name: 'Ice Shard',
    description: 'A piercing ice projectile',
    apCost: 2,
    range: 4,
    aoeRadius: 0,
    targetType: AbilityTargetType.SINGLE,
    damageType: DamageType.ICE,
    baseDamage: 20,
    cooldown: 0,
    currentCooldown: 0,
    effects: [{ type: 'damage', value: 20 }],
  },
];

// ============================================
// ARCHER ABILITIES
// ============================================

export const ARCHER_ABILITIES: Ability[] = [
  {
    id: 'arrow_shot',
    name: 'Arrow Shot',
    description: 'A precise ranged attack',
    apCost: 2,
    range: 6,
    aoeRadius: 0,
    targetType: AbilityTargetType.SINGLE,
    damageType: DamageType.PHYSICAL,
    baseDamage: 22,
    cooldown: 0,
    currentCooldown: 0,
    effects: [{ type: 'damage', value: 22 }],
  },
];

// ============================================
// ENEMY ABILITIES
// ============================================

export const ENEMY_ABILITIES: Ability[] = [
  {
    id: 'claw',
    name: 'Claw',
    description: 'A vicious claw attack',
    apCost: 2,
    range: 1,
    aoeRadius: 0,
    targetType: AbilityTargetType.SINGLE,
    damageType: DamageType.PHYSICAL,
    baseDamage: 15,
    cooldown: 0,
    currentCooldown: 0,
    effects: [{ type: 'damage', value: 15 }],
  },
];

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Deep clone abilities to ensure each unit has independent cooldown tracking
 */
export function cloneAbilities(abilities: Ability[]): Ability[] {
  return abilities.map(ability => ({
    ...ability,
    currentCooldown: 0, // Always reset to 0 when cloning
    effects: [...ability.effects],
  }));
}

