import { Component, onMount, onCleanup, createEffect, createSignal } from 'solid-js';
import { BabylonEngine } from '../engine/BabylonEngine';
import {
  gameState,
  setGameState,
  tiles,
  units,
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
} from '../game';
import { GamePhase, TurnPhase, Team, Unit, GridPosition } from '../types';

let engineInstance: BabylonEngine | null = null;
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
        engineInstance.dispose();
        console.log('[GameCanvas] Engine disposed successfully');
      } catch (e) {
        console.error('[GameCanvas] Error disposing engine:', e);
      }
      engineInstance = null;
    }
    setIsEngineReady(false);
    prevPositions.clear();
    console.log('[GameCanvas] ===== CLEANUP COMPLETE =====');
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
    
    console.log('[GameCanvas] Units effect triggered - Count:', unitSnapshots.length, 'Engine ready:', isEngineReady(), 'Processing:', isProcessingUnits);
    
    if (!engineInstance || !isEngineReady()) {
      console.log('[GameCanvas] Skipping units - engine not ready');
      return;
    }
    if (isProcessingUnits) {
      console.log('[GameCanvas] Skipping unit processing - already in progress');
      return;
    }
    
    console.log('[GameCanvas] Processing', unitSnapshots.length, 'units');
    
    // Process units sequentially to handle async model loading
    // Use the snapshot data captured synchronously above
    isProcessingUnits = true;
    (async () => {
      try {
        for (const { id, unit, currentPos } of unitSnapshots) {
          const exists = engineInstance.hasUnit(id);
          const prevPos = prevPositions.get(id);
          
          console.log(`[GameCanvas] Unit ${id} - Exists: ${exists}, PrevPos:`, prevPos, 'CurrentPos:', currentPos);
          
          if (!exists) {
            // Create new unit
            console.log(`[GameCanvas] Creating NEW unit ${id} at (${currentPos.x}, ${currentPos.z})`);
            await engineInstance.createUnit(unit);
            // Initialize previous position when unit is first created
            prevPositions.set(id, { ...currentPos });
            console.log(`[GameCanvas] ✓ Created unit ${id}, prevPos set to (${currentPos.x}, ${currentPos.z})`);
          } else {
            // Check if position changed for animation
            const positionChanged = prevPos && (prevPos.x !== currentPos.x || prevPos.z !== currentPos.z);
            
            if (positionChanged) {
              console.log(`[GameCanvas] Unit ${id} MOVED from (${prevPos.x}, ${prevPos.z}) to (${currentPos.x}, ${currentPos.z})`);
              engineInstance.updateUnit(unit);
              // Update stored position immediately after calling updateUnit
              prevPositions.set(id, { ...currentPos });
            } else {
              // Position didn't change, just update state (selection, health, etc.)
              console.log(`[GameCanvas] Unit ${id} updated (no movement)`);
              engineInstance.updateUnit(unit);
            }
          }
        }
        console.log('[GameCanvas] All units processed');
        
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
      }
    })();
  });
  
  // Gérer la visibilité des ennemis selon la phase du jeu
  createEffect(() => {
    if (!engineInstance || !isEngineReady()) return;
    
    // Accéder à units pour déclencher l'effet quand de nouvelles unités sont créées
    const unitCount = Object.keys(units).length;
    const phase = gameState.phase;
    
    const enemyUnits = getEnemyUnits();
    const enemyUnitIds = enemyUnits.map(u => u.id);
    
    console.log(`[GameCanvas] Visibility effect triggered - Phase: ${phase}, Enemy count: ${enemyUnitIds.length}, Unit count: ${unitCount}`);
    
    // En phase de préparation : rendre les ennemis invisibles
    // Sinon : rendre les ennemis visibles
    const shouldBeVisible = phase !== GamePhase.COMBAT_PREPARATION;
    
    if (enemyUnitIds.length > 0) {
      console.log(`[GameCanvas] Setting enemy visibility to ${shouldBeVisible ? 'VISIBLE' : 'INVISIBLE'} for ${enemyUnitIds.length} enemies`);
      engineInstance.setEnemyVisibility(shouldBeVisible, enemyUnitIds);
    } else {
      console.warn(`[GameCanvas] No enemy units found! Total units: ${unitCount}`);
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
          engineInstance.showDamageNumber(unitId, damage);
        }
      }
      
      // Mettre à jour la valeur précédente
      previousUnitHealth.set(unitId, currentHP);
    });
  });
  
  // En phase de préparation, s'assurer que toutes les cases alliées sont toujours visibles
  createEffect(() => {
    if (gameState.phase === GamePhase.COMBAT_PREPARATION && !gameState.selectedUnit) {
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
    
    // Phase de préparation : ne sélectionner que les unités alliées
    if (isPreparation) {
      if (unit.team === Team.PLAYER) {
        selectUnit(unitId);
      }
      return;
    }
    
    // Free Roam Mode - only allow selecting player units
    if (isFreeRoam) {
      if (unit.team === Team.PLAYER) {
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
