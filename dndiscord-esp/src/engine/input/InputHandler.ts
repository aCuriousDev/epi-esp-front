import {
  Scene,
  PointerEventTypes,
} from '@babylonjs/core';
import { GridPosition } from '../../types';

/**
 * InputHandler - Manages pointer events and user input
 */
export class InputHandler {
  private onTileClick: ((pos: GridPosition) => void) | null = null;
  private onTileHover: ((pos: GridPosition) => void) | null = null;
  private onUnitClick: ((unitId: string) => void) | null = null;

  constructor(scene: Scene) {
    this.setupPointerEvents(scene);
  }

  /**
   * Setup pointer event handling for tiles and units
   */
  private setupPointerEvents(scene: Scene): void {
    scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type === PointerEventTypes.POINTERPICK) {
        this.handlePointerPick(pointerInfo.pickInfo);
      }
      
      if (pointerInfo.type === PointerEventTypes.POINTERMOVE) {
        this.handlePointerMove(scene);
      }
    });
  }

  /**
   * Handle pointer click events
   */
  private handlePointerPick(pickInfo: any): void {
    if (pickInfo?.hit && pickInfo.pickedMesh) {
      const meshName = pickInfo.pickedMesh.name;
      
      // Check if it's a tile or highlight (highlights are on top of tiles)
      if (meshName.startsWith('tile_') || meshName.startsWith('highlight_')) {
        const position = this.parseTilePosition(meshName);
        if (position && this.onTileClick) {
          this.onTileClick(position);
        }
      }
      
      // Check if it's a unit (root mesh or child mesh)
      // Mesh names can be "unit_player_warrior" or "unit_player_warrior.Rig_Medium.Knight_Body"
      if (meshName.startsWith('unit_')) {
        // Extract unit ID (everything between "unit_" and the first "." or end of string)
        const unitId = meshName.includes('.') 
          ? meshName.substring(5, meshName.indexOf('.'))  // "unit_" is 5 chars
          : meshName.substring(5);  // Remove "unit_" prefix
        if (this.onUnitClick && unitId) {
          this.onUnitClick(unitId);
        }
      }
    }
  }

  /**
   * Handle pointer move (hover) events
   */
  private handlePointerMove(scene: Scene): void {
    const pickResult = scene.pick(
      scene.pointerX,
      scene.pointerY
    );
    
    if (pickResult?.hit && pickResult.pickedMesh) {
      const meshName = pickResult.pickedMesh.name;
      
      if (meshName.startsWith('tile_') || meshName.startsWith('highlight_')) {
        const position = this.parseTilePosition(meshName);
        if (position && this.onTileHover) {
          this.onTileHover(position);
        }
      }
    }
  }

  /**
   * Parse tile position from mesh name (e.g., "tile_3_5" or "highlight_3_5")
   */
  private parseTilePosition(meshName: string): GridPosition | null {
    const posStr = meshName.replace('tile_', '').replace('highlight_', '');
    const [x, z] = posStr.split('_').map(Number);
    
    if (!isNaN(x) && !isNaN(z)) {
      return { x, z };
    }
    
    return null;
  }

  /**
   * Set callback for tile click events
   */
  public setOnTileClick(callback: (pos: GridPosition) => void): void {
    this.onTileClick = callback;
  }

  /**
   * Set callback for tile hover events
   */
  public setOnTileHover(callback: (pos: GridPosition) => void): void {
    this.onTileHover = callback;
  }

  /**
   * Set callback for unit click events
   */
  public setOnUnitClick(callback: (unitId: string) => void): void {
    this.onUnitClick = callback;
  }
}

