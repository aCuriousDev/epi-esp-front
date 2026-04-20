/**
 * Turn Actions
 *
 * Manages game start, turn progression, and phase transitions
 */

import { batch } from "solid-js";
import { produce } from "solid-js/store";
import {
  GamePhase,
  TurnPhase,
  GameMode,
  DungeonState,
  Team,
} from "../../types";
import type { UnitAssignment } from "../../types/multiplayer";
import {
  gameState,
  setGameState,
  addCombatLog,
} from "../stores/GameStateStore";
import {
  units,
  setUnits,
  getCurrentUnit,
  clearUnits,
} from "../stores/UnitsStore";
import { tiles, clearTiles } from "../stores/TilesStore";
import { initializeGrid } from "../initialization/InitGrid";
import {
  initializeUnits,
  initializeUnitsMultiplayer,
  getAllySpawnPositions,
} from "../initialization/InitUnits";
import { initializeFreeRoam } from "../initialization/InitFreeRoam";
import * as TurnManager from "../TurnManager";
import { checkGameOver } from "./CombatActions";
import { loadDungeon } from "../../services/mapStorage";
import { playTurnStartEffect } from "../vfx/VFXIntegration";
import {
  playTurnStartSound,
  playNewRoundSound,
  playAmbientMusic,
} from "../audio/SoundIntegration";

// ============================================
// GAME START
// ============================================

export function startGame(
  mode: GameMode = GameMode.COMBAT,
  mapId: string | null = null,
  dungeonId: string | null = null,
  unitAssignments?: UnitAssignment[],
): void {
  console.log("[startGame] ===== STARTING GAME =====");
  console.log("[startGame] Mode:", mode);
  console.log("[startGame] Map ID:", mapId || "default");
  console.log("[startGame] Dungeon ID:", dungeonId || "none");
  if (unitAssignments)
    console.log("[startGame] Unit assignments:", unitAssignments.length);

  clearUnits();
  clearTiles();

  if (mode === GameMode.FREE_ROAM) {
    initializeFreeRoam(mapId, unitAssignments);
  } else if (mode === GameMode.DUNGEON && dungeonId) {
    initializeDungeon(dungeonId);
  } else {
    initializeCombat(mapId, unitAssignments);
  }

  console.log(
    "[startGame] After init - Units:",
    Object.keys(units).length,
    "Tiles:",
    Object.keys(tiles).length,
  );
  console.log("[startGame] ===== GAME START COMPLETE =====");
}

// ============================================
// COMBAT INITIALIZATION
// ============================================

function initializeCombat(
  mapId: string | null = null,
  unitAssignments?: UnitAssignment[],
): void {
  console.log("[initializeCombat] Initializing grid...");
  initializeGrid(mapId);
  console.log(
    "[initializeCombat] Grid initialized, tiles:",
    Object.keys(tiles).length,
  );

  console.log(
    "[initializeCombat] Initializing all units (allies + enemies)...",
  );
  if (unitAssignments && unitAssignments.length > 0) {
    initializeUnitsMultiplayer(mapId, unitAssignments);
  } else {
    initializeUnits(mapId);
  }
  console.log(
    "[initializeCombat] All units initialized, count:",
    Object.keys(units).length,
  );

  // Phase de préparation : afficher les cases alliées pour le placement
  const allyPositions = getAllySpawnPositions(mapId);

  batch(() => {
    setGameState({
      mode: GameMode.COMBAT,
      phase: GamePhase.COMBAT_PREPARATION,
      turnPhase: TurnPhase.SELECT_UNIT,
      currentTurn: 0,
      turnOrder: [],
      currentUnitIndex: 0,
      selectedUnit: null,
      selectedAbility: null,
      highlightedTiles: allyPositions,
      pathPreview: [],
      targetableTiles: [],
      mapId,
    });

    addCombatLog(
      "Placez vos personnages sur les cases alliées, puis cliquez sur Prêt.",
      "system",
    );
  });

  console.log("[initializeCombat] Combat preparation phase started");
}

/**
 * Démarre le combat après la phase de préparation (bouton "Prêt" cliqué)
 */
export function startCombatFromPreparation(): void {
  const turnOrder = TurnManager.calculateTurnOrder(units);

  console.log(
    "[startCombatFromPreparation] Turn order:",
    TurnManager.debugTurnOrder(turnOrder, units),
  );

  // Derive the opening phase from whichever unit goes first by initiative.
  // The old code hardcoded PLAYER_TURN here, which skipped the ENEMY_TURN
  // entirely when an enemy's initiative beat the players' — the AI tick
  // never fired, manual control had nothing to grab, combat looked stuck.
  const firstUnit = turnOrder.length > 0 ? units[turnOrder[0]] : null;
  const openingPhase = TurnManager.determinePhase(firstUnit);

  batch(() => {
    setGameState({
      phase: openingPhase,
      turnPhase: TurnPhase.SELECT_UNIT,
      currentTurn: 1,
      turnOrder,
      currentUnitIndex: 0,
      selectedUnit: null,
      selectedAbility: null,
      highlightedTiles: [],
      pathPreview: [],
      targetableTiles: [],
    });

    addCombatLog("Battle begins!", "system");
  });

  // Start combat ambient music
  playAmbientMusic("combat");

  console.log("[startCombatFromPreparation] Combat started");
}

