import { Component, onMount, onCleanup, createEffect, createSignal, untrack } from 'solid-js';
import { BabylonEngine } from '../engine/BabylonEngine';
import {
  gameState,
  setGameState,
  tiles,
  setTiles,
  units,
  setUnits,
  selectUnit,
  previewPath,
  moveUnit,
  useAbility,
  executeEnemyTurn,
  posToKey,
  getIsFreeRoamMode,
  getEnemyUnits,
  getCurrentUnit,
  getAllySpawnPositions,
  updatePathfinder,
} from '../game';
import { produce } from 'solid-js/store';
import { setVFXEngine } from '../game/vfx/VFXIntegration';
import { SoundManager } from '../engine/audio/SoundManager';
import { setSoundEngine } from '../game/audio/SoundIntegration';
import { soundSettings } from '../stores/sound.store';
import { isHost as getIsHost, isDm } from '../stores/session.store';
import { dmDragUnit, setDmDragUnit, dmSpawnTemplate, setDmSpawnTemplate, dmActiveMode, setDmInspectedUnit } from '../stores/dmTools.store';
import { GamePhase, TurnPhase, Team, Unit, GridPosition, GameMode } from '../types';

let engineInstance: BabylonEngine | null = null;
let soundInstance: SoundManager | null = null;
let lastExecutedEnemyIndex: number | null = null;

// Export loading state as a signal
export const [isEngineReady, setIsEngineReady] = createSignal(false);

