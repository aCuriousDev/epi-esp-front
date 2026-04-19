/**
 * Unit Initialization
 * 
 * Sets up all units for the game including player characters and enemies
 */

import { Unit, UnitType, Team, GridPosition } from '../../types';
import type { UnitAssignment } from '../../types/multiplayer';
import { units, setUnits } from '../stores/UnitsStore';
import { setTiles } from '../stores/TilesStore';
import { posToKey } from '../utils/GridUtils';
import {
  WARRIOR_ABILITIES,
  MAGE_ABILITIES,
  ARCHER_ABILITIES,
  ENEMY_ABILITIES,
  cloneAbilities,
} from '../abilities/AbilityDefinitions';
import { loadMap } from '../../services/mapStorage';
import { mapAssignmentToUnit } from '../utils/CharacterToUnit';
import { sessionState, isDm } from '../../stores/session.store';

/**
 * Obtient une position aléatoire depuis une liste de positions disponibles
 */
function getRandomPosition(availablePositions: { x: number; z: number }[]): { x: number; z: number } | null {
  if (availablePositions.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * availablePositions.length);
  return availablePositions[randomIndex];
}

/**
 * Obtient les zones de spawn depuis la map sauvegardée
 */
function getSpawnZones(mapId: string | null): { ally: { x: number; z: number }[]; enemy: { x: number; z: number }[] } {
  const allyZones: { x: number; z: number }[] = [];
  const enemyZones: { x: number; z: number }[] = [];

  if (!mapId) {
    return { ally: allyZones, enemy: enemyZones };
  }

  const savedMap = loadMap(mapId);
  if (!savedMap || !savedMap.spawnZones) {
    return { ally: allyZones, enemy: enemyZones };
  }

  Object.entries(savedMap.spawnZones).forEach(([key, type]) => {
    const [x, z] = key.split(',').map(Number);
    if (type === 'ally') {
      allyZones.push({ x, z });
    } else if (type === 'enemy') {
      enemyZones.push({ x, z });
    }
    // "teleport" zones are not spawn positions
  });

  return { ally: allyZones, enemy: enemyZones };
}

/**
 * Retourne les positions des cellules de spawn alliées (pour la phase de préparation)
 */
export function getAllySpawnPositions(mapId: string | null): GridPosition[] {
  return getSpawnZones(mapId).ally;
}

/** Retourne les positions des cellules de spawn ennemies (pour la phase de préparation MJ). */
export function getEnemySpawnPositions(mapId: string | null): GridPosition[] {
  return getSpawnZones(mapId).enemy;
}

