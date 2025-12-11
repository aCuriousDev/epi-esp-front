import { GridPosition, PathNode, Tile } from '../types';

/**
 * A* Pathfinding Algorithm Implementation
 * Optimized for grid-based tactical games like Dofus/BG3
 */

export class Pathfinder {
  private grid: Map<string, Tile>;
  private gridWidth: number;
  private gridHeight: number;
  
  constructor(grid: Map<string, Tile>, width: number, height: number) {
    this.grid = grid;
    this.gridWidth = width;
    this.gridHeight = height;
  }
  
  /**
   * Convert grid position to map key
   */
  private posToKey(pos: GridPosition): string {
    return `${pos.x},${pos.z}`;
  }
  
  /**
   * Calculate Manhattan distance heuristic
   */
  private heuristic(a: GridPosition, b: GridPosition): number {
    return Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
  }
  
  /**
   * Get tile at position
   */
  private getTile(pos: GridPosition): Tile | undefined {
    return this.grid.get(this.posToKey(pos));
  }
  
  /**
   * Check if position is within grid bounds
   */
  private isInBounds(pos: GridPosition): boolean {
    return pos.x >= 0 && pos.x < this.gridWidth && pos.z >= 0 && pos.z < this.gridHeight;
  }
  
  /**
   * Get walkable neighbors (4 directions - no diagonals for tactical games)
   */
  private getNeighbors(pos: GridPosition, ignoreOccupied: boolean = false): GridPosition[] {
    const directions = [
      { x: 0, z: -1 },  // North
      { x: 1, z: 0 },   // East
      { x: 0, z: 1 },   // South
      { x: -1, z: 0 },  // West
    ];
    
    const neighbors: GridPosition[] = [];
    
    for (const dir of directions) {
      const newPos: GridPosition = {
        x: pos.x + dir.x,
        z: pos.z + dir.z,
      };
      
      if (!this.isInBounds(newPos)) continue;
      
      const tile = this.getTile(newPos);
      if (!tile) continue;
      
      // Check if tile is walkable
      if (!tile.walkable) continue;
      
      // Check if tile is occupied (unless we're ignoring occupation)
      if (!ignoreOccupied && tile.occupiedBy !== null) continue;
      
      neighbors.push(newPos);
    }
    
    return neighbors;
  }
  
  /**
   * Find path using A* algorithm
   */
  findPath(
    start: GridPosition,
    end: GridPosition,
    maxCost: number = Infinity,
    ignoreOccupiedForDestination: boolean = false
  ): GridPosition[] | null {
    const startKey = this.posToKey(start);
    const endKey = this.posToKey(end);
    
    // Check if destination is valid
    const endTile = this.getTile(end);
    if (!endTile || !endTile.walkable) return null;
    if (!ignoreOccupiedForDestination && endTile.occupiedBy !== null) return null;
    
    // Initialize open and closed sets
    const openSet: Map<string, PathNode> = new Map();
    const closedSet: Set<string> = new Set();
    
    // Create start node
    const startNode: PathNode = {
      position: start,
      g: 0,
      h: this.heuristic(start, end),
      f: this.heuristic(start, end),
      parent: null,
    };
    
    openSet.set(startKey, startNode);
    
    while (openSet.size > 0) {
      // Find node with lowest f score
      let current: PathNode | null = null;
      let currentKey: string = '';
      let lowestF = Infinity;
      
      for (const [key, node] of openSet) {
        if (node.f < lowestF) {
          lowestF = node.f;
          current = node;
          currentKey = key;
        }
      }
      
      if (!current) break;
      
      // Check if we reached the goal
      if (currentKey === endKey) {
        return this.reconstructPath(current);
      }
      
      // Move current from open to closed
      openSet.delete(currentKey);
      closedSet.add(currentKey);
      
      // Process neighbors
      const neighbors = this.getNeighbors(
        current.position,
        currentKey === startKey || this.posToKey(current.position) === endKey
      );
      
      for (const neighborPos of neighbors) {
        const neighborKey = this.posToKey(neighborPos);
        
        // Skip if already processed
        if (closedSet.has(neighborKey)) continue;
        
        // Calculate costs
        const tile = this.getTile(neighborPos);
        const movementCost = tile?.movementCost ?? 1;
        const tentativeG = current.g + movementCost;
        
        // Skip if exceeds max cost
        if (tentativeG > maxCost) continue;
        
        const existingNode = openSet.get(neighborKey);
        
        if (!existingNode || tentativeG < existingNode.g) {
          const h = this.heuristic(neighborPos, end);
          const node: PathNode = {
            position: neighborPos,
            g: tentativeG,
            h: h,
            f: tentativeG + h,
            parent: current,
          };
          openSet.set(neighborKey, node);
        }
      }
    }
    
    // No path found
    return null;
  }
  
