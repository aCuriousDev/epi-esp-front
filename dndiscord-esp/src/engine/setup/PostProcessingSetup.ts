/**
 * PostProcessingSetup - Configures Babylon.js post-processing pipeline
 * 
 * Adds:
 * - Bloom (makes emissive materials and particles glow)
 * - FXAA anti-aliasing (smooth edges)
 * - Tone mapping (cinematic look)
 * - Vignette (dark edges for atmosphere)
 * - Chromatic aberration (subtle, for style)
 * - Image processing (contrast, exposure)
 */

import {
  Scene,
  DefaultRenderingPipeline,
  Camera,
  Color4,
  ImageProcessingConfiguration,
} from '@babylonjs/core';

export class PostProcessingSetup {
  private pipeline: DefaultRenderingPipeline;

  constructor(scene: Scene, camera: Camera) {
    this.pipeline = new DefaultRenderingPipeline(
      'defaultPipeline',
      true, // HDR
      scene,
      [camera]
    );

    this.configureBloom();
    this.configureAntiAliasing();
    this.configureToneMapping(scene);
    this.configureVignette();
    this.configureImageProcessing();

    console.log('Post-processing pipeline initialized');
  }

  /**
   * Bloom: makes emissive materials, particles, and glow layer pop
   */
  private configureBloom(): void {
    this.pipeline.bloomEnabled = true;
    this.pipeline.bloomThreshold = 0.35;
    this.pipeline.bloomWeight = 0.4;
    this.pipeline.bloomKernel = 64;
    this.pipeline.bloomScale = 0.6;
  }

  /**
   * FXAA: lightweight anti-aliasing
   */
  private configureAntiAliasing(): void {
    this.pipeline.fxaaEnabled = true;
  }

  /**
   * Tone mapping for cinematic feel
   */
  private configureToneMapping(scene: Scene): void {
    scene.imageProcessingConfiguration.toneMappingEnabled = true;
    scene.imageProcessingConfiguration.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  }

  /**
   * Vignette: darken screen edges for a dungeon atmosphere
   */
  private configureVignette(): void {
    this.pipeline.imageProcessing.vignetteEnabled = true;
    this.pipeline.imageProcessing.vignetteWeight = 2.5;
    this.pipeline.imageProcessing.vignetteStretch = 0.5;
    this.pipeline.imageProcessing.vignetteColor = new Color4(0, 0, 0, 1);
    this.pipeline.imageProcessing.vignetteCameraFov = 0.8;
  }

  /**
   * Image processing: contrast + exposure tweaks
   */
  private configureImageProcessing(): void {
    this.pipeline.imageProcessing.contrast = 1.2;
    this.pipeline.imageProcessing.exposure = 1.05;
  }

  /**
   * Dynamically adjust post-processing for combat emphasis
   * Combat mode: heavier bloom, deeper vignette, more contrast
   */
  public setCombatMode(active: boolean): void {
    if (active) {
      this.pipeline.bloomWeight = 0.55;
      this.pipeline.bloomThreshold = 0.3;
      this.pipeline.imageProcessing.vignetteWeight = 4.0;
      this.pipeline.imageProcessing.contrast = 1.35;
      this.pipeline.imageProcessing.exposure = 1.1;
      
      // Enable chromatic aberration for combat intensity
      this.pipeline.chromaticAberrationEnabled = true;
      this.pipeline.chromaticAberration.aberrationAmount = 15;
      this.pipeline.chromaticAberration.radialIntensity = 0.8;
    } else {
      this.pipeline.bloomWeight = 0.4;
      this.pipeline.bloomThreshold = 0.35;
      this.pipeline.imageProcessing.vignetteWeight = 2.5;
      this.pipeline.imageProcessing.contrast = 1.2;
      this.pipeline.imageProcessing.exposure = 1.05;
      
      this.pipeline.chromaticAberrationEnabled = false;
    }
  }

  public getPipeline(): DefaultRenderingPipeline {
    return this.pipeline;
  }

  public dispose(): void {
    this.pipeline.dispose();
  }
}
