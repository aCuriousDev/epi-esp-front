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
import { sessionState, isDm } from '../../stores/session.store';
import { getSpawnPositions } from '../spawn/Placement';
import { buildSessionCluster } from '../spawn/SessionSpawnCluster';

const LEGACY_FALLBACK_SPAWNS: GridPosition[] = [
  { x: 1, z: 1 },
  { x: 1, z: 3 },
  { x: 3, z: 1 },
  { x: 3, z: 3 },
  { x: 5, z: 1 },
  { x: 5, z: 3 },
];

/**
 * Priority chain for ally spawn in solo / story-tree free-roam:
 *   1. session-map.spawnPoint → cluster around the DM-authored anchor
 *   2. rule-based Placement band (our algorithm)
 *   3. LEGACY_FALLBACK_SPAWNS (last resort when grid empty / fully blocked)
 *
 * Each step appends to `picked` until count is met, so a partial cluster
 * (e.g. spawnPoint near a wall) still hands off to Placement cleanly.
 */
function resolveAllySpawns(count: number): GridPosition[] {
  if (count <= 0) return [];
  const picked: GridPosition[] = [];

  const cfg = getSessionMapConfig();
  if (cfg?.spawnPoint) {
    const cluster = buildSessionCluster({
      point: cfg.spawnPoint,
      count,
      gridWidth: GRID_SIZE,
      gridHeight: GRID_SIZE,
      tiles,
    });
    picked.push(...cluster);
    if (cluster.length < count && cluster.length === 0) {
      console.warn(
        '[resolveAllySpawns] session-map spawnPoint yielded no walkable cells; falling through to rule-based placement',
        cfg.spawnPoint,
      );
    }
  }

  if (picked.length < count) {
    const claimed = new Set(picked.map(p => `${p.x},${p.z}`));
    const ruleBased = getSpawnPositions({
      tiles,
      team: 'ally',
      count: count - picked.length,
      gridWidth: GRID_SIZE,
      gridHeight: GRID_SIZE,
      seed: Date.now(),
    });
    for (const p of ruleBased) {
      if (picked.length >= count) break;
      const k = `${p.x},${p.z}`;
      if (!claimed.has(k)) {
        picked.push(p);
        claimed.add(k);
      }
    }
  }

  if (picked.length < count) {
    const claimed = new Set(picked.map(p => `${p.x},${p.z}`));
    for (const p of LEGACY_FALLBACK_SPAWNS) {
      if (picked.length >= count) break;
      const k = `${p.x},${p.z}`;
      if (!claimed.has(k)) {
        picked.push(p);
        claimed.add(k);
      }
    }
  }

  return picked;
}

export function initializeFreeRoam(mapId: string | null = null, unitAssignments?: UnitAssignment[]): void {
  console.log('[initializeFreeRoam] Starting Free Roam initialization...');

  // Pre-set mapId before initializeGrid so the GameCanvas createEffect sees
  // the correct mapId when it reacts to the setTiles call inside initializeGrid.
  setGameState('mapId', mapId);

  console.log('[initializeFreeRoam] Initializing grid...');
  initializeGrid(mapId);
  console.log('[initializeFreeRoam] Grid initialized');

  const newUnits: Record<string, Unit> = {};
  console.log('[initializeFreeRoam] Creating player units...');

  if (unitAssignments !== undefined) {
    // Multiplayer: server-authoritative assignments. Empty array means
    // multiplayer with no non-DM players yet (BUG-K), still go this branch.
    const hubId = sessionState.hubUserId;
    const filtered = unitAssignments.filter(
      (a) => !(isDm() && hubId && a.userId === hubId),
    );
    filtered.forEach((assignment, i) => {
      const spawnPos =
        assignment.startX != null && assignment.startY != null
          ? { x: assignment.startX, z: assignment.startY }
          : LEGACY_FALLBACK_SPAWNS[i % LEGACY_FALLBACK_SPAWNS.length];
      const unit = mapAssignmentToUnit(assignment, spawnPos);
      newUnits[unit.id] = unit;

      const tileKey = posToKey(unit.position);
      if (tiles[tileKey]) setTiles(tileKey, 'occupiedBy', unit.id);
    });
  } else {
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
      if (tiles[tileKey]) setTiles(tileKey, 'occupiedBy', unit.id);
    });
  }

  console.log('[initializeFreeRoam] Created', Object.keys(newUnits).length, 'player units');
  setUnits(newUnits);
  console.log('[initializeFreeRoam] Units set in store');

  console.log('[initializeFreeRoam] Setting game state...');
  setGameState({
    mode: GameMode.FREE_ROAM,
    phase: GamePhase.FREE_ROAM,
    turnPhase: undefined as any,
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

  playAmbientMusic('exploration');
}