// ============================================
// TURN PROGRESSION
// ============================================

export function nextTurn(): void {
  console.log("=== nextTurn START ===");
  console.log("[nextTurn] Current index:", gameState.currentUnitIndex);
  console.log(
    "[nextTurn] Current turn order:",
    TurnManager.debugTurnOrder(gameState.turnOrder, units),
  );

  const currentUnitBefore = getCurrentUnit();
  console.log(
    "[nextTurn] Current unit before advance:",
    currentUnitBefore?.name,
  );

  // Reset all units for new round if needed
  let nextIndex = gameState.currentUnitIndex + 1;
  console.log("[nextTurn] Next index (before skip):", nextIndex);

  // Skip dead units
  while (nextIndex < gameState.turnOrder.length) {
    const unit = units[gameState.turnOrder[nextIndex]];
    console.log(
      "[nextTurn] Checking index",
      nextIndex,
      ":",
      unit?.name,
      "alive:",
      unit?.isAlive,
    );
    if (unit && unit.isAlive) break;
    nextIndex++;
  }

  console.log(
    "[nextTurn] Next index (after skip):",
    nextIndex,
    "/",
    gameState.turnOrder.length,
  );

  if (nextIndex >= gameState.turnOrder.length) {
    // Start new round - delegate to TurnManager
    const newRoundData = TurnManager.prepareNewRound(
      units,
      gameState.currentTurn,
    );

    console.log("[nextTurn] Starting new round");
    console.log(
      "[nextTurn] Old turn order:",
      TurnManager.debugTurnOrder(gameState.turnOrder, units),
    );
    console.log(
      "[nextTurn] New turn order:",
      TurnManager.debugTurnOrder(newRoundData.turnOrder, units),
    );

    batch(() => {
      // Reset all units using TurnManager
      Object.keys(units).forEach((unitId) => {
        setUnits(
          unitId,
          produce((u) => {
            TurnManager.resetUnitForNewRound(u);
          }),
        );
      });

      // Apply new state from TurnManager
      setGameState(newRoundData.stateUpdates);
    });

    // Log AFTER state is set (using the already-incremented value)
    addCombatLog(`Round ${gameState.currentTurn} begins!`, "system");
    playNewRoundSound();

    // Validate turn order
    const validation = TurnManager.validateTurnOrder(
      gameState.turnOrder,
      units,
    );
    if (!validation.valid) {
      console.error(
        "[nextTurn] Turn order validation failed:",
        validation.issues,
      );
    }
  } else {
    // Normal turn advance
    const nextUnit = units[gameState.turnOrder[nextIndex]];
    console.log(
      "[nextTurn] Normal turn advance to:",
      nextUnit?.name,
      "at index",
      nextIndex,
    );

    setGameState({
      currentUnitIndex: nextIndex,
      selectedUnit: null,
      selectedAbility: null,
      highlightedTiles: [],
      pathPreview: [],
      targetableTiles: [],
    });
  }

  // Determine phase AFTER state is committed
  updateGamePhase();

  // Play turn start VFX + sound for the new active unit
  const currentUnitAfter = getCurrentUnit();
  if (currentUnitAfter && currentUnitAfter.isAlive) {
    playTurnStartEffect(
      currentUnitAfter.position,
      currentUnitAfter.team as string,
    );
    playTurnStartSound();
  }

  console.log(
    "[nextTurn] Current unit after advance:",
    currentUnitAfter?.name,
    "team:",
    currentUnitAfter?.team,
  );
  console.log("[nextTurn] Game phase:", gameState.phase);
  console.log("=== nextTurn END ===\n");

  // Check for game over
  checkGameOver();
}

/**
 * Update game phase based on current unit
 * Separated from nextTurn for clarity
 */
function updateGamePhase(): void {
  const currentUnit = getCurrentUnit();
  const newPhase = TurnManager.determinePhase(currentUnit);

  setGameState("phase", newPhase);

  if (newPhase === GamePhase.PLAYER_TURN) {
    setGameState("turnPhase", TurnPhase.SELECT_UNIT);
  }
}

// ============================================
// END TURN
// ============================================

