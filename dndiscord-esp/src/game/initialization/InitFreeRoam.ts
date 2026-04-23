/**
 * Free Roam Initialization
 * 
 * Sets up the game for Free Roam mode - no enemies, no turn system
 */

import { Unit, UnitType, Team, GameMode, GamePhase, GridPosition } from '../../types';
import type { UnitAssignment } from '../../types/multiplayer';
import { setUnits } from '../stores/UnitsStore';
import { setTiles, tiles } from '../stores/TilesStore';
import { posToKey } from '../utils/GridUtils';
import { setGameState } from '../stores/GameStateStore';
import { initializeGrid } from './InitGrid';
import { playAmbientMusic } from '../audio/SoundIntegration';
import {
  WARRIOR_ABILITIES,
  MAGE_ABILITIES,
  ARCHER_ABILITIES,
  cloneAbilities,
} from '../abilities/AbilityDefinitions';
import { mapAssignmentToUnit } from '../utils/CharacterToUnit';
import { sessionState, isDm } from '../../stores/session.store';
import { GRID_SIZE } from '../constants';
import { getSpawnPositions } from '../spawn/Placement';

const LEGACY_FALLBACK_SPAWNS: GridPosition[] = [
  { x: 1, z: 1 },
  { x: 1, z: 3 },
  { x: 3, z: 1 },
  { x: 3, z: 3 },
  { x: 5, z: 1 },
  { x: 5, z: 3 },
];

function resolveAllySpawns(count: number): GridPosition[] {
  const picked = getSpawnPositions({
    tiles,
    team: 'ally',
    count,
    gridWidth: GRID_SIZE,
    gridHeight: GRID_SIZE,
    seed: Date.now(),
  });
  if (picked.length >= count) return picked;
  // Final safety net when the grid is empty or entirely blocked — keep the
  // legacy anchors so the init doesn't hand back fewer positions than units.
  const filler = LEGACY_FALLBACK_SPAWNS.slice(0, count - picked.length);
  return [...picked, ...filler];
}

export function initializeFreeRoam(mapId: string | null = null, unitAssignments?: UnitAssignment[]): void {
  console.log('[initializeFreeRoam] Starting Free Roam initialization...');
  
  // Initialize the grid (reuse existing logic)
  console.log('[initializeFreeRoam] Initializing grid...');
  initializeGrid(mapId);
  console.log('[initializeFreeRoam] Grid initialized');

  const newUnits: Record<string, Unit> = {};
  console.log('[initializeFreeRoam] Creating player units...');

  if (unitAssignments !== undefined) {
    // Multiplayer: create units from server-provided assignments. The gate
    // is "caller passed an array" — even an empty array means multiplayer
    // (DM-alone session, or a map switch whose session has no non-DM
    // players yet). The previous `length > 0` guard fell into the solo
    // branch on `[]` and stamped Sir Roland / Elara / Theron onto every
    // empty multiplayer reset (BUG-K).
    // Belt-and-suspenders: drop any assignment that happens to match the DM
    // (the backend already filters, this catches a stale pre-fix payload).
    const hubId = sessionState.hubUserId;
    const filtered = unitAssignments.filter(
      (a) => !(isDm() && hubId && a.userId === hubId),
    );
    filtered.forEach((assignment, i) => {
      // Utiliser la position fournie par le serveur si disponible, sinon fallback local.
      const spawnPos =
        assignment.startX != null && assignment.startY != null
          ? { x: assignment.startX, z: assignment.startY }
          : LEGACY_FALLBACK_SPAWNS[i % LEGACY_FALLBACK_SPAWNS.length];
      const unit = mapAssignmentToUnit(assignment, spawnPos);
      newUnits[unit.id] = unit;

      const tileKey = posToKey(unit.position);
      setTiles(tileKey, 'occupiedBy', unit.id);
    });
  } else {
    // Solo: default 3 hardcoded units
    const playerUnits: Partial<Unit>[] = [
      {
        id: 'player_warrior',
        name: 'Sir Roland',
        type: UnitType.WARRIOR,
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

    const soloSpawns = resolveAllySpawns(playerUnits.length);
    playerUnits.forEach((unitData, i) => {
      unitData.position = soloSpawns[i] ?? LEGACY_FALLBACK_SPAWNS[i % LEGACY_FALLBACK_SPAWNS.length];
    });

    playerUnits.forEach((unitData) => {
      const unit: Unit = {
        id: unitData.id!,
        name: unitData.name!,
        type: unitData.type!,
        team: Team.PLAYER,
        position: unitData.position!,
        stats: unitData.stats!,
        abilities: unitData.abilities!,
        statusEffects: [],
        isAlive: true,
        hasActed: false,
        hasMoved: false,
      };

      newUnits[unit.id] = unit;

      const tileKey = posToKey(unit.position);
      setTiles(tileKey, 'occupiedBy', unit.id);
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

