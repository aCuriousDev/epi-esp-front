/**
 * Maps a UnitAssignment (from backend) to a frontend Unit.
 */

import { Unit, UnitType, Team, GridPosition, Ability } from '../../types';
import type { UnitAssignment } from '../../types/multiplayer';
import {
  WARRIOR_ABILITIES,
  BARBARIAN_ABILITIES,
  MAGE_ABILITIES,
  ARCHER_ABILITIES,
  ROGUE_ABILITIES,
  cloneAbilities,
} from '../abilities/AbilityDefinitions';

/**
 * Map a character class string (French) to UnitType enum.
 *
 * Only the 5 playable classes (Barbare, Guerrier, Magicien, Rodeur, Voleur)
 * have dedicated 3D assets. Legacy lobby quickstart labels ("Mage", "Archer")
 * are still honoured so pre-existing sessions keep working.
 */
function classToUnitType(characterClass: string): UnitType {
  switch (characterClass) {
    case 'Barbare':
      return UnitType.BARBARIAN;
    case 'Guerrier':
      return UnitType.WARRIOR;
    case 'Magicien':
    case 'Mage': // lobby quickstart preset label (back BuildDefaultAssignment)
      return UnitType.MAGE;
    case 'Rodeur':
    case 'Archer': // lobby quickstart preset label
      return UnitType.ARCHER;
    case 'Voleur':
      return UnitType.ROGUE;
    default:
      return UnitType.WARRIOR;
  }
}

function abilitiesForType(unitType: UnitType): Ability[] {
  switch (unitType) {
    case UnitType.WARRIOR:
      return cloneAbilities(WARRIOR_ABILITIES);
    case UnitType.BARBARIAN:
      return cloneAbilities(BARBARIAN_ABILITIES);
    case UnitType.MAGE:
      return cloneAbilities(MAGE_ABILITIES);
    case UnitType.ARCHER:
      return cloneAbilities(ARCHER_ABILITIES);
    case UnitType.ROGUE:
      return cloneAbilities(ROGUE_ABILITIES);
    default:
      return cloneAbilities(WARRIOR_ABILITIES);
  }
}

function attackRangeForType(unitType: UnitType): number {
  switch (unitType) {
    case UnitType.MAGE:
      return 5;
    case UnitType.ARCHER:
      return 6;
    case UnitType.ROGUE:
      return 2;
    default:
      return 1;
  }
}

/**
 * Convert a backend UnitAssignment into a frontend Unit.
 */
export function mapAssignmentToUnit(assignment: UnitAssignment, spawnPosition: GridPosition): Unit {
  const unitType = classToUnitType(assignment.characterClass);
  const movementRange = assignment.movementRange > 0 ? assignment.movementRange : Math.max(2, Math.floor(assignment.speed / 5));
  const attackRange = assignment.attackRange > 0 ? assignment.attackRange : attackRangeForType(unitType);

  return {
    id: assignment.unitId,
    name: assignment.unitName,
    type: unitType,
    team: Team.PLAYER,
    position: spawnPosition,
    stats: {
      maxHealth: assignment.maxHp,
      currentHealth: assignment.currentHp,
      maxActionPoints: 6,
      currentActionPoints: 6,
      movementRange,
      attackRange,
      attackDamage: assignment.attackDamage,
      defense: assignment.defense,
      initiative: assignment.initiative,
    },
    abilities: abilitiesForType(unitType),
    statusEffects: [],
    isAlive: true,
    hasActed: false,
    hasMoved: false,
    ownerUserId: assignment.userId,
  };
}
