import {
  Scene,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Animation,
  EasingFunction,
  SineEase,
  Vector3,
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
   * Animate a highlight tile with a pulsing glow effect
   */
  private animateHighlightPulse(mesh: Mesh, index: number): void {
    const fps = 30;
    const duration = 60; // 2-second cycle
    // Stagger each tile's animation phase for a wave effect
    const offset = (index % 8) * 7;

    // Pulsing Y scale (slight rise and fall)
    const scaleAnim = new Animation(
      `hl_pulse_${mesh.name}`, 'scaling', fps,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CYCLE
    );
    const ease = new SineEase();
    ease.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
    scaleAnim.setKeys([
      { frame: 0 + offset, value: new Vector3(1, 1, 1) },
      { frame: 15 + offset, value: new Vector3(1.05, 2, 1.05) },
      { frame: 30 + offset, value: new Vector3(1, 1, 1) },
      { frame: 45 + offset, value: new Vector3(0.97, 0.8, 0.97) },
      { frame: 60 + offset, value: new Vector3(1, 1, 1) },
    ]);
    scaleAnim.setEasingFunction(ease);

    // Alpha pulse
    const alphaAnim = new Animation(
      `hl_alpha_${mesh.name}`, 'material.alpha', fps,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CYCLE
    );
    const mat = mesh.material as StandardMaterial;
    const baseAlpha = mat ? mat.alpha : 0.6;
    alphaAnim.setKeys([
      { frame: 0 + offset, value: baseAlpha },
      { frame: 15 + offset, value: Math.min(baseAlpha + 0.2, 0.85) },
      { frame: 30 + offset, value: baseAlpha },
      { frame: 45 + offset, value: baseAlpha - 0.1 },
      { frame: 60 + offset, value: baseAlpha },
    ]);
    alphaAnim.setEasingFunction(ease);

    mesh.animations = [scaleAnim, alphaAnim];
    this.scene.beginAnimation(mesh, 0, 60 + offset, true);
  }

  /**
   * Show movement range highlights with animated pulse
   */
  public showMovementRange(positions: GridPosition[]): void {
    this.clearHighlights();
    
    positions.forEach((pos, index) => {
      const worldPos = gridToWorld(pos);
      const highlight = MeshBuilder.CreateBox(
        `highlight_${pos.x}_${pos.z}`,
        { width: TILE_SIZE * 0.9, height: 0.06, depth: TILE_SIZE * 0.9 },
        this.scene
      );
      highlight.position.set(worldPos.x, 0.15, worldPos.z);
      
      // Clone material so each tile can pulse independently
      const baseMat = this.materials.get('highlight')!;
      const mat = baseMat.clone(`hl_mat_${pos.x}_${pos.z}`);
      mat.alpha = 0.55;
      highlight.material = mat;
      highlight.isPickable = true;
      
      this.animateHighlightPulse(highlight, index);
      this.highlightMeshes.set(posToKey(pos), highlight);
    });
  }

  /**
   * Show target range highlights with animated pulse (red tint)
   */
  public showTargetRange(positions: GridPosition[]): void {
    this.clearHighlights();
    
    positions.forEach((pos, index) => {
      const worldPos = gridToWorld(pos);
      const highlight = MeshBuilder.CreateBox(
        `highlight_${pos.x}_${pos.z}`,
        { width: TILE_SIZE * 0.9, height: 0.06, depth: TILE_SIZE * 0.9 },
        this.scene
      );
      highlight.position.set(worldPos.x, 0.15, worldPos.z);
      
      const baseMat = this.materials.get('target')!;
      const mat = baseMat.clone(`tgt_mat_${pos.x}_${pos.z}`);
      mat.alpha = 0.55;
      highlight.material = mat;
      highlight.isPickable = true;
      
      this.animateHighlightPulse(highlight, index);
      this.highlightMeshes.set(posToKey(pos), highlight);
    });
  }

  /**
   * Show path preview with animated stepping dots
   */
  public showPathPreview(path: GridPosition[]): void {
    this.clearPathPreview();
    
    path.forEach((pos, index) => {
      if (index === 0) return; // Skip starting position
      
      const worldPos = gridToWorld(pos);
      const pathMesh = MeshBuilder.CreateCylinder(
        `path_${index}`,
        { diameter: 0.35, height: 0.12 },
        this.scene
      );
      pathMesh.position.set(worldPos.x, 0.2, worldPos.z);
      pathMesh.material = this.materials.get('path')!;
      pathMesh.isPickable = false;
      
      // Animate path dots with sequential pop-in
      const fps = 30;
      const popAnim = new Animation(
        `path_pop_${index}`, 'scaling', fps,
        Animation.ANIMATIONTYPE_VECTOR3,
        Animation.ANIMATIONLOOPMODE_CONSTANT
      );
      popAnim.setKeys([
        { frame: 0, value: new Vector3(0, 0, 0) },
        { frame: 4, value: new Vector3(1.2, 1.3, 1.2) },
        { frame: 7, value: new Vector3(1, 1, 1) },
      ]);
      pathMesh.animations = [popAnim];
      // Stagger each dot's appearance
      setTimeout(() => {
        this.scene.beginAnimation(pathMesh, 0, 7, false);
      }, index * 60);
      
      this.pathMeshes.push(pathMesh);
    });
  }

  /**
   * Clear all highlights
   */
  public clearHighlights(): void {
    this.highlightMeshes.forEach((mesh) => {
      // Dispose cloned materials
      if (mesh.material && (mesh.material.name.startsWith('hl_mat_') || mesh.material.name.startsWith('tgt_mat_'))) {
        mesh.material.dispose();
      }
      mesh.dispose();
    });
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

