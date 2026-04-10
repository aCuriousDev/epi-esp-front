/**
 * Combat preparation helpers (placement, random placement).
 */

import { batch } from "solid-js";
import { produce } from "solid-js/store";
import { Team } from "../../types";
import { units, setUnits } from "../stores/UnitsStore";
import { tiles, setTiles, updatePathfinder } from "../stores/TilesStore";
import { posToKey } from "../utils/GridUtils";
import {
  getAllySpawnPositions,
  getEnemySpawnPositions,
} from "../initialization/InitUnits";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Randomly place all PLAYER units on ally spawns and all ENEMY units on enemy spawns.
 * Respects occupancy and clears previous occupancy.
 */
export function randomizePreparationPlacement(mapId: string | null): void {
  const ally = shuffle(getAllySpawnPositions(mapId));
  const enemy = shuffle(getEnemySpawnPositions(mapId));

  const playerUnits = Object.values(units).filter(
    (u) => u.team === Team.PLAYER && u.isAlive,
  );
  const enemyUnits = Object.values(units).filter(
    (u) => u.team === Team.ENEMY && u.isAlive,
  );

  if (playerUnits.length === 0 && enemyUnits.length === 0) return;

  // Clear all occupancy for existing units
  for (const u of [...playerUnits, ...enemyUnits]) {
    const key = posToKey(u.position);
    if (tiles[key]?.occupiedBy === u.id) {
      setTiles(key, "occupiedBy", null);
    }
  }

  batch(() => {
    // Place players
    playerUnits.forEach((u, i) => {
      const pos = ally[i % Math.max(1, ally.length)] ?? u.position;
      setUnits(
        u.id,
        produce((draft) => {
          draft.position = pos;
        }),
      );
      setTiles(posToKey(pos), "occupiedBy", u.id);
    });

    // Place enemies
    enemyUnits.forEach((u, i) => {
      const pos = enemy[i % Math.max(1, enemy.length)] ?? u.position;
      setUnits(
        u.id,
        produce((draft) => {
          draft.position = pos;
        }),
      );
      setTiles(posToKey(pos), "occupiedBy", u.id);
    });
  });

  updatePathfinder();
}
