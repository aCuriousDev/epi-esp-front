import type { Tile, GridPosition } from '../../types';

/**
 * Build a cluster of up to `count` walkable-unoccupied cells around a session
 * spawn anchor. Authored by the DM via the campaign story-tree MapNode;
 * returned in priority order (anchor first, then orthogonal neighbours, then
 * a diagonal). Cells filtered to the grid bounds + walkable + !occupiedBy.
 *
 * `tiles` is optional — when omitted, the cluster is returned bounds-filtered
 * only (caller does the walkable filtering itself).
 */
export interface BuildSessionClusterInput {
  point: { x: number; z: number };
  count: number;
  gridWidth: number;
  gridHeight: number;
  tiles?: Record<string, Tile>;
}

function inBounds(p: GridPosition, w: number, h: number): boolean {
  return p.x >= 0 && p.z >= 0 && p.x < w && p.z < h;
}

function isWalkable(tiles: Record<string, Tile> | undefined, p: GridPosition): boolean {
  if (!tiles) return true;
  const t = tiles[`${p.x},${p.z}`];
  return t !== undefined && t.walkable && !t.occupiedBy;
}

export function buildSessionCluster(input: BuildSessionClusterInput): GridPosition[] {
  const { point, count, gridWidth, gridHeight, tiles } = input;
  if (count <= 0) return [];

  const { x, z } = point;
  const candidates: GridPosition[] = [
    { x,         z         },
    { x: x + 1,  z         },
    { x,         z: z + 1  },
    { x: x + 1,  z: z + 1  },
    { x: x - 1,  z         },
    { x,         z: z - 1  },
  ];

  const picked: GridPosition[] = [];
  for (const c of candidates) {
    if (picked.length >= count) break;
    if (!inBounds(c, gridWidth, gridHeight)) continue;
    if (!isWalkable(tiles, c)) continue;
    picked.push(c);
  }
  return picked;
}
