import {
  calculateTurnOrder,
  resetUnitForNewRound,
  prepareNewRound,
  determinePhase,
  validateTurnOrder,
} from '../TurnManager';
import {
  Unit,
  UnitType,
  Team,
  GamePhase,
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

describe('TurnManager', () => {
  describe('calculateTurnOrder', () => {
    it('returns unit IDs sorted by initiative descending', () => {
      const units: Record<string, Unit> = {
        a: makeUnit({ id: 'a', stats: { maxHealth: 100, currentHealth: 100, maxActionPoints: 6, currentActionPoints: 6, movementRange: 3, attackRange: 1, attackDamage: 10, defense: 5, initiative: 5 } }),
        b: makeUnit({ id: 'b', stats: { maxHealth: 100, currentHealth: 100, maxActionPoints: 6, currentActionPoints: 6, movementRange: 3, attackRange: 1, attackDamage: 10, defense: 5, initiative: 20 } }),
        c: makeUnit({ id: 'c', stats: { maxHealth: 100, currentHealth: 100, maxActionPoints: 6, currentActionPoints: 6, movementRange: 3, attackRange: 1, attackDamage: 10, defense: 5, initiative: 10 } }),
      };
      expect(calculateTurnOrder(units)).toEqual(['b', 'c', 'a']);
    });

    it('filters out dead units', () => {
      const units: Record<string, Unit> = {
        a: makeUnit({ id: 'a', isAlive: true }),
        b: makeUnit({ id: 'b', isAlive: false }),
      };
      const order = calculateTurnOrder(units);
      expect(order).toContain('a');
      expect(order).not.toContain('b');
    });

    it('returns empty array when no alive units', () => {
      const units: Record<string, Unit> = {
        a: makeUnit({ id: 'a', isAlive: false }),
      };
      expect(calculateTurnOrder(units)).toEqual([]);
    });
  });

  describe('resetUnitForNewRound', () => {
    it('resets hasActed and hasMoved to false', () => {
      const unit = makeUnit({ id: 'u1' });
      unit.hasActed = true;
      unit.hasMoved = true;
      resetUnitForNewRound(unit);
      expect(unit.hasActed).toBe(false);
      expect(unit.hasMoved).toBe(false);
    });

    it('restores action points to max', () => {
      const unit = makeUnit({ id: 'u1' });
      unit.stats.currentActionPoints = 2;
      resetUnitForNewRound(unit);
      expect(unit.stats.currentActionPoints).toBe(unit.stats.maxActionPoints);
    });

    it('decrements ability cooldowns', () => {
      const unit = makeUnit({
        id: 'u1',
        abilities: [
          {
            id: 'a1', name: 'Test', description: '', apCost: 2, range: 1,
            aoeRadius: 0, targetType: AbilityTargetType.SINGLE,
            damageType: DamageType.PHYSICAL, baseDamage: 10,
            cooldown: 3, currentCooldown: 2, effects: [],
          },
          {
            id: 'a2', name: 'Test2', description: '', apCost: 2, range: 1,
            aoeRadius: 0, targetType: AbilityTargetType.SINGLE,
            damageType: DamageType.PHYSICAL, baseDamage: 10,
            cooldown: 1, currentCooldown: 0, effects: [],
          },
        ],
      });
      resetUnitForNewRound(unit);
      expect(unit.abilities[0].currentCooldown).toBe(1);
      expect(unit.abilities[1].currentCooldown).toBe(0);
    });
  });

  describe('prepareNewRound', () => {
    it('returns correct roundNumber and turnOrder', () => {
      const units: Record<string, Unit> = {
        a: makeUnit({ id: 'a', stats: { maxHealth: 100, currentHealth: 100, maxActionPoints: 6, currentActionPoints: 6, movementRange: 3, attackRange: 1, attackDamage: 10, defense: 5, initiative: 15 } }),
        b: makeUnit({ id: 'b', stats: { maxHealth: 100, currentHealth: 100, maxActionPoints: 6, currentActionPoints: 6, movementRange: 3, attackRange: 1, attackDamage: 10, defense: 5, initiative: 5 } }),
      };
      const result = prepareNewRound(units, 3);
      expect(result.roundNumber).toBe(4);
      expect(result.turnOrder).toEqual(['a', 'b']);
    });

    it('resets stateUpdates correctly', () => {
      const units: Record<string, Unit> = {
        a: makeUnit({ id: 'a' }),
      };
      const result = prepareNewRound(units, 1);
      expect(result.stateUpdates.currentUnitIndex).toBe(0);
      expect(result.stateUpdates.selectedUnit).toBeNull();
      expect(result.stateUpdates.selectedAbility).toBeNull();
      expect(result.stateUpdates.highlightedTiles).toEqual([]);
      expect(result.stateUpdates.pathPreview).toEqual([]);
      expect(result.stateUpdates.targetableTiles).toEqual([]);
    });
  });

  describe('determinePhase', () => {
    it('returns ENEMY_TURN if unit team is enemy', () => {
      const unit = makeUnit({ id: 'e1', team: Team.ENEMY });
      expect(determinePhase(unit)).toBe(GamePhase.ENEMY_TURN);
    });

    it('returns PLAYER_TURN if unit team is player', () => {
      const unit = makeUnit({ id: 'p1', team: Team.PLAYER });
      expect(determinePhase(unit)).toBe(GamePhase.PLAYER_TURN);
    });

    it('returns PLAYER_TURN if unit is null', () => {
      expect(determinePhase(null)).toBe(GamePhase.PLAYER_TURN);
    });
  });

  describe('validateTurnOrder', () => {
    it('returns valid for correct order', () => {
      const units: Record<string, Unit> = {
        a: makeUnit({ id: 'a', stats: { maxHealth: 100, currentHealth: 100, maxActionPoints: 6, currentActionPoints: 6, movementRange: 3, attackRange: 1, attackDamage: 10, defense: 5, initiative: 20 } }),
        b: makeUnit({ id: 'b', stats: { maxHealth: 100, currentHealth: 100, maxActionPoints: 6, currentActionPoints: 6, movementRange: 3, attackRange: 1, attackDamage: 10, defense: 5, initiative: 10 } }),
      };
      const result = validateTurnOrder(['a', 'b'], units);
      expect(result.valid).toBe(true);
      expect(result.issues).toEqual([]);
    });

    it('reports empty turn order', () => {
      const result = validateTurnOrder([], {});
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Turn order is empty');
    });

    it('reports missing units', () => {
      const result = validateTurnOrder(['missing'], {});
      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.includes('does not exist'))).toBe(true);
    });

    it('reports dead units in order', () => {
      const units: Record<string, Unit> = {
        a: makeUnit({ id: 'a', isAlive: false }),
      };
      const result = validateTurnOrder(['a'], units);
      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.includes('dead'))).toBe(true);
    });

    it('reports initiative order violations', () => {
      const units: Record<string, Unit> = {
        a: makeUnit({ id: 'a', stats: { maxHealth: 100, currentHealth: 100, maxActionPoints: 6, currentActionPoints: 6, movementRange: 3, attackRange: 1, attackDamage: 10, defense: 5, initiative: 5 } }),
        b: makeUnit({ id: 'b', stats: { maxHealth: 100, currentHealth: 100, maxActionPoints: 6, currentActionPoints: 6, movementRange: 3, attackRange: 1, attackDamage: 10, defense: 5, initiative: 20 } }),
      };
      const result = validateTurnOrder(['a', 'b'], units);
      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.includes('Initiative order violation'))).toBe(true);
    });
  });
});
