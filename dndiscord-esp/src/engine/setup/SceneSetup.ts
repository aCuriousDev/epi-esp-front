import {
  Scene,
  ArcRotateCamera,
  HemisphericLight,
  DirectionalLight,
  Vector3,
  Color3,
  ShadowGenerator,
} from '@babylonjs/core';
import { GRID_SIZE } from '../../game';

/**
 * SceneSetup - Handles camera and lighting configuration
 */
export class SceneSetup {
  private camera: ArcRotateCamera;
  private shadowGenerator: ShadowGenerator | null = null;
  
  // Default camera settings
  private readonly DEFAULT_ALPHA = -Math.PI / 4;
  private readonly DEFAULT_BETA = Math.PI / 3.5;
  private readonly DEFAULT_RADIUS = GRID_SIZE * 1.5;
  private readonly DEFAULT_TARGET = Vector3.Zero();

  constructor(scene: Scene, canvas: HTMLCanvasElement) {
    this.camera = this.setupCamera(scene, canvas);
    this.setupLights(scene);
  }

  /**
   * Configure camera with isometric view and controls
   */
  private setupCamera(scene: Scene, canvas: HTMLCanvasElement): ArcRotateCamera {
    const camera = new ArcRotateCamera(
      'camera',
      this.DEFAULT_ALPHA,      // Alpha (horizontal rotation)
      this.DEFAULT_BETA,       // Beta (vertical angle) - isometric-like
      this.DEFAULT_RADIUS,     // Radius (distance from target)
      this.DEFAULT_TARGET,
      scene
    );
    
    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 5;
    camera.upperRadiusLimit = 25;
    camera.lowerBetaLimit = 0.3;
    camera.upperBetaLimit = Math.PI / 2.5;
    
    // Disable arrow key controls (used for debug unit rotation instead)
    camera.inputs.removeByType('ArcRotateCameraKeyboardMoveInput');
    console.log('Camera arrow key controls disabled - arrow keys now control unit rotation');
    
    return camera;
  }
  
  /**
   * Reset camera to default position and rotation
   */
  public resetCamera(): void {
    this.camera.alpha = this.DEFAULT_ALPHA;
    this.camera.beta = this.DEFAULT_BETA;
    this.camera.radius = this.DEFAULT_RADIUS;
    this.camera.setTarget(this.DEFAULT_TARGET);
  }

  /**
   * Setup lighting and shadows
   */
  private setupLights(scene: Scene): void {
    // Ambient light
    const ambientLight = new HemisphericLight(
      'ambientLight',
      new Vector3(0, 1, 0),
      scene
    );
    ambientLight.intensity = 0.4;
    ambientLight.groundColor = new Color3(0.2, 0.2, 0.3);
    
    // Main directional light (sun)
    const sunLight = new DirectionalLight(
      'sunLight',
      new Vector3(-1, -2, -1).normalize(),
      scene
    );
    sunLight.intensity = 0.8;
    sunLight.position = new Vector3(10, 20, 10);
    
    // Shadow generator
    this.shadowGenerator = new ShadowGenerator(1024, sunLight);
    this.shadowGenerator.useBlurExponentialShadowMap = true;
    this.shadowGenerator.blurKernel = 32;
    this.shadowGenerator.setDarkness(0.3);
  }

  public getCamera(): ArcRotateCamera {
    return this.camera;
  }

  public getShadowGenerator(): ShadowGenerator | null {
    return this.shadowGenerator;
  }
}

