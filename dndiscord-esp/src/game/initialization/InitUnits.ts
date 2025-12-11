/**
 * Unit Initialization
 * 
 * Sets up all units for the game including player characters and enemies
 */

import { Unit, UnitType, Team } from '../../types';
import { setUnits } from '../stores/UnitsStore';
import { setTiles } from '../stores/TilesStore';
import { posToKey } from '../utils/GridUtils';
import {
  WARRIOR_ABILITIES,
  MAGE_ABILITIES,
  ARCHER_ABILITIES,
  ENEMY_ABILITIES,
  cloneAbilities,
} from '../abilities/AbilityDefinitions';

export function initializeUnits(): void {
  const newUnits: Record<string, Unit> = {};
  
  // Player units
  const playerUnits: Partial<Unit>[] = [
    {
      id: 'player_warrior',
      name: 'Sir Roland',
      type: UnitType.WARRIOR,
      position: { x: 1, z: 1 },
      abilities: cloneAbilities(WARRIOR_ABILITIES),
      stats: {
        maxHealth: 120,
        currentHealth: 120,
        maxActionPoints: 6,
        currentActionPoints: 6,
        movementRange: 3,
        attackRange: 1,
        attackDamage: 20,
        defense: 15,
        initiative: 12,
      },
    },
    {
      id: 'player_mage',
      name: 'Elara',
      type: UnitType.MAGE,
      position: { x: 0, z: 2 },
      abilities: cloneAbilities(MAGE_ABILITIES),
      stats: {
        maxHealth: 80,
        currentHealth: 80,
        maxActionPoints: 8,
        currentActionPoints: 8,
        movementRange: 2,
        attackRange: 5,
        attackDamage: 15,
        defense: 5,
        initiative: 15,
      },
    },
    {
      id: 'player_archer',
      name: 'Theron',
      type: UnitType.ARCHER,
      position: { x: 2, z: 0 },
      abilities: cloneAbilities(ARCHER_ABILITIES),
      stats: {
        maxHealth: 90,
        currentHealth: 90,
        maxActionPoints: 7,
        currentActionPoints: 7,
        movementRange: 4,
        attackRange: 6,
        attackDamage: 18,
        defense: 8,
        initiative: 18,
      },
    },
  ];
  
  // Enemy units
  const enemyUnits: Partial<Unit>[] = [
    {
      id: 'enemy_skeleton_1',
      name: 'Skeleton Warrior',
      type: UnitType.ENEMY_SKELETON,
      position: { x: 8, z: 8 },
      abilities: cloneAbilities(ENEMY_ABILITIES),
      stats: {
        maxHealth: 60,
        currentHealth: 60,
        maxActionPoints: 5,
        currentActionPoints: 5,
        movementRange: 3,
        attackRange: 1,
        attackDamage: 12,
        defense: 5,
        initiative: 10,
      },
    },
    {
      id: 'enemy_skeleton_2',
      name: 'Skeleton Archer',
      type: UnitType.ENEMY_SKELETON,
      position: { x: 7, z: 9 },
      abilities: cloneAbilities(ENEMY_ABILITIES),
      stats: {
        maxHealth: 50,
        currentHealth: 50,
        maxActionPoints: 5,
        currentActionPoints: 5,
        movementRange: 2,
        attackRange: 4,
        attackDamage: 10,
        defense: 3,
        initiative: 14,
      },
    },
    {
      id: 'enemy_orc',
      name: 'Skeleton Mage',
      type: UnitType.ENEMY_MAGE,
      position: { x: 9, z: 7 },
      abilities: cloneAbilities(ENEMY_ABILITIES),
      stats: {
        maxHealth: 70,
        currentHealth: 70,
        maxActionPoints: 6,
        currentActionPoints: 6,
        movementRange: 2,
        attackRange: 5,
        attackDamage: 16,
        defense: 5,
        initiative: 12,
      },
    },
  ];
  
  // Create all units
  [...playerUnits, ...enemyUnits].forEach((unitData) => {
    const unit: Unit = {
      id: unitData.id!,
      name: unitData.name!,
      type: unitData.type!,
      team: unitData.type!.startsWith('enemy') ? Team.ENEMY : Team.PLAYER,
      position: unitData.position!,
      stats: unitData.stats!,
      abilities: unitData.abilities!,
      statusEffects: [],
      isAlive: true,
      hasActed: false,
      hasMoved: false,
    };
    
    newUnits[unit.id] = unit;
    
    // Mark tile as occupied
    const tileKey = posToKey(unit.position);
    setTiles(tileKey, 'occupiedBy', unit.id);
  });
  
  setUnits(newUnits);
}

