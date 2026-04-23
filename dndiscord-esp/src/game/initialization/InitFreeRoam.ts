/**
 * Free Roam Initialization
 * 
 * Sets up the game for Free Roam mode - no enemies, no turn system
 */

import { Unit, UnitType, Team, GameMode, GamePhase, GridPosition } from '../../types';
import { GRID_SIZE } from '../constants';
import type { UnitAssignment } from '../../types/multiplayer';
import { setUnits } from '../stores/UnitsStore';
import { setTiles, tiles } from '../stores/TilesStore';
import { posToKey } from '../utils/GridUtils';
import { setGameState } from '../stores/GameStateStore';
import { initializeGrid } from './InitGrid';
import { playAmbientMusic } from '../audio/SoundIntegration';
import { getSessionMapConfig } from '../../stores/session-map.store';
import {
  WARRIOR_ABILITIES,
  MAGE_ABILITIES,
  ARCHER_ABILITIES,
  cloneAbilities,
} from '../abilities/AbilityDefinitions';
import { mapAssignmentToUnit } from '../utils/CharacterToUnit';

const DEFAULT_SPAWN_POSITIONS: GridPosition[] = [
  { x: 1, z: 1 },
  { x: 1, z: 3 },
  { x: 3, z: 1 },
  { x: 3, z: 3 },
  { x: 5, z: 1 },
  { x: 5, z: 3 },
];

/**
 * Returns the spawn positions for free roam — uses the campaign MapNode's spawnPoint
 * as the primary position (offset by small deltas for multi-unit placement) when a
 * session map config is active, otherwise falls back to hardcoded defaults.
 */
function getSpawnPositions(): GridPosition[] {
  const cfg = getSessionMapConfig();
  if (cfg?.spawnPoint) {
    const { x, z } = cfg.spawnPoint;
    // Place the party in a small cluster around the designated spawn point
    const candidates: GridPosition[] = [
      { x,         z         },
      { x: x + 1,  z         },
      { x,         z: z + 1  },
      { x: x + 1,  z: z + 1  },
      { x: x - 1,  z         },
      { x,         z: z - 1  },
    ];
    return candidates.filter(p => p.x >= 0 && p.z >= 0 && p.x < GRID_SIZE && p.z < GRID_SIZE);
  }
  return DEFAULT_SPAWN_POSITIONS;
}

export function initializeFreeRoam(mapId: string | null = null, unitAssignments?: UnitAssignment[]): void {
  console.log('[initializeFreeRoam] Starting Free Roam initialization...');
  
  // Initialize the grid (reuse existing logic)
  // Pre-set mapId before initializeGrid so the GameCanvas createEffect sees the
  // correct mapId when it reacts to the setTiles call inside initializeGrid.
  setGameState('mapId', mapId);

  console.log('[initializeFreeRoam] Initializing grid...');
  initializeGrid(mapId);
  console.log('[initializeFreeRoam] Grid initialized');

  const newUnits: Record<string, Unit> = {};
  console.log('[initializeFreeRoam] Creating player units...');

  const spawnPositions = getSpawnPositions();

  if (unitAssignments && unitAssignments.length > 0) {
    // Multiplayer: create units from server-provided assignments
    unitAssignments.forEach((assignment, i) => {
      const spawnPos = spawnPositions[i % spawnPositions.length];
      const unit = mapAssignmentToUnit(assignment, spawnPos);
      newUnits[unit.id] = unit;

      const tileKey = posToKey(unit.position);
      if (tiles[tileKey]) setTiles(tileKey, 'occupiedBy', unit.id);
    });
  } else {
    // Solo: default 3 hardcoded units
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

    playerUnits.forEach((unitData, i) => {
      // Use the session spawn point when available (set by CampaignSessionPage),
      // otherwise fall back to the hardcoded default position for this unit.
      const position = spawnPositions.length > 0
        ? spawnPositions[i % spawnPositions.length]
        : unitData.position!;

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

      const tileKey = posToKey(unit.position);
      if (tiles[tileKey]) setTiles(tileKey, 'occupiedBy', unit.id);
    });
  }

  console.log('[initializeFreeRoam] Created', Object.keys(newUnits).length, 'player units');
  setUnits(newUnits);
  console.log('[initializeFreeRoam] Units set in store');

  // Set Free Roam game state - no turn order, no turn system
  console.log('[initializeFreeRoam] Setting game state...');
  setGameState({
    mode: GameMode.FREE_ROAM,
    phase: GamePhase.FREE_ROAM,
    turnPhase: undefined as any, // Not used in Free Roam
    currentTurn: 0,
    turnOrder: [],
    currentUnitIndex: 0,
    selectedUnit: null,
    selectedAbility: null,
    highlightedTiles: [],
    pathPreview: [],
    targetableTiles: [],
    combatLog: [],
    mapId,
  });

  console.log('[initializeFreeRoam] Free Roam mode initialized - Units:', Object.keys(newUnits).length, 'Tiles:', Object.keys(tiles).length);

  // Start exploration ambient music
  playAmbientMusic('exploration');
}

