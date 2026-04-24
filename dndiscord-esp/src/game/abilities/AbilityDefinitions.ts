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
// BARBARIAN ABILITIES
// ============================================

export const BARBARIAN_ABILITIES: Ability[] = [
  {
    id: 'reckless_attack',
    name: 'Reckless Attack',
    description: 'A wild swing that trades defense for damage',
    apCost: 2,
    range: 1,
    aoeRadius: 0,
    targetType: AbilityTargetType.SINGLE,
    damageType: DamageType.PHYSICAL,
    baseDamage: 32,
    cooldown: 0,
    currentCooldown: 0,
    effects: [{ type: 'damage', value: 32 }],
  },
  {
    id: 'rage',
    name: 'Rage',
    description: 'Enter a frenzy, boosting damage for 2 turns',
    apCost: 3,
    range: 0,
    aoeRadius: 0,
    targetType: AbilityTargetType.SELF,
    damageType: DamageType.PHYSICAL,
    baseDamage: 0,
    cooldown: 4,
    currentCooldown: 0,
    effects: [{ type: 'buff', value: 10, duration: 2 }],
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
  {
    id: 'piercing_shot',
    name: 'Piercing Shot',
    description: 'An armor-piercing arrow dealing heavy damage',
    apCost: 4,
    range: 6,
    aoeRadius: 0,
    targetType: AbilityTargetType.SINGLE,
    damageType: DamageType.PHYSICAL,
    baseDamage: 35,
    cooldown: 3,
    currentCooldown: 0,
    effects: [{ type: 'damage', value: 35 }],
  },
];

// ============================================
// ROGUE ABILITIES
// ============================================

export const ROGUE_ABILITIES: Ability[] = [
  {
    id: 'sneak_attack',
    name: 'Sneak Attack',
    description: 'A precise strike that exploits the target\'s weakness',
    apCost: 2,
    range: 2,
    aoeRadius: 0,
    targetType: AbilityTargetType.SINGLE,
    damageType: DamageType.PHYSICAL,
    baseDamage: 28,
    cooldown: 0,
    currentCooldown: 0,
    effects: [{ type: 'damage', value: 28 }],
  },
  {
    id: 'evasion',
    name: 'Evasion',
    description: 'Dash aside, increasing defense for 1 turn',
    apCost: 2,
    range: 0,
    aoeRadius: 0,
    targetType: AbilityTargetType.SELF,
    damageType: DamageType.PHYSICAL,
    baseDamage: 0,
    cooldown: 3,
    currentCooldown: 0,
    effects: [{ type: 'buff', value: 5, duration: 1 }],
  },
];

// ============================================
// ENEMY ABILITIES — one set per enemy type
// ============================================

export const SKELETON_WARRIOR_ABILITIES: Ability[] = [
  {
    id: 'bone_slash',
    name: 'Bone Slash',
    description: 'A heavy melee swing with a rusted blade',
    apCost: 2,
    range: 1,
    aoeRadius: 0,
    targetType: AbilityTargetType.SINGLE,
    damageType: DamageType.PHYSICAL,
    baseDamage: 18,
    cooldown: 0,
    currentCooldown: 0,
    effects: [{ type: 'damage', value: 18 }],
  },
  {
    id: 'shield_wall',
    name: 'Shield Wall',
    description: 'Brace behind a bone shield, reducing damage taken',
    apCost: 3,
    range: 0,
    aoeRadius: 0,
    targetType: AbilityTargetType.SELF,
    damageType: DamageType.PHYSICAL,
    baseDamage: 0,
    cooldown: 4,
    currentCooldown: 0,
    effects: [{ type: 'buff', value: 5, duration: 2 }],
  },
];

export const SKELETON_MAGE_ABILITIES: Ability[] = [
  {
    id: 'shadow_bolt',
    name: 'Shadow Bolt',
    description: 'A ranged bolt of dark energy',
    apCost: 2,
    range: 5,
    aoeRadius: 0,
    targetType: AbilityTargetType.SINGLE,
    damageType: DamageType.MAGICAL,
    baseDamage: 20,
    cooldown: 0,
    currentCooldown: 0,
    effects: [{ type: 'damage', value: 20 }],
  },
  {
    id: 'bone_nova',
    name: 'Bone Nova',
    description: 'Explodes outward in a burst of bone shards',
    apCost: 4,
    range: 3,
    aoeRadius: 1,
    targetType: AbilityTargetType.AOE_CIRCLE,
    damageType: DamageType.MAGICAL,
    baseDamage: 28,
    cooldown: 3,
    currentCooldown: 0,
    effects: [{ type: 'damage', value: 28 }],
  },
];

export const SKELETON_ROGUE_ABILITIES: Ability[] = [
  {
    id: 'rusty_dagger',
    name: 'Rusty Dagger',
    description: 'A quick dagger jab',
    apCost: 1,
    range: 1,
    aoeRadius: 0,
    targetType: AbilityTargetType.SINGLE,
    damageType: DamageType.PHYSICAL,
    baseDamage: 12,
    cooldown: 0,
    currentCooldown: 0,
    effects: [{ type: 'damage', value: 12 }],
  },
  {
    id: 'poisoned_bolt',
    name: 'Poisoned Bolt',
    description: 'A poisoned crossbow bolt dealing damage over time',
    apCost: 3,
    range: 4,
    aoeRadius: 0,
    targetType: AbilityTargetType.SINGLE,
    damageType: DamageType.PHYSICAL,
    baseDamage: 14,
    cooldown: 2,
    currentCooldown: 0,
    effects: [{ type: 'damage', value: 14 }, { type: 'debuff', value: 4, duration: 2 }],
  },
];

export const SKELETON_MINION_ABILITIES: Ability[] = [
  {
    id: 'feeble_bite',
    name: 'Feeble Bite',
    description: 'A weak but relentless gnaw',
    apCost: 1,
    range: 1,
    aoeRadius: 0,
    targetType: AbilityTargetType.SINGLE,
    damageType: DamageType.PHYSICAL,
    baseDamage: 8,
    cooldown: 0,
    currentCooldown: 0,
    effects: [{ type: 'damage', value: 8 }],
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