const DEFAULT_ENEMIES: Array<{
  id: string;
  name: string;
  type: UnitType;
  stats: Unit["stats"];
}> = [
  {
    id: "enemy_skeleton_1",
    name: "Skeleton Warrior",
    type: UnitType.ENEMY_SKELETON,
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
    id: "enemy_skeleton_2",
    name: "Skeleton Archer",
    type: UnitType.ENEMY_SKELETON,
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
    id: "enemy_mage_1",
    name: "Skeleton Mage",
    type: UnitType.ENEMY_MAGE,
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

/**
 * Initialise les unités en multijoueur (combat) à partir des UnitAssignments backend,
 * puis ajoute un set d'ennemis par défaut.
 *
 * Les positions initiales sont choisies sur les zones de spawn (ally/enemy) si disponibles.
 * La phase COMBAT_PREPARATION permettra ensuite au MJ/joueurs d'ajuster le placement.
 */
export function initializeUnitsMultiplayer(
  mapId: string | null,
  unitAssignments: UnitAssignment[],
): void {
  const newUnits: Record<string, Unit> = {};

  const spawnZones = getSpawnZones(mapId);
  const availableAllyPositions = [...spawnZones.ally];
  const availableEnemyPositions = [...spawnZones.enemy];

  // Players from assignments. Belt-and-suspenders DM filter — backend already
  // excludes the DM, this catches stale payloads from a pre-fix deploy.
  const hubId = sessionState.hubUserId;
  const playerAssignments = unitAssignments.filter(
    (a) => !(isDm() && hubId && a.userId === hubId),
  );
  playerAssignments.forEach((assignment, i) => {
    const spawn =
      getRandomPosition(availableAllyPositions) ??
      assignment.userId
        ? { x: 1 + (i % 3) * 2, z: 1 + Math.floor(i / 3) * 2 }
        : { x: 1, z: 1 };

    // Remove chosen spawn to avoid duplicates
    const idx = availableAllyPositions.findIndex((p) => p.x === spawn.x && p.z === spawn.z);
    if (idx >= 0) availableAllyPositions.splice(idx, 1);

    const unit = mapAssignmentToUnit(assignment, spawn);
    newUnits[unit.id] = unit;
    setTiles(posToKey(unit.position), "occupiedBy", unit.id);
  });

  // Default enemies
  DEFAULT_ENEMIES.forEach((e, i) => {
    const spawn =
      getRandomPosition(availableEnemyPositions) ??
      { x: 8 + (i % 2), z: 8 + Math.floor(i / 2) };
    const idx = availableEnemyPositions.findIndex((p) => p.x === spawn.x && p.z === spawn.z);
    if (idx >= 0) availableEnemyPositions.splice(idx, 1);

    const unit: Unit = {
      id: e.id,
      name: e.name,
      type: e.type,
      team: Team.ENEMY,
      position: spawn,
      stats: e.stats,
      abilities: cloneAbilities(ENEMY_ABILITIES),
      statusEffects: [],
      isAlive: true,
      hasActed: false,
      hasMoved: false,
    };
    newUnits[unit.id] = unit;
    setTiles(posToKey(unit.position), "occupiedBy", unit.id);
  });

  setUnits(newUnits);
}

export function initializeUnits(mapId: string | null = null): void {
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
  
  // Obtenir les zones de spawn depuis la map (une seule fois pour alliés et ennemis)
  const spawnZones = getSpawnZones(mapId);
  const availableAllyPositions = [...spawnZones.ally];
  const availableEnemyPositions = [...spawnZones.enemy];
  
  console.log('[initializeUnits] Ally spawn zones loaded:', availableAllyPositions.length);
  console.log('[initializeUnits] Enemy spawn zones loaded:', availableEnemyPositions.length);
  
  // Créer les unités alliées avec placement aléatoire sur les zones "ally"
  playerUnits.forEach((unitData, index) => {
    let position: { x: number; z: number };
    
    if (availableAllyPositions.length > 0) {
      // Placer aléatoirement sur une zone alliée disponible
      const randomPos = getRandomPosition(availableAllyPositions);
      if (randomPos) {
        position = randomPos;
        // Retirer la position de la liste pour éviter les doublons
        const posIndex = availableAllyPositions.findIndex(p => p.x === randomPos.x && p.z === randomPos.z);
        if (posIndex !== -1) {
          availableAllyPositions.splice(posIndex, 1);
        }
      } else {
        // Fallback sur position par défaut si plus de zones disponibles
        position = unitData.position!;
      }
    } else {
      // Pas de zones définies, utiliser les positions par défaut
      position = unitData.position!;
    }
    
    const unit: Unit = {
      id: unitData.id!,
      name: unitData.name!,
      type: unitData.type!,
      team: Team.PLAYER,
      position,
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
  
  // Créer les unités ennemies avec placement aléatoire sur les zones "enemy"
  
  console.log('[initializeUnits] Enemy spawn zones loaded:', availableEnemyPositions.length);
  
  // Créer les unités ennemies avec placement aléatoire sur les zones "enemy"
  enemyUnits.forEach((unitData) => {
    let position: { x: number; z: number };
    
    if (availableEnemyPositions.length > 0) {
      // Placer aléatoirement sur une zone ennemie disponible
      const randomPos = getRandomPosition(availableEnemyPositions);
      if (randomPos) {
        position = randomPos;
        // Retirer la position de la liste pour éviter les doublons
        const posIndex = availableEnemyPositions.findIndex(p => p.x === randomPos.x && p.z === randomPos.z);
        if (posIndex !== -1) {
          availableEnemyPositions.splice(posIndex, 1);
        }
      } else {
        // Fallback sur position par défaut si plus de zones disponibles
        position = unitData.position!;
      }
    } else {
      // Pas de zones définies, utiliser les positions par défaut
      position = unitData.position!;
    }
    
    const unit: Unit = {
      id: unitData.id!,
      name: unitData.name!,
      type: unitData.type!,
      team: Team.ENEMY,
      position,
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

/**
 * Crée uniquement les unités ennemies (appelé au démarrage du combat)
 */
export function initializeEnemies(mapId: string | null = null): void {
  const existingUnits = { ...units };
  const newUnits: Record<string, Unit> = {};
  
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
  
  // Obtenir les zones de spawn ennemies depuis la map
  const spawnZones = getSpawnZones(mapId);
  const availableEnemyPositions = [...spawnZones.enemy];
  
  console.log('[initializeEnemies] Enemy spawn zones loaded:', availableEnemyPositions.length);
  
  // Créer les unités ennemies avec placement aléatoire sur les zones "enemy"
  enemyUnits.forEach((unitData) => {
    let position: { x: number; z: number };
    
    if (availableEnemyPositions.length > 0) {
      // Placer aléatoirement sur une zone ennemie disponible
      const randomPos = getRandomPosition(availableEnemyPositions);
      if (randomPos) {
        position = randomPos;
        // Retirer la position de la liste pour éviter les doublons
        const posIndex = availableEnemyPositions.findIndex(p => p.x === randomPos.x && p.z === randomPos.z);
        if (posIndex !== -1) {
          availableEnemyPositions.splice(posIndex, 1);
        }
      } else {
        // Fallback sur position par défaut si plus de zones disponibles
        position = unitData.position!;
      }
    } else {
      // Pas de zones définies, utiliser les positions par défaut
      position = unitData.position!;
    }
    
    const unit: Unit = {
      id: unitData.id!,
      name: unitData.name!,
      type: unitData.type!,
      team: Team.ENEMY,
      position,
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
  
  // Ajouter les ennemis aux unités existantes (sans écraser les alliés)
  Object.assign(existingUnits, newUnits);
  setUnits(existingUnits);
}

