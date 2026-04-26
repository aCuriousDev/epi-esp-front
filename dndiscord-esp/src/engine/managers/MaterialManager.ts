import {
  Scene,
  StandardMaterial,
  Color3,
  Texture,
} from '@babylonjs/core';

/**
 * MaterialManager - Handles creation and storage of all materials
 */
export class MaterialManager {
  private materials: Map<string, StandardMaterial> = new Map();

  constructor(scene: Scene) {
    this.createAllMaterials(scene);
  }

  /**
   * Create all materials used in the game
   */
  private createAllMaterials(scene: Scene): void {
    this.createFloorMaterial(scene);
    this.createWallMaterial(scene);
    this.createWaterMaterial(scene);
    this.createDungeonMaterial(scene); // For fallback tiles
    this.createBlockBitsMaterial(scene); // For BlockBits pack (bricks, water)
    this.createHighlightMaterial(scene);
    this.createTargetMaterial(scene);
    this.createPathMaterial(scene);
    this.createPlayerMaterial(scene);
    this.createEnemyMaterial(scene);
    this.createSelectedMaterial(scene);
  }

  private createFloorMaterial(scene: Scene): void {
    const mat = new StandardMaterial('floorMat', scene);
    mat.diffuseColor = new Color3(0.4, 0.45, 0.5);
    mat.specularColor = new Color3(0.1, 0.1, 0.1);
    this.materials.set('floor', mat);
  }

  private createWallMaterial(scene: Scene): void {
    const mat = new StandardMaterial('wallMat', scene);
    mat.diffuseColor = new Color3(0.3, 0.3, 0.35);
    mat.specularColor = new Color3(0.05, 0.05, 0.05);
    this.materials.set('wall', mat);
  }

  private createWaterMaterial(scene: Scene): void {
    const mat = new StandardMaterial('waterMat', scene);
    mat.diffuseColor = new Color3(0.2, 0.5, 0.9); // Bright blue
    mat.specularColor = new Color3(0.4, 0.4, 0.6);
    mat.emissiveColor = new Color3(0.08, 0.15, 0.35); // Stronger glow for bloom
    mat.alpha = 0.7; // More transparent
    this.materials.set('water', mat);
  }

  private createDungeonMaterial(scene: Scene): void {
    const mat = new StandardMaterial('dungeonMat', scene);
    // Load dungeon texture for fallback tiles
    const texture = new Texture('/textures/dungeon/dungeon_texture.png', scene);
    mat.diffuseTexture = texture;
    mat.diffuseColor = new Color3(0.6, 0.6, 0.6);
    mat.specularColor = new Color3(0.1, 0.1, 0.1);
    this.materials.set('dungeon', mat);
    console.log('Dungeon material created with texture');
  }

  private createBlockBitsMaterial(scene: Scene): void {
    const mat = new StandardMaterial('blockBitsMat', scene);
    // Load BlockBits texture for bricks and water models
    const texture = new Texture('/textures/blocks/block_bits_texture.png', scene);
    mat.diffuseTexture = texture;
    mat.specularColor = new Color3(0.1, 0.1, 0.1);
    this.materials.set('blockBits', mat);
    console.log('BlockBits material created with texture');
  }

  private createHighlightMaterial(scene: Scene): void {
    const mat = new StandardMaterial('highlightMat', scene);
    mat.diffuseColor = new Color3(0.2, 0.6, 1);
    mat.emissiveColor = new Color3(0.15, 0.4, 0.7); // Stronger glow
    mat.alpha = 0.4;
    this.materials.set('highlight', mat);
  }

  private createTargetMaterial(scene: Scene): void {
    const mat = new StandardMaterial('targetMat', scene);
    mat.diffuseColor = new Color3(1, 0.3, 0.2);
    mat.emissiveColor = new Color3(0.6, 0.15, 0.1); // Stronger red glow
    mat.alpha = 0.4;
    this.materials.set('target', mat);
  }

  private createPathMaterial(scene: Scene): void {
    const mat = new StandardMaterial('pathMat', scene);
    mat.diffuseColor = new Color3(0.3, 0.8, 0.3);
    mat.emissiveColor = new Color3(0.2, 0.5, 0.2); // Stronger green glow
    mat.alpha = 0.6;
    this.materials.set('path', mat);
  }

  private createPlayerMaterial(scene: Scene): void {
    const mat = new StandardMaterial('playerMat', scene);
    mat.diffuseColor = new Color3(0.2, 0.5, 0.9);
    mat.specularColor = new Color3(0.3, 0.3, 0.3);
    this.materials.set('player', mat);
  }

  private createEnemyMaterial(scene: Scene): void {
    const mat = new StandardMaterial('enemyMat', scene);
    mat.diffuseColor = new Color3(0.9, 0.2, 0.2);
    mat.specularColor = new Color3(0.3, 0.3, 0.3);
    this.materials.set('enemy', mat);
  }

  private createSelectedMaterial(scene: Scene): void {
    const mat = new StandardMaterial('selectedMat', scene);
    mat.diffuseColor = new Color3(1, 0.8, 0.2);
    mat.emissiveColor = new Color3(0.5, 0.4, 0.1); // Stronger golden glow
    this.materials.set('selected', mat);
  }

  /**
   * Get a specific material by name
   */
  public getMaterial(name: string): StandardMaterial | undefined {
    return this.materials.get(name);
  }

  /**
   * Get all materials
   */
  public getMaterials(): Map<string, StandardMaterial> {
    return this.materials;
  }
}

