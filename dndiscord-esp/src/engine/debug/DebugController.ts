import {
  Scene,
  Vector3,
  Animation,
  TransformNode,
} from '@babylonjs/core';
import '@babylonjs/core/Debug/debugLayer';
import '@babylonjs/inspector';
import { UnitRenderer } from '../renderers/UnitRenderer';
import { gameState } from '../../game';

/**
 * DebugController - Manages debug tools and controls
 */
export class DebugController {
  private scene: Scene;
  private unitRenderer: UnitRenderer;

  constructor(scene: Scene, unitRenderer: UnitRenderer) {
    this.scene = scene;
    this.unitRenderer = unitRenderer;
    
    this.logDebugInstructions();
    this.setupDebugControls();
  }

  /**
   * Log available debug controls to console
   */
  private logDebugInstructions(): void {
    console.log('🔧 DEBUG MODE ENABLED');
    console.log('📹 Camera: Right-click drag to rotate, Scroll to zoom');
    console.log('🔍 Press F9 to toggle Inspector');
    console.log('🔄 Press Arrow Keys to manually rotate selected unit');
    console.log('↩️  Press "R" to reset unit rotation');
  }

  /**
   * Setup keyboard controls for debugging
   */
  private setupDebugControls(): void {
    window.addEventListener('keydown', (event) => {
      this.handleKeyPress(event);
    });
  }

  /**
   * Handle keyboard input for debug controls
   */
  private handleKeyPress(event: KeyboardEvent): void {
    // Skip all debug shortcuts when user is typing in an input field
    const tag = (event.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (event.target as HTMLElement)?.isContentEditable) {
      return;
    }

    // Toggle Inspector with F9 key (changed from "I" to avoid conflict with chat input)
    if (event.key === 'F9') {
      this.toggleInspector();
      return;
    }
    
    // Handle unit rotation controls (requires selected unit)
    if (gameState.selectedUnit) {
      this.handleUnitRotation(event);
    }
  }

  /**
   * Toggle the Babylon.js Inspector
   */
  private toggleInspector(): void {
    if (this.scene.debugLayer.isVisible()) {
      this.scene.debugLayer.hide();
      console.log('Inspector hidden');
    } else {
      this.scene.debugLayer.show({
        embedMode: true,
      });
      console.log('Inspector shown');
    }
  }

  /**
   * Handle arrow key rotation for selected unit
   */
  private handleUnitRotation(event: KeyboardEvent): void {
    const mesh = this.unitRenderer.getUnitMesh(gameState.selectedUnit!);
    if (!mesh) return;
    
    // Find the rig node (or use root mesh)
    const descendants = mesh.getDescendants(false);
    const rigNode = descendants.find(node => node.name.includes('Rig')) as TransformNode | undefined;
    const nodeToRotate = (rigNode || mesh) as TransformNode;
    
    // Convert quaternion to Euler angles if needed
    this.ensureEulerRotation(nodeToRotate);
    
    // Handle rotation based on key
    switch(event.key) {
      case 'ArrowLeft':
        this.rotateNode(nodeToRotate, 'y', -0.3, '⬅️');
        break;
      case 'ArrowRight':
        this.rotateNode(nodeToRotate, 'y', 0.3, '➡️');
        break;
      case 'ArrowUp':
        this.rotateNode(nodeToRotate, 'x', -0.3, '⬆️');
        break;
      case 'ArrowDown':
        this.rotateNode(nodeToRotate, 'x', 0.3, '⬇️');
        break;
      case 'r':
      case 'R':
        this.resetRotation(nodeToRotate);
        break;
    }
  }

  /**
   * Ensure node uses Euler angles instead of quaternion
   */
  private ensureEulerRotation(node: TransformNode): void {
    if (node.rotationQuaternion) {
      console.log(`⚠️ ${node.name} has rotationQuaternion, converting to Euler angles`);
      node.rotation = node.rotationQuaternion.toEulerAngles();
      node.rotationQuaternion = null;
    }
  }

  /**
   * Rotate a node smoothly around an axis
   */
  private rotateNode(
    node: TransformNode,
    axis: 'x' | 'y' | 'z',
    delta: number,
    emoji: string
  ): void {
    const currentRotation = node.rotation[axis];
    const targetRotation = currentRotation + delta;
    
    Animation.CreateAndStartAnimation(
      `debugRotate_${node.name}`,
      node,
      `rotation.${axis}`,
      30,
      5,
      currentRotation,
      targetRotation,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    
    console.log(`${emoji} Rotating ${node.name} around ${axis}-axis`);
  }

  /**
   * Reset node rotation to zero with smooth animation
   */
  private resetRotation(node: TransformNode): void {
    Animation.CreateAndStartAnimation(
      `debugRotate_${node.name}`,
      node,
      'rotation',
      30,
      10,
      node.rotation.clone(),
      Vector3.Zero(),
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    
    console.log(`🔄 Reset rotation for ${node.name}`);
  }
}

