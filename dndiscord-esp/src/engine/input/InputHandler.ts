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
      
      // Check if it's a unit (root mesh or child mesh).
      // Child mesh names come in two flavours depending on how the
      // model was instantiated:
      //   - legacy SceneLoader.ImportMesh:        unit_X.Rig_Medium.Body
      //   - new AssetContainer.instantiateModels: unit_X__Rig_Medium
      // So the unit-id is the chunk between `unit_` and the first `.`
      // or `__` separator.
      if (meshName.startsWith('unit_')) {
        const afterPrefix = meshName.substring(5); // "unit_".length === 5
        const dotIdx = afterPrefix.indexOf('.');
        const dblIdx = afterPrefix.indexOf('__');
        const candidates = [dotIdx, dblIdx].filter((i) => i >= 0);
        const cut = candidates.length > 0 ? Math.min(...candidates) : -1;
        const unitId = cut >= 0 ? afterPrefix.substring(0, cut) : afterPrefix;
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

