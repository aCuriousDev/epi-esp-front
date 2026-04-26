import { mapAssignmentToUnit } from '../utils/CharacterToUnit';
import { UnitType, Team } from '../../types';
import type { UnitAssignment } from '../../types/multiplayer';

function makeAssignment(overrides: Partial<UnitAssignment> = {}): UnitAssignment {
  return {
    userId: 'user-1',
    unitId: 'unit-1',
    unitName: 'Test Hero',
    characterClass: 'Guerrier',
    maxHp: 100,
    currentHp: 100,
    armorClass: 15,
    speed: 30,
    initiative: 12,
    attackDamage: 10,
    defense: 5,
    movementRange: 4,
    attackRange: 1,
    ...overrides,
  };
}

describe('CharacterToUnit / mapAssignmentToUnit', () => {
  describe('class to unit type mapping', () => {
    it.each([
      // Playable classes — each has its own 3D asset and dedicated UnitType
      ['Guerrier', UnitType.WARRIOR],
      ['Barbare', UnitType.BARBARIAN],
      ['Magicien', UnitType.MAGE],
      ['Rodeur', UnitType.ARCHER],
      ['Voleur', UnitType.ROGUE],
      // Lobby quickstart preset labels (back BuildDefaultAssignment)
      ['Mage', UnitType.MAGE],
      ['Archer', UnitType.ARCHER],
      // Legacy non-playable classes (pre-existing characters) — fall back to WARRIOR
      ['Paladin', UnitType.WARRIOR],
      ['Moine', UnitType.WARRIOR],
      ['Ensorceleur', UnitType.WARRIOR],
      ['Sorcier', UnitType.WARRIOR],
      ['Barde', UnitType.WARRIOR],
      ['Clerc', UnitType.WARRIOR],
      ['Druide', UnitType.WARRIOR],
    ])('%s maps to %s', (characterClass, expectedType) => {
      const unit = mapAssignmentToUnit(makeAssignment({ characterClass }), { x: 0, z: 0 });
      expect(unit.type).toBe(expectedType);
    });

    it('defaults unknown class to WARRIOR', () => {
      const unit = mapAssignmentToUnit(makeAssignment({ characterClass: 'UnknownClass' }), { x: 0, z: 0 });
      expect(unit.type).toBe(UnitType.WARRIOR);
    });
  });

  describe('basic unit properties', () => {
    it('sets team to PLAYER', () => {
      const unit = mapAssignmentToUnit(makeAssignment(), { x: 0, z: 0 });
      expect(unit.team).toBe(Team.PLAYER);
    });

    it('uses spawn position', () => {
      const unit = mapAssignmentToUnit(makeAssignment(), { x: 3, z: 7 });
      expect(unit.position).toEqual({ x: 3, z: 7 });
    });

    it('maps id and name from assignment', () => {
      const unit = mapAssignmentToUnit(makeAssignment({ unitId: 'abc', unitName: 'Hero' }), { x: 0, z: 0 });
      expect(unit.id).toBe('abc');
      expect(unit.name).toBe('Hero');
    });

    it('sets ownerUserId from assignment', () => {
      const unit = mapAssignmentToUnit(makeAssignment({ userId: 'owner-42' }), { x: 0, z: 0 });
      expect(unit.ownerUserId).toBe('owner-42');
    });

    it('starts alive and not acted/moved', () => {
      const unit = mapAssignmentToUnit(makeAssignment(), { x: 0, z: 0 });
      expect(unit.isAlive).toBe(true);
      expect(unit.hasActed).toBe(false);
      expect(unit.hasMoved).toBe(false);
    });
  });

  describe('stats mapping', () => {
    it('maps health from assignment', () => {
      const unit = mapAssignmentToUnit(makeAssignment({ maxHp: 120, currentHp: 80 }), { x: 0, z: 0 });
      expect(unit.stats.maxHealth).toBe(120);
      expect(unit.stats.currentHealth).toBe(80);
    });

    it('maps attackDamage and defense', () => {
      const unit = mapAssignmentToUnit(makeAssignment({ attackDamage: 15, defense: 8 }), { x: 0, z: 0 });
      expect(unit.stats.attackDamage).toBe(15);
      expect(unit.stats.defense).toBe(8);
    });

    it('maps initiative', () => {
      const unit = mapAssignmentToUnit(makeAssignment({ initiative: 18 }), { x: 0, z: 0 });
      expect(unit.stats.initiative).toBe(18);
    });

    it('uses movementRange from assignment when > 0', () => {
      const unit = mapAssignmentToUnit(makeAssignment({ movementRange: 5 }), { x: 0, z: 0 });
      expect(unit.stats.movementRange).toBe(5);
    });

    it('falls back to speed-based calculation when movementRange is 0', () => {
      const unit = mapAssignmentToUnit(makeAssignment({ movementRange: 0, speed: 30 }), { x: 0, z: 0 });
      // Math.max(2, Math.floor(30/5)) = Math.max(2, 6) = 6
      expect(unit.stats.movementRange).toBe(6);
    });

    it('fallback movementRange has minimum of 2', () => {
      const unit = mapAssignmentToUnit(makeAssignment({ movementRange: 0, speed: 5 }), { x: 0, z: 0 });
      // Math.max(2, Math.floor(5/5)) = Math.max(2, 1) = 2
      expect(unit.stats.movementRange).toBe(2);
    });
  });

  describe('abilities', () => {
    it('assigns abilities array (non-empty)', () => {
      const unit = mapAssignmentToUnit(makeAssignment({ characterClass: 'Guerrier' }), { x: 0, z: 0 });
      expect(unit.abilities.length).toBeGreaterThan(0);
    });

    it('mage gets mage abilities', () => {
      const unit = mapAssignmentToUnit(makeAssignment({ characterClass: 'Magicien' }), { x: 0, z: 0 });
      expect(unit.abilities.length).toBeGreaterThan(0);
      // Mage abilities include fireball
      expect(unit.abilities.some(a => a.id === 'fireball')).toBe(true);
    });

    it('archer (Rodeur) gets archer abilities', () => {
      const unit = mapAssignmentToUnit(makeAssignment({ characterClass: 'Rodeur' }), { x: 0, z: 0 });
      expect(unit.abilities.some(a => a.id === 'arrow_shot')).toBe(true);
    });

    it('rogue (Voleur) gets rogue abilities', () => {
      const unit = mapAssignmentToUnit(makeAssignment({ characterClass: 'Voleur' }), { x: 0, z: 0 });
      expect(unit.abilities.some(a => a.id === 'sneak_attack')).toBe(true);
    });

    it('barbarian gets barbarian abilities', () => {
      const unit = mapAssignmentToUnit(makeAssignment({ characterClass: 'Barbare' }), { x: 0, z: 0 });
      expect(unit.abilities.some(a => a.id === 'reckless_attack')).toBe(true);
    });
  });
});
