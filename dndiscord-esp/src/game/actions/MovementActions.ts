/**
 * Movement Actions
 * 
 * Handles unit selection, movement, and path preview
 */

import { batch } from 'solid-js';
import { produce } from 'solid-js/store';
import { GridPosition, GamePhase, TurnPhase, Team, GameMode } from '../../types';
import { gameState, setGameState, addCombatLog, getIsFreeRoamMode, getIsDungeonMode } from '../stores/GameStateStore';
import { units, setUnits } from '../stores/UnitsStore';
import { tiles, setTiles, pathfinder, updatePathfinder } from '../stores/TilesStore';
import { posToKey } from '../utils/GridUtils';
import { getCurrentSession, getHubUserId } from '../../stores/session.store';
import { isHost as getIsHost } from '../../stores/session.store';
import { sendUnitMove, dmMoveToken } from '../../services/signalr/multiplayer.service';
import { getAllySpawnPositions, getEnemySpawnPositions } from '../initialization/InitUnits';
import { getTeleportPositions } from '../../services/mapStorage';
import { transitionToNextRoom } from './TurnActions';
import { playMovementDustEffect } from '../vfx/VFXIntegration';
import { playFootstepSound, playSelectSound } from '../audio/SoundIntegration';

// ============================================
// UNIT SELECTION
// ============================================

export function selectUnit(unitId: string): void {
  const unit = units[unitId];
  if (!unit || !unit.isAlive) return;

  playSelectSound();

  const isFreeRoam = getIsFreeRoamMode();
  const isPreparation = gameState.phase === GamePhase.COMBAT_PREPARATION;
  const currentUnitId = gameState.turnOrder[gameState.currentUnitIndex];
  const isCurrentUnit = unitId === currentUnitId;
  const isPlayerTurn = gameState.phase === GamePhase.PLAYER_TURN || isFreeRoam;

  // Multiplayer ownership check: if the unit has an owner, only its owner can control it
  const session = getCurrentSession();
  const myUserId = getHubUserId();
  const isHost = getIsHost();
  const isOwned = !!unit.ownerUserId;
  const isMine = !isOwned || unit.ownerUserId === myUserId;
  const canControl = !session || isMine || isHost; // DM (host) can control any unit

  console.log('[selectUnit]', unit.name, '| mode:', isFreeRoam ? 'Free Roam' : isPreparation ? 'Preparation' : 'Combat', '| isCurrentUnit:', isCurrentUnit, '| isPlayerTurn:', isPlayerTurn, '| canControl:', canControl);

  batch(() => {
    setGameState({
      selectedUnit: unitId,
      selectedAbility: null,
      turnPhase: canControl && (isPreparation || isFreeRoam || (isCurrentUnit && isPlayerTurn)) ? TurnPhase.MOVE : TurnPhase.SELECT_UNIT,
    });
    
    // Phase de préparation : afficher les cases de spawn correspondant à l'équipe sélectionnée.
    if (isPreparation) {
      if (unit.team === Team.PLAYER) {
        const allyPositions = getAllySpawnPositions(gameState.mapId);
        setGameState('highlightedTiles', allyPositions);
      } else if (unit.team === Team.ENEMY && isHost) {
        const enemyPositions = getEnemySpawnPositions(gameState.mapId);
        setGameState('highlightedTiles', enemyPositions);
      } else {
        setGameState('highlightedTiles', []);
      }
    } else {
      // Show movement range in Free Roam for any player unit the current user owns, or in Combat for current unit
      const shouldShowMovement = canControl && (isFreeRoam ? true : (isCurrentUnit && isPlayerTurn && unit.stats.currentActionPoints >= 1));
      
      if (shouldShowMovement && pathfinder) {
        const effectiveRange = isFreeRoam 
          ? unit.stats.movementRange 
          : Math.min(unit.stats.movementRange, unit.stats.currentActionPoints);
        
        const reachable = pathfinder.getReachableTiles(
          unit.position,
          effectiveRange
        );
        const highlighted = Array.from(reachable.values()).map((r) => r.position);
        setGameState('highlightedTiles', highlighted);
      } else {
        setGameState('highlightedTiles', []);
      }
    }
    
    setGameState('pathPreview', []);
    setGameState('targetableTiles', []);
  });
}

// ============================================
// PATH PREVIEW
// ============================================

export function previewPath(targetPos: GridPosition): void {
  const unit = gameState.selectedUnit ? units[gameState.selectedUnit] : null;
  if (!unit || !pathfinder) return;
  
  // Limit path by remaining AP
  const maxCost = Math.min(unit.stats.movementRange, unit.stats.currentActionPoints);
  const path = pathfinder.findPath(
    unit.position,
    targetPos,
    maxCost
  );
  
  setGameState('pathPreview', path || []);
}

// ============================================
// UNIT MOVEMENT
// ============================================