export function endUnitTurn(): void {
  const unit = gameState.selectedUnit ? units[gameState.selectedUnit] : null;

  console.log(
    "[endUnitTurn] Called for unit:",
    unit?.name,
    "Current index:",
    gameState.currentUnitIndex,
  );

  // If no unit is selected, still proceed to next turn (handles edge cases)
  if (!unit) {
    console.log("[endUnitTurn] No unit selected, advancing turn anyway");
    nextTurn();
    return;
  }

  batch(() => {
    setUnits(
      unit.id,
      produce((u) => {
        u.hasActed = true;
      }),
    );

    setGameState({
      selectedUnit: null,
      selectedAbility: null,
      highlightedTiles: [],
      pathPreview: [],
      targetableTiles: [],
      turnPhase: TurnPhase.END_TURN,
    });

    addCombatLog(`${unit.name} ends their turn.`, "system");
  });

  nextTurn();
}

// ============================================
// DUNGEON MODE
// ============================================

function initializeDungeon(dungeonId: string): void {
  const dungeon = loadDungeon(dungeonId);
  if (!dungeon || dungeon.roomIds.length === 0) {
    console.error("[initializeDungeon] Dungeon not found or empty:", dungeonId);
    return;
  }

  const firstRoomId = dungeon.roomIds[0];
  console.log(
    "[initializeDungeon] Starting dungeon:",
    dungeon.name,
    "- Room 1 /",
    dungeon.totalRooms,
  );

  initializeGrid(firstRoomId);
  initializeUnits(firstRoomId);

  const allyPositions = getAllySpawnPositions(firstRoomId);

  const dungeonState: DungeonState = {
    dungeonId,
    roomIds: dungeon.roomIds,
    currentRoomIndex: 0,
    totalRooms: dungeon.totalRooms,
  };

  batch(() => {
    setGameState({
      mode: GameMode.DUNGEON,
      phase: GamePhase.COMBAT_PREPARATION,
      turnPhase: TurnPhase.SELECT_UNIT,
      currentTurn: 0,
      turnOrder: [],
      currentUnitIndex: 0,
      selectedUnit: null,
      selectedAbility: null,
      highlightedTiles: allyPositions,
      pathPreview: [],
      targetableTiles: [],
      mapId: firstRoomId,
      dungeon: dungeonState,
    });

    addCombatLog(
      `Donjon: ${dungeon.name} - Salle 1/${dungeon.totalRooms}`,
      "system",
    );
    addCombatLog(
      "Placez vos personnages sur les cases alliées, puis cliquez sur Prêt.",
      "system",
    );
  });
}

/**
 * Transition to the next dungeon room.
 * Called when a player unit steps on a teleport cell.
 * All player units are moved to the next room's ally spawn positions.
 */
export function transitionToNextRoom(): void {
  const dungeon = gameState.dungeon;
  if (!dungeon) return;

  const nextRoomIndex = dungeon.currentRoomIndex + 1;
  if (nextRoomIndex >= dungeon.totalRooms) {
    // Last room: win the dungeon
    setGameState("phase", GamePhase.GAME_OVER);
    addCombatLog("Victoire ! Le donjon est terminé !", "system");
    return;
  }

  const nextRoomId = dungeon.roomIds[nextRoomIndex];
  console.log(
    "[transitionToNextRoom] Moving to room",
    nextRoomIndex + 1,
    "/",
    dungeon.totalRooms,
  );

  // Save current player units' state (HP, abilities, etc.) before clearing
  const playerUnitSnapshots = Object.values(units)
    .filter((u) => u.team === Team.PLAYER && u.isAlive)
    .map((u) => ({ ...u }));

  // Clear current state
  clearUnits();
  clearTiles();

  // Initialize new room
  initializeGrid(nextRoomId);
  initializeUnits(nextRoomId);

  // Restore player HP and state from previous room
  const allyPositions = getAllySpawnPositions(nextRoomId);
  const availablePositions = [...allyPositions];

  playerUnitSnapshots.forEach((snapshot) => {
    if (units[snapshot.id]) {
      let spawnPos = availablePositions.shift();
      if (!spawnPos) spawnPos = snapshot.position;

      setUnits(
        snapshot.id,
        produce((u) => {
          u.stats.currentHealth = snapshot.stats.currentHealth;
          u.stats.currentActionPoints = u.stats.maxActionPoints;
          u.position = spawnPos!;
          u.hasActed = false;
          u.hasMoved = false;
          u.statusEffects = snapshot.statusEffects;
        }),
      );
    }
  });

  const turnOrder = TurnManager.calculateTurnOrder(units);

  batch(() => {
    setGameState({
      phase: GamePhase.PLAYER_TURN,
      turnPhase: TurnPhase.SELECT_UNIT,
      currentTurn: 1,
      turnOrder,
      currentUnitIndex: 0,
      selectedUnit: null,
      selectedAbility: null,
      highlightedTiles: [],
      pathPreview: [],
      targetableTiles: [],
      mapId: nextRoomId,
      dungeon: {
        ...dungeon,
        currentRoomIndex: nextRoomIndex,
      },
    });

    addCombatLog(
      `Salle ${nextRoomIndex + 1}/${dungeon.totalRooms} !`,
      "system",
    );
  });
}
