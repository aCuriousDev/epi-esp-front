import { calculateDamage } from '../utils/DamageCalc';
import {
  Unit,
  UnitType,
  Team,
  Ability,
  AbilityTargetType,
  DamageType,
} from '../../types';

const DEFAULT_STATS: Unit['stats'] = {
  maxHealth: 100,
  currentHealth: 100,
  maxActionPoints: 6,
  currentActionPoints: 6,
  movementRange: 3,
  attackRange: 1,
  attackDamage: 10,
  defense: 5,
  initiative: 10,
};

function makeUnit(overrides: Partial<Unit> & { id: string }): Unit {
  const { stats: statsOverride, ...rest } = overrides;
  return {
    name: overrides.id,
    type: UnitType.WARRIOR,
    team: Team.PLAYER,
    position: { x: 0, z: 0 },
    abilities: [],
    statusEffects: [],
    isAlive: true,
    hasActed: false,
    hasMoved: false,
    ...rest,
    stats: { ...DEFAULT_STATS, ...statsOverride },
  };
}

function makeAbility(overrides: Partial<Ability> = {}): Ability {
  return {
    id: 'test',
    name: 'Test',
    description: '',
    apCost: 2,
    range: 1,
    aoeRadius: 0,
    targetType: AbilityTargetType.SINGLE,
    damageType: DamageType.PHYSICAL,
    baseDamage: 20,
    cooldown: 0,
    currentCooldown: 0,
    effects: [],
    ...overrides,
  };
}

describe('DamageCalc', () => {
  describe('calculateDamage', () => {
    it('calculates normal damage correctly', () => {
      // baseDamage = 20 + 10 = 30, defense = 5, reduction = 5/55 ~ 0.0909
      // damage = floor(30 * (1 - 5/55)) = floor(30 * 50/55) = floor(27.27) = 27
      const attacker = makeUnit({ id: 'a', stats: { maxHealth: 100, currentHealth: 100, maxActionPoints: 6, currentActionPoints: 6, movementRange: 3, attackRange: 1, attackDamage: 10, defense: 5, initiative: 10 } });
      const defender = makeUnit({ id: 'd', stats: { maxHealth: 100, currentHealth: 100, maxActionPoints: 6, currentActionPoints: 6, movementRange: 3, attackRange: 1, attackDamage: 10, defense: 5, initiative: 10 } });
      const ability = makeAbility({ baseDamage: 20 });
      const damage = calculateDamage(attacker, defender, ability);
      expect(damage).toBe(27);
    });

    it('reduces damage with high defense', () => {
      const attacker = makeUnit({ id: 'a', stats: { maxHealth: 100, currentHealth: 100, maxActionPoints: 6, currentActionPoints: 6, movementRange: 3, attackRange: 1, attackDamage: 10, defense: 5, initiative: 10 } });
      const defender = makeUnit({ id: 'd', stats: { maxHealth: 100, currentHealth: 100, maxActionPoints: 6, currentActionPoints: 6, movementRange: 3, attackRange: 1, attackDamage: 10, defense: 100, initiative: 10 } });
      const ability = makeAbility({ baseDamage: 20 });
      // baseDamage = 30, reduction = 100/150 = 0.6667, damage = floor(30 * 0.3333) = floor(10) = 10
      const damage = calculateDamage(attacker, defender, ability);
      expect(damage).toBe(10);
    });

    it('deals full damage when defense is zero', () => {
      const attacker = makeUnit({ id: 'a', stats: { maxHealth: 100, currentHealth: 100, maxActionPoints: 6, currentActionPoints: 6, movementRange: 3, attackRange: 1, attackDamage: 10, defense: 5, initiative: 10 } });
      const defender = makeUnit({ id: 'd', stats: { maxHealth: 100, currentHealth: 100, maxActionPoints: 6, currentActionPoints: 6, movementRange: 3, attackRange: 1, attackDamage: 10, defense: 0, initiative: 10 } });
      const ability = makeAbility({ baseDamage: 20 });
      // baseDamage = 30, reduction = 0/50 = 0, damage = floor(30) = 30
      const damage = calculateDamage(attacker, defender, ability);
      expect(damage).toBe(30);
    });

    it('guarantees minimum 1 damage', () => {
      const attacker = makeUnit({ id: 'a', stats: { maxHealth: 100, currentHealth: 100, maxActionPoints: 6, currentActionPoints: 6, movementRange: 3, attackRange: 1, attackDamage: 0, defense: 5, initiative: 10 } });
      const defender = makeUnit({ id: 'd', stats: { maxHealth: 100, currentHealth: 100, maxActionPoints: 6, currentActionPoints: 6, movementRange: 3, attackRange: 1, attackDamage: 10, defense: 9999, initiative: 10 } });
      const ability = makeAbility({ baseDamage: 1 });
      // baseDamage = 1, defense = 9999, reduction ~1, damage ~0 -> clamped to 1
      const damage = calculateDamage(attacker, defender, ability);
      expect(damage).toBe(1);
    });
  });
});
