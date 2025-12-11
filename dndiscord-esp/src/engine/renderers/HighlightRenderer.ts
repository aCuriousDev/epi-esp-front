import {
  Scene,
  Mesh,
  MeshBuilder,
  StandardMaterial,
} from '@babylonjs/core';
import { GridPosition } from '../../types';
import { gridToWorld, TILE_SIZE, posToKey } from '../../game';

export class HighlightRenderer {
  private scene: Scene;
  private materials: Map<string, StandardMaterial>;
  private highlightMeshes: Map<string, Mesh> = new Map();
  private pathMeshes: Mesh[] = [];

  constructor(scene: Scene, materials: Map<string, StandardMaterial>) {
    this.scene = scene;
    this.materials = materials;
  }

  /**
   * Show movement range highlights
   */
  public showMovementRange(positions: GridPosition[]): void {
    this.clearHighlights();
    
    positions.forEach((pos) => {
      const worldPos = gridToWorld(pos);
      const highlight = MeshBuilder.CreateBox(
        `highlight_${pos.x}_${pos.z}`,
        { width: TILE_SIZE * 0.9, height: 0.05, depth: TILE_SIZE * 0.9 },
        this.scene
      );
      highlight.position.set(worldPos.x, 0.15, worldPos.z);
      highlight.material = this.materials.get('highlight')!;
      highlight.isPickable = true;
      
      this.highlightMeshes.set(posToKey(pos), highlight);
    });
  }

  /**
   * Show target range highlights
   */
  public showTargetRange(positions: GridPosition[]): void {
    this.clearHighlights();
    
    positions.forEach((pos) => {
      const worldPos = gridToWorld(pos);
      const highlight = MeshBuilder.CreateBox(
        `highlight_${pos.x}_${pos.z}`,
        { width: TILE_SIZE * 0.9, height: 0.05, depth: TILE_SIZE * 0.9 },
        this.scene
      );
      highlight.position.set(worldPos.x, 0.15, worldPos.z);
      highlight.material = this.materials.get('target')!;
      highlight.isPickable = true;
      
      this.highlightMeshes.set(posToKey(pos), highlight);
    });
  }

  /**
   * Show path preview
   */
  public showPathPreview(path: GridPosition[]): void {
    this.clearPathPreview();
    
    path.forEach((pos, index) => {
      if (index === 0) return; // Skip starting position
      
      const worldPos = gridToWorld(pos);
      const pathMesh = MeshBuilder.CreateCylinder(
        `path_${index}`,
        { diameter: 0.3, height: 0.1 },
        this.scene
      );
      pathMesh.position.set(worldPos.x, 0.2, worldPos.z);
      pathMesh.material = this.materials.get('path')!;
      pathMesh.isPickable = false;
      
      this.pathMeshes.push(pathMesh);
    });
  }

  /**
   * Clear all highlights
   */
  public clearHighlights(): void {
    this.highlightMeshes.forEach((mesh) => mesh.dispose());
    this.highlightMeshes.clear();
  }

  /**
   * Clear path preview
   */
  public clearPathPreview(): void {
    this.pathMeshes.forEach((mesh) => mesh.dispose());
    this.pathMeshes = [];
  }
}

