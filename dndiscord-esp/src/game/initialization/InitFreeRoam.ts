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
import { resolveAllySpawns, LEGACY_FALLBACK_SPAWNS } from '../spawn/ResolveAllySpawns';

/**
 * Seed déterministe à partir d'une chaîne (ex. session ID).
 * Tous les clients qui partagent la même session obtiennent le même seed →
 * même positions de spawn, même ordre de shuffle dans getSpawnPositions.
 * Algorithme djb2 simplifié (pas crypto, juste stable et rapide).
 */
function stableHashFromString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) + s.charCodeAt(i);
    h |= 0; // Convertir en entier 32 bits
  }
  return Math.abs(h) || 1; // jamais 0
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

    // When the map comes from a campaign session node it may carry an explicit
    // spawnPoint (authored in the Campaign Manager). Prefer that over per-
    // assignment coords so all players cluster near the designated entry.
    const sessionSpawn = getSessionMapConfig()?.spawnPoint ?? null;

    // Seed stable = même sur tous les clients pour la même session.
    // Date.now() produisait des seeds différents selon l'heure d'arrivée
    // du GameStarted → positions de spawn différentes (désynchro visuelle).
    const spawnSeed = stableHashFromString(
      sessionState.session?.sessionId ?? 'default-session',
    );

    const mpSpawns = resolveAllySpawns({
      count: filtered.length,
      tiles,
      gridWidth: GRID_SIZE,
      gridHeight: GRID_SIZE,
      spawnPoint: sessionSpawn,
      seed: spawnSeed,
      legacyFallback: LEGACY_FALLBACK_SPAWNS,
    });

    filtered.forEach((assignment, i) => {
      // Priority: server-authoritative startX/Y > session spawnPoint cluster > legacy fallback
      const spawnPos =
        assignment.startX != null && assignment.startY != null
          ? { x: assignment.startX, z: assignment.startY }
          : (mpSpawns[i] ?? LEGACY_FALLBACK_SPAWNS[i % LEGACY_FALLBACK_SPAWNS.length]);
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

    const soloSpawns = resolveAllySpawns({
      count: playerUnits.length,
      tiles,
      gridWidth: GRID_SIZE,
      gridHeight: GRID_SIZE,
      spawnPoint: getSessionMapConfig()?.spawnPoint ?? null,
      seed: Date.now(),
      legacyFallback: LEGACY_FALLBACK_SPAWNS,
    });
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