  /**
   * Reconstruct path from end node
   */
  private reconstructPath(endNode: PathNode): GridPosition[] {
    const path: GridPosition[] = [];
    let current: PathNode | null = endNode;
    
    while (current !== null) {
      path.unshift(current.position);
      current = current.parent;
    }
    
    return path;
  }
  
  /**
   * Get all reachable tiles within movement range
   */
  getReachableTiles(
    start: GridPosition,
    maxMovement: number,
    ignoreStartOccupation: boolean = true
  ): Map<string, { position: GridPosition; cost: number }> {
    const reachable: Map<string, { position: GridPosition; cost: number }> = new Map();
    const startKey = this.posToKey(start);
    
    // BFS with cost tracking
    const queue: Array<{ position: GridPosition; cost: number }> = [
      { position: start, cost: 0 }
    ];
    const visited: Set<string> = new Set();
    visited.add(startKey);
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentKey = this.posToKey(current.position);
      
      // Add to reachable (except start position)
      if (currentKey !== startKey) {
        reachable.set(currentKey, current);
      }
      
      // Get neighbors
      const isStart = currentKey === startKey;
      const neighbors = this.getNeighbors(current.position, isStart && ignoreStartOccupation);
      
      for (const neighborPos of neighbors) {
        const neighborKey = this.posToKey(neighborPos);
        
        if (visited.has(neighborKey)) continue;
        
        const tile = this.getTile(neighborPos);
        const movementCost = tile?.movementCost ?? 1;
        const newCost = current.cost + movementCost;
        
        if (newCost <= maxMovement) {
          visited.add(neighborKey);
          queue.push({ position: neighborPos, cost: newCost });
        }
      }
    }
    
    return reachable;
  }
  
  /**
   * Get tiles within attack range (including through walls for ranged)
   */
  getTilesInRange(
    center: GridPosition,
    range: number,
    includeCenter: boolean = false
  ): GridPosition[] {
    const tiles: GridPosition[] = [];
    
    for (let x = center.x - range; x <= center.x + range; x++) {
      for (let z = center.z - range; z <= center.z + range; z++) {
        // Manhattan distance check
        const distance = Math.abs(x - center.x) + Math.abs(z - center.z);
        
        if (distance <= range && (includeCenter || distance > 0)) {
          const pos: GridPosition = { x, z };
          if (this.isInBounds(pos)) {
            tiles.push(pos);
          }
        }
      }
    }
    
    return tiles;
  }
  
  /**
   * Check line of sight between two positions
   */
  hasLineOfSight(from: GridPosition, to: GridPosition): boolean {
    // Bresenham's line algorithm
    let x0 = from.x;
    let z0 = from.z;
    const x1 = to.x;
    const z1 = to.z;
    
    const dx = Math.abs(x1 - x0);
    const dz = Math.abs(z1 - z0);
    const sx = x0 < x1 ? 1 : -1;
    const sz = z0 < z1 ? 1 : -1;
    let err = dx - dz;
    
    while (true) {
      // Skip start position
      if (!(x0 === from.x && z0 === from.z)) {
        // Skip end position for final check
        if (!(x0 === to.x && z0 === to.z)) {
          const tile = this.getTile({ x: x0, z: z0 });
          if (!tile || !tile.walkable) {
            return false;
          }
        }
      }
      
      if (x0 === x1 && z0 === z1) break;
      
      const e2 = 2 * err;
      if (e2 > -dz) {
        err -= dz;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        z0 += sz;
      }
    }
    
    return true;
  }
}