export function moveUnit(targetPos: GridPosition): boolean {
  const unit = gameState.selectedUnit ? units[gameState.selectedUnit] : null;
  if (!unit) return false;

  // Multiplayer ownership check
  if (unit.ownerUserId) {
    const myUserId = getHubUserId();
    const isHost = getIsHost();
    if (myUserId && unit.ownerUserId !== myUserId && !isHost) return false;
  }

  const isFreeRoam = getIsFreeRoamMode();
  const isPreparation = gameState.phase === GamePhase.COMBAT_PREPARATION;
  
  // Phase de préparation : placement direct sur une case de spawn (sans pathfinding)
  if (isPreparation && (unit.team === Team.PLAYER || unit.team === Team.ENEMY)) {
    const isHost = getIsHost();
    if (unit.team === Team.ENEMY && !isHost) return false;

    const allowedPositions =
      unit.team === Team.PLAYER
        ? getAllySpawnPositions(gameState.mapId)
        : getEnemySpawnPositions(gameState.mapId);

    const isAllowedCell = allowedPositions.some((p) => p.x === targetPos.x && p.z === targetPos.z);
    const tileKey = posToKey(targetPos);
    const tile = tiles[tileKey];
    if (!isAllowedCell || !tile) return false;
    if (tile.occupiedBy !== null && tile.occupiedBy !== unit.id) return false;
    if (targetPos.x === unit.position.x && targetPos.z === unit.position.z) return false; // déjà sur la case
    
    batch(() => {
      setTiles(posToKey(unit.position), 'occupiedBy', null);
      setUnits(unit.id, produce((u) => {
        u.position = targetPos;
      }));
      setTiles(tileKey, 'occupiedBy', unit.id);
      setGameState('pathPreview', []);
      // Réafficher les cases correspondantes après le déplacement
      setGameState('highlightedTiles', allowedPositions);
    });
    updatePathfinder();
    return true;
  }
  
  if (!pathfinder) return false;
  
  // In Combat mode, only allow movement if it's the current unit's turn
  if (!isFreeRoam) {
    const currentUnitId = gameState.turnOrder[gameState.currentUnitIndex];
    if (unit.id !== currentUnitId) {
      return false;
    }
  }
  
  // Limit path by remaining AP (or full range in Free Roam)
  const maxCost = isFreeRoam 
    ? unit.stats.movementRange 
    : Math.min(unit.stats.movementRange, unit.stats.currentActionPoints);
  
  const path = pathfinder.findPath(
    unit.position,
    targetPos,
    maxCost
  );
  
  if (!path || path.length === 0) return false;
  
  // Calculate movement cost by summing the movementCost of each tile in the path
  // Skip the starting position (index 0)
  let movementCost = 0;
  for (let i = 1; i < path.length; i++) {
    const tileKey = posToKey(path[i]);
    const tile = tiles[tileKey];
    if (tile) {
      movementCost += tile.movementCost;
    } else {
      // Fallback to 1 if tile not found
      movementCost += 1;
    }
  }
  
  // Check if unit has enough AP for this move (skip in Free Roam)
  if (!isFreeRoam && unit.stats.currentActionPoints < movementCost) return false;
  
  batch(() => {
    // Play movement dust trail VFX + footstep sound
    playMovementDustEffect(unit.position, targetPos);
    playFootstepSound();
    
    // Clear old tile
    setTiles(posToKey(unit.position), 'occupiedBy', null);
    
    // Update unit position and deduct AP (skip AP deduction in Free Roam)
    setUnits(unit.id, produce((u) => {
      u.position = targetPos;
      if (!isFreeRoam) {
        u.stats.currentActionPoints -= movementCost;
      }
    }));
    
    // Set new tile as occupied
    setTiles(posToKey(targetPos), 'occupiedBy', unit.id);
    
    // Clear path preview
    setGameState('pathPreview', []);
    
    // Recalculate movement range
    const updatedUnit = units[unit.id];
    if (pathfinder) {
      // In Free Roam, always show full range; in Combat, check remaining AP
      const canStillMove = isFreeRoam || updatedUnit.stats.currentActionPoints >= 1;
      
      if (canStillMove) {
        const effectiveRange = isFreeRoam 
          ? updatedUnit.stats.movementRange 
          : Math.min(updatedUnit.stats.movementRange, updatedUnit.stats.currentActionPoints);
        
        const reachable = pathfinder.getReachableTiles(
          targetPos,
          effectiveRange
        );
        const highlighted = Array.from(reachable.values()).map((r) => r.position);
        setGameState('highlightedTiles', highlighted);
      } else {
        setGameState('highlightedTiles', []);
      }
    }
    
    // Only log in Combat mode
    if (!isFreeRoam) {
      addCombatLog(`${unit.name} moves to (${targetPos.x}, ${targetPos.z})`, 'move');
    }
  });
  
  // Update pathfinder with new tile state
  updatePathfinder();


  // En session multijoueur : diffuser le mouvement aux autres joueurs
  const session = getCurrentSession();
  if (session) {
    const myUserId = getHubUserId();
    const isDmMovingOther = getIsHost() && unit.ownerUserId && unit.ownerUserId !== myUserId;

    if (isDmMovingOther) {
      // DM force-moving another player's token → use DmMoveToken for proper broadcast
      dmMoveToken({
        unitId: unit.id,
        target: { x: targetPos.x, y: targetPos.z },
      }).catch((err) => {
        console.warn("[MovementActions] dmMoveToken failed:", err);
      });
    } else {
      // Normal movement → legacy broadcast
      const remainingAp = units[unit.id].stats.currentActionPoints;
      const pathForBackend = path.map((p) => ({ x: p.x, y: p.z }));
      sendUnitMove({
        unitId: unit.id,
        path: pathForBackend,
        apCost: movementCost,
        remainingAp,
      }).catch((err) => {
        console.warn("[MovementActions] sendUnitMove failed:", err);
      });
    }
  }

  // Check if the unit stepped on a teleport cell (dungeon mode only)
  if (getIsDungeonMode() && gameState.dungeon && unit.team === Team.PLAYER) {
    const teleportPositions = getTeleportPositions(gameState.mapId!);
    const isOnTeleport = teleportPositions.some(
      (p) => p.x === targetPos.x && p.z === targetPos.z
    );
    if (isOnTeleport) {
      addCombatLog('Portail de téléportation activé ! Transition vers la salle suivante...', 'system');
      setTimeout(() => {
        transitionToNextRoom();
      }, 500);
    }
  }

  return true;
}