export const GameCanvas: Component = () => {
  let canvasRef: HTMLCanvasElement | undefined;
  
  onMount(async () => {
    if (!canvasRef) return;
    
    console.log('[GameCanvas] ===== COMPONENT MOUNTING =====');
    console.log('[GameCanvas] Existing engine:', !!engineInstance);
    console.log('[GameCanvas] Canvas ref:', !!canvasRef);
    
    // If there's an existing engine, dispose it first to prevent memory leaks and ghost meshes
    if (engineInstance) {
      console.log('[GameCanvas] WARNING: Found existing engine! Disposing...');
      try {
        // First clear all objects
        engineInstance.clearAll();
        // Then dispose the engine
        engineInstance.dispose();
        console.log('[GameCanvas] Existing engine disposed');
      } catch (e) {
        console.error('[GameCanvas] Error disposing existing engine:', e);
      }
      engineInstance = null;
    }
    
    // Reset the ready signal
    setIsEngineReady(false);
    
    // Clear previous positions map for fresh start
    prevPositions.clear();
    console.log('[GameCanvas] Previous positions cleared, ready for fresh start');
    
    console.log('[GameCanvas] Creating new BabylonEngine...');
    // Create Babylon engine
    engineInstance = new BabylonEngine(canvasRef);
    setVFXEngine(engineInstance);

    // Create Sound engine
    soundInstance = new SoundManager();
    soundInstance.ambientVolume = soundSettings.musicVolume();
    soundInstance.sfxVolume = soundSettings.sfxVolume();
    setSoundEngine(soundInstance);
    
    // Setup click handlers
    engineInstance.setOnTileClick((pos) => {
      handleTileClick(pos.x, pos.z);
    });
    
    engineInstance.setOnTileHover((pos) => {
      handleTileHover(pos.x, pos.z);
    });
    
    engineInstance.setOnUnitClick((unitId) => {
      handleUnitClick(unitId);
    });
    
    // Start render loop
    engineInstance.startRenderLoop();
    
    // Wait for all models to preload
    await engineInstance.waitForReady();
    setIsEngineReady(true);
    console.log('[GameCanvas] Engine ready, models preloaded');
  });
  
  onCleanup(() => {
    console.log('[GameCanvas] ===== COMPONENT UNMOUNTING =====');
    console.log('[GameCanvas] Engine instance exists:', !!engineInstance);
    console.log('[GameCanvas] prevPositions size:', prevPositions.size);
    
    if (engineInstance) {
      console.log('[GameCanvas] Disposing engine...');
      try {
        setVFXEngine(null);
        engineInstance.dispose();
        console.log('[GameCanvas] Engine disposed successfully');
      } catch (e) {
        console.error('[GameCanvas] Error disposing engine:', e);
      }
      engineInstance = null;
    }
    if (soundInstance) {
      setSoundEngine(null);
      soundInstance.dispose();
      soundInstance = null;
    }
    setIsEngineReady(false);
    prevPositions.clear();
    console.log('[GameCanvas] ===== CLEANUP COMPLETE =====');
  });

  // Sync sound settings reactively
  createEffect(() => {
    if (!soundInstance) return;
    soundInstance.ambientVolume = soundSettings.musicEnabled() ? soundSettings.musicVolume() : 0;
    soundInstance.sfxVolume = soundSettings.sfxEnabled() ? soundSettings.sfxVolume() : 0;
  });
  
  // Create grid when tiles change (only after engine is ready)
  createEffect(() => {
    const tileCount = Object.keys(tiles).length;
    const currentMapId = gameState.mapId;
    console.log('[GameCanvas] Tiles effect triggered - Count:', tileCount, 'Engine ready:', isEngineReady(), 'MapId:', currentMapId);
    
    if (engineInstance && isEngineReady() && tileCount > 0) {
      console.log('[GameCanvas] Creating grid with', tileCount, 'tiles', currentMapId ? `using map: ${currentMapId}` : 'using default map');
      // Grid creation is now async due to 3D model loading
      engineInstance.createGrid(tiles, currentMapId).then(() => {
        console.log('[GameCanvas] Grid creation complete');
      }).catch(error => {
        console.error('[GameCanvas] Failed to create grid:', error);
      });
    }
  });
  
  // Track previous unit positions for movement animation
  const prevPositions = new Map<string, GridPosition>();
  
  // Lock to prevent concurrent effect execution
  let isProcessingUnits = false;
  let pendingRerun = false;
  
  // Clear engine and previous positions when stores are cleared (for restart)
  createEffect(() => {
    const unitCount = Object.keys(units).length;
    const tileCount = Object.keys(tiles).length;
    
    // If both stores are empty and we had data before, clear the engine's game objects
    // This handles the "restart" case where the component stays mounted
    if (unitCount === 0 && tileCount === 0 && prevPositions.size > 0 && engineInstance) {
      console.log('[GameCanvas] Stores cleared (restart detected) - clearing engine game objects');
      engineInstance.clearAll();
      prevPositions.clear();
      console.log('[GameCanvas] Engine game objects and previous positions cleared');
    }
  });
  
  // Unified unit management: create/update units when units change (only after engine is ready)
  // CRITICAL: SolidJS only tracks dependencies accessed SYNCHRONOUSLY in the effect body.
  // We must access unit positions in the sync part to trigger re-runs when positions change.
  createEffect(() => {
    // Build a snapshot of all unit data SYNCHRONOUSLY to set up proper reactivity tracking
    // This ensures the effect re-runs when ANY unit's position changes
    const unitIds = Object.keys(units);
    const unitSnapshots: Array<{
      id: string;
      unit: Unit;
      currentPos: GridPosition;
    }> = [];
    
    for (const id of unitIds) {
      const unit = units[id];
      if (unit) {
        // IMPORTANT: Accessing unit.position.x and unit.position.z here sets up reactive tracking!
        const currentPos = { x: unit.position.x, z: unit.position.z };
        unitSnapshots.push({ id, unit, currentPos });
      }
    }
    
    if (!engineInstance || !isEngineReady()) return;
    if (isProcessingUnits) {
      pendingRerun = true;
      return;
    }
    
    // Process units sequentially to handle async model loading
    // Use the snapshot data captured synchronously above
    isProcessingUnits = true;
    pendingRerun = false;
    (async () => {
      try {
        for (const { id, unit, currentPos } of unitSnapshots) {
          const exists = engineInstance.hasUnit(id);
          const prevPos = prevPositions.get(id);
          
          if (!exists) {
            await engineInstance.createUnit(unit);
            // After async load, check if position changed in the store while loading
            // (e.g. DM moved the unit right after spawning it)
            const liveUnit = units[id];
            if (liveUnit && (liveUnit.position.x !== currentPos.x || liveUnit.position.z !== currentPos.z)) {
              engineInstance.updateUnit(liveUnit);
              prevPositions.set(id, { x: liveUnit.position.x, z: liveUnit.position.z });
            } else {
              prevPositions.set(id, { ...currentPos });
            }
          } else {
            const positionChanged = prevPos && (prevPos.x !== currentPos.x || prevPos.z !== currentPos.z);
            if (positionChanged) {
              engineInstance.updateUnit(unit);
              prevPositions.set(id, { ...currentPos });
            }
            // Skip updateUnit when position hasn't changed to avoid
            // animation stacking that causes units to float upward
          }
        }
        
        // Mettre à jour la visibilité des ennemis après création/mise à jour des unités
        const phase = gameState.phase;
        const enemyUnits = getEnemyUnits();
        const enemyUnitIds = enemyUnits.map(u => u.id);
        const shouldBeVisible = phase !== GamePhase.COMBAT_PREPARATION;
        
        if (enemyUnitIds.length > 0 && engineInstance) {
          engineInstance.setEnemyVisibility(shouldBeVisible, enemyUnitIds);
        }
      } finally {
        isProcessingUnits = false;
        // If the effect was triggered while we were processing, re-process now
        // to pick up any units that were missed (e.g. DM spawned while processing)
        if (pendingRerun) {
          pendingRerun = false;
          const freshIds = Object.keys(units);
          for (const id of freshIds) {
            const u = units[id];
            if (u && !engineInstance.hasUnit(id)) {
              await engineInstance.createUnit(u);
              prevPositions.set(id, { x: u.position.x, z: u.position.z });
            }
          }
          // Update visibility for any freshly created enemies
          const freshPhase = gameState.phase;
          const freshEnemies = getEnemyUnits();
          const freshEnemyIds = freshEnemies.map(u => u.id);
          const freshVisible = freshPhase !== GamePhase.COMBAT_PREPARATION;
          if (freshEnemyIds.length > 0 && engineInstance) {
            engineInstance.setEnemyVisibility(freshVisible, freshEnemyIds);
          }
        }
      }
    })();
  });
  
  // Gérer la visibilité des ennemis selon la phase du jeu
  // NOTE: Only reacts to phase changes. Unit creation already handles visibility
  // inside the async processing loop above (after meshes are created).
  createEffect(() => {
    if (!engineInstance || !isEngineReady()) return;
    
    const phase = gameState.phase;
    
    const enemyUnits = getEnemyUnits();
    const enemyUnitIds = enemyUnits.map(u => u.id);
    
    console.log(`[GameCanvas] Visibility effect triggered - Phase: ${phase}, Enemy count: ${enemyUnitIds.length}`);
    
    // En phase de préparation : rendre les ennemis invisibles
    // Sinon : rendre les ennemis visibles
    const shouldBeVisible = phase !== GamePhase.COMBAT_PREPARATION;
    
    if (enemyUnitIds.length > 0) {
      console.log(`[GameCanvas] Setting enemy visibility to ${shouldBeVisible ? 'VISIBLE' : 'INVISIBLE'} for ${enemyUnitIds.length} enemies`);
      engineInstance.setEnemyVisibility(shouldBeVisible, enemyUnitIds);
    } else {
      console.warn(`[GameCanvas] No enemy units found for visibility update`);
    }
  });

  // Gérer l'indicateur de ping pour montrer quelle unité doit jouer
  // Le ping disparaît dès qu'une action est effectuée (déplacement ou sort)
  let previousCurrentUnitId: string | null = null;
  let previousCurrentUnitPosition: GridPosition | null = null;
  let previousCurrentUnitAP: number | null = null;
  
  createEffect(() => {
    if (!engineInstance || !isEngineReady()) return;
    
    // Surveiller la phase et l'index de l'unité actuelle
    const phase = gameState.phase;
    const currentUnitIndex = gameState.currentUnitIndex;
    const turnOrder = gameState.turnOrder;
    
    // Ne montrer le ping que pendant les phases de combat (pas en préparation)
    if (phase === GamePhase.COMBAT_PREPARATION || phase === GamePhase.SETUP || phase === GamePhase.GAME_OVER) {
      engineInstance.updateTurnIndicator(null);
      previousCurrentUnitId = null;
      previousCurrentUnitPosition = null;
      previousCurrentUnitAP = null;
      return;
    }
    
    // Obtenir l'unité actuelle
    const currentUnit = getCurrentUnit();
    
    if (!currentUnit || !currentUnit.isAlive) {
      engineInstance.updateTurnIndicator(null);
      previousCurrentUnitId = null;
      previousCurrentUnitPosition = null;
      previousCurrentUnitAP = null;
      return;
    }
    
    // Vérifier si c'est une nouvelle unité (nouveau tour)
    const isNewUnit = currentUnit.id !== previousCurrentUnitId;
    
    // Vérifier si l'unité a effectué une action :
    // - Position a changé (déplacement)
    // - Action points ont diminué (sort ou déplacement)
    const positionChanged = previousCurrentUnitPosition && 
      (previousCurrentUnitPosition.x !== currentUnit.position.x || 
       previousCurrentUnitPosition.z !== currentUnit.position.z);
    const apDecreased = previousCurrentUnitAP !== null && 
      currentUnit.stats.currentActionPoints < previousCurrentUnitAP;
    
    // Si c'est une nouvelle unité, afficher le ping
    if (isNewUnit) {
      engineInstance.updateTurnIndicator(currentUnit.id);
      previousCurrentUnitId = currentUnit.id;
      previousCurrentUnitPosition = { ...currentUnit.position };
      previousCurrentUnitAP = currentUnit.stats.currentActionPoints;
    } 
    // Si l'unité a effectué une action, cacher le ping
    else if (positionChanged || apDecreased) {
      engineInstance.updateTurnIndicator(null);
      // Garder les valeurs pour éviter de réafficher le ping
      previousCurrentUnitPosition = { ...currentUnit.position };
      previousCurrentUnitAP = currentUnit.stats.currentActionPoints;
    }
    // Sinon, mettre à jour les valeurs de suivi
    else {
      previousCurrentUnitPosition = { ...currentUnit.position };
      previousCurrentUnitAP = currentUnit.stats.currentActionPoints;
    }
  });
  
  // Surveiller les changements de HP pour afficher les dégâts
  const previousUnitHealth: Map<string, number> = new Map();
  
  createEffect(() => {
    if (!engineInstance || !isEngineReady()) return;
    const engine = engineInstance;

    // Surveiller toutes les unités pour détecter les changements de HP
    Object.keys(units).forEach(unitId => {
      const unit = units[unitId];
      if (!unit) return;

      const previousHP = previousUnitHealth.get(unitId);
      const currentHP = unit.stats.currentHealth;

      // Si l'HP a diminué, afficher les dégâts
      if (previousHP !== undefined && previousHP > currentHP && previousHP > 0) {
        const damage = previousHP - currentHP;
        if (damage > 0) {
          engine.showDamageNumber(unitId, damage);
        }
      }
      
      // Mettre à jour la valeur précédente
      previousUnitHealth.set(unitId, currentHP);
    });
  });
  
  // When DM activates a tool mode, clear game selection & show all tiles as highlighted
  createEffect(() => {
    const mode = dmActiveMode();
    const dragId = dmDragUnit();
    const spawnTpl = dmSpawnTemplate();

    if (!mode) return; // not in DM mode — don't touch game state

    // Clear normal game selection
    setGameState('selectedUnit', null);

    // When DM has a unit or spawn template selected, highlight ALL tiles on the map
    if (dragId || spawnTpl) {
      const allPositions = untrack(() =>
        Object.values(tiles)
          .filter((t) => t && t.position)
          .map((t) => ({ x: t.position.x, z: t.position.z }))
      );
      setGameState('highlightedTiles', allPositions);
    } else {
      setGameState('highlightedTiles', []);
    }
  });

  // En phase de préparation, s'assurer que toutes les cases alliées sont toujours visibles
  createEffect(() => {
    if (gameState.phase === GamePhase.COMBAT_PREPARATION && !gameState.selectedUnit && !dmActiveMode()) {
      const allyPositions = getAllySpawnPositions(gameState.mapId);
      if (allyPositions.length > 0 && JSON.stringify(gameState.highlightedTiles) !== JSON.stringify(allyPositions)) {
        setGameState('highlightedTiles', allyPositions);
      }
    }
  });

  // Update highlights when highlighted tiles change
  createEffect(() => {
    if (!engineInstance) return;
    
    const highlighted = gameState.highlightedTiles;
    const targetable = gameState.targetableTiles;
    
    if (targetable.length > 0) {
      engineInstance.showTargetRange(targetable);
    } else if (highlighted.length > 0) {
      engineInstance.showMovementRange(highlighted);
    } else {
      engineInstance.clearHighlights();
    }
  });
  
  // Update path preview
  createEffect(() => {
    if (!engineInstance) return;
    
    const path = gameState.pathPreview;
    if (path.length > 0) {
      engineInstance.showPathPreview(path);
    } else {
      engineInstance.clearPathPreview();
    }
  });
  
  // Selection pulse VFX - pulsing ring under selected unit
  createEffect(() => {
    if (!engineInstance) return;
    
    const selectedId = gameState.selectedUnit;
    if (selectedId && units[selectedId]) {
      const unit = units[selectedId];
      engineInstance.showSelectionPulse(unit.position, unit.team as string);
    } else {
      engineInstance.clearSelectionPulse();
    }
  });
  
  // Toggle post-processing combat mode based on game mode
  createEffect(() => {
    if (!engineInstance) return;
    const isCombat = gameState.mode === GameMode.COMBAT;
    engineInstance.setCombatMode(isCombat);
  });
  
  // Handle enemy turn
  let enemyTurnTimeout: number | null = null;
  
  createEffect(() => {
    // Track both phase and currentUnitIndex to trigger on each new enemy unit
    const isEnemyTurn = gameState.phase === GamePhase.ENEMY_TURN;
    const currentIndex = gameState.currentUnitIndex;
    
    // Clear any pending timeout when phase or index changes
    if (enemyTurnTimeout !== null) {
      clearTimeout(enemyTurnTimeout);
      enemyTurnTimeout = null;
    }
    
    // Only execute if it's enemy turn and we haven't executed this specific index yet
    if (isEnemyTurn && lastExecutedEnemyIndex !== currentIndex) {
      lastExecutedEnemyIndex = currentIndex;
      enemyTurnTimeout = setTimeout(async () => {
        // Double-check we're still in enemy turn before executing
        if (gameState.phase === GamePhase.ENEMY_TURN && gameState.currentUnitIndex === currentIndex) {
          await executeEnemyTurn();
        }
        enemyTurnTimeout = null;
      }, 500) as unknown as number;
    } else if (!isEnemyTurn) {
      // Reset when it's player turn
      lastExecutedEnemyIndex = null;
    }
  });
  
  function handleTileClick(x: number, z: number): void {
    const pos = { x, z };
    const tileKey = posToKey(pos);
    const tile = tiles[tileKey];
    
    if (!tile) return;

    // --- DM tool mode: block normal game logic, only handle DM actions ---
    if (dmActiveMode()) {
      const dragId = dmDragUnit();
      if (dragId) {
        const unit = units[dragId];
        if (unit) {
          import('../services/signalr/multiplayer.service').then(({ dmMoveToken }) => {
            dmMoveToken({ unitId: dragId, target: { x: pos.x, y: pos.z } as any });
          }).catch(err => console.warn('[DM] move broadcast failed:', err));
          const oldKey = posToKey(unit.position);
          if (tiles[oldKey]) setTiles(oldKey, 'occupiedBy', null);
          setTiles(tileKey, 'occupiedBy', dragId);
          setUnits(dragId, produce((u: any) => { u.position = pos; }));
          updatePathfinder();

          // Directly update the engine mesh to avoid race with async createEffect
          if (engineInstance && engineInstance.hasUnit(dragId)) {
            engineInstance.updateUnit({ ...unit, position: pos });
          }
          // Keep prevPositions in sync so the reactive effect won't re-process
          prevPositions.set(dragId, { ...pos });

          setDmDragUnit(null);
        } else {
          setDmDragUnit(null);
        }
        return;
      }

      const spawnTpl = dmSpawnTemplate();
      if (spawnTpl) {
        window.dispatchEvent(new CustomEvent('dm-tile-click', { detail: pos }));
        return;
      }

      // DM mode active but no drag/spawn → allow unit selection on map
      if (tile.occupiedBy) {
        handleUnitClick(tile.occupiedBy);
      }
      return;
    }
    
    const isFreeRoam = getIsFreeRoamMode();
    
    // Phase de préparation : déplacer l'unité alliée sur une case alliée surlignée
    if (gameState.phase === GamePhase.COMBAT_PREPARATION) {
      if (gameState.selectedUnit && gameState.highlightedTiles.length > 0) {
        const isHighlighted = gameState.highlightedTiles.some((t) => t.x === x && t.z === z);
        if (isHighlighted) {
          moveUnit(pos);
          return;
        }
      }
      if (tile.occupiedBy) {
        handleUnitClick(tile.occupiedBy);
      }
      return;
    }
    
    // Free Roam Mode - simplified logic
    if (isFreeRoam) {
      // If unit is selected and tile is highlighted (movement available)
      if (gameState.selectedUnit && gameState.highlightedTiles.length > 0) {
        const isHighlighted = gameState.highlightedTiles.some(
          (t) => t.x === x && t.z === z
        );
        if (isHighlighted) {
          moveUnit(pos);
          return;
        }
      }
      
      // If tile has a unit, try to select it
      if (tile.occupiedBy) {
        handleUnitClick(tile.occupiedBy);
      }
      return;
    }
    
    // Combat Mode - original logic
    // If in target selection mode, use ability
    if (gameState.selectedAbility && gameState.targetableTiles.length > 0) {
      const isValidTarget = gameState.targetableTiles.some(
        (t) => t.x === x && t.z === z
      );
      if (isValidTarget) {
        useAbility(pos);
      }
      return;
    }
    
    // If unit is selected and tile is highlighted (movement)
    if (gameState.selectedUnit && gameState.turnPhase === TurnPhase.MOVE) {
      const isHighlighted = gameState.highlightedTiles.some(
        (t) => t.x === x && t.z === z
      );
      if (isHighlighted) {
        moveUnit(pos);
        return;
      }
    }
    
    // If tile has a unit, try to select it
    if (tile.occupiedBy) {
      handleUnitClick(tile.occupiedBy);
    }
  }
  
  function handleTileHover(x: number, z: number): void {
    const isFreeRoam = getIsFreeRoamMode();
    const isPreparation = gameState.phase === GamePhase.COMBAT_PREPARATION;
    
    // Pas d'aperçu de chemin en phase de préparation (placement direct)
    if (isPreparation) return;
    
    // Show path preview when hovering over valid movement tiles
    if (gameState.selectedUnit && gameState.highlightedTiles.length > 0) {
      // In Free Roam, always allow preview if unit selected
      // In Combat, check turn phase
      const allowPreview = isFreeRoam || gameState.turnPhase === TurnPhase.MOVE;
      
      if (allowPreview) {
        const isHighlighted = gameState.highlightedTiles.some(
          (t) => t.x === x && t.z === z
        );
        if (isHighlighted) {
          previewPath({ x, z });
        }
      }
    }
  }
  
  function handleUnitClick(unitId: string): void {
    const unit = units[unitId];
    if (!unit || !unit.isAlive) return;
    
    const isFreeRoam = getIsFreeRoamMode();
    const isPreparation = gameState.phase === GamePhase.COMBAT_PREPARATION;
    
    // DM move mode: clicking a unit on the map selects/deselects it for teleport
    if (dmActiveMode() === "move") {
      if (dmDragUnit() === unitId) {
        setDmDragUnit(null);
      } else {
        setDmDragUnit(unitId);
      }
      return;
    }

    // DM inspect: clicking a player unit opens stats/inventory panel
    if (isDm() && unit.team === Team.PLAYER && !dmActiveMode()) {
      setDmInspectedUnit(unitId);
      selectUnit(unitId);
      return;
    }
    
    // Phase de préparation : ne sélectionner que les unités alliées
    if (isPreparation) {
      if (unit.team === Team.PLAYER) {
        selectUnit(unitId);
      }
      return;
    }
    
    // Free Roam Mode - allow selecting player units (DM can select any)
    if (isFreeRoam) {
      if (unit.team === Team.PLAYER || getIsHost()) {
        selectUnit(unitId);
      }
      return;
    }
    
    // Combat Mode - original logic
    // During player turn
    if (gameState.phase === GamePhase.PLAYER_TURN) {
      // If we're targeting with an ability and clicked on an enemy
      if (gameState.selectedAbility && unit.team === Team.ENEMY) {
        const pos = unit.position;
        const isValidTarget = gameState.targetableTiles.some(
          (t) => t.x === pos.x && t.z === pos.z
        );
        if (isValidTarget) {
          useAbility(pos);
          return;
        }
      }
      
      // Allow selecting any unit for inspection
      selectUnit(unitId);
    }
  }
  
  return (
    <canvas
      ref={canvasRef}
      class="w-full h-full block"
      touch-action="none"
    />
  );
};

export function getEngine(): BabylonEngine | null {
  return engineInstance;
}

export function clearEngineState(): void {
  console.log('[GameCanvas] clearEngineState called');
  if (engineInstance) {
    engineInstance.clearAll();
  }
}

export function resetCamera(): void {
  if (engineInstance) {
    engineInstance.resetCamera();
  }
}
