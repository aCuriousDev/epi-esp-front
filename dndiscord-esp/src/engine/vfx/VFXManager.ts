/**
 * VFXManager - Central manager for all visual effects
 * 
 * Handles:
 * - Particle systems (spells, impacts, ambient)
 * - Procedural animations (idle bob, selection pulse, death)
 * - Scene-level effects (fog, ambient particles)
 * 
 * All VFX are fire-and-forget: they auto-dispose after completion.
 */

import {
  Scene,
  ParticleSystem,
  Texture,
  Color4,
  Color3,
  Vector3,
  MeshBuilder,
  Mesh,
  AbstractMesh,
  Animation,
  EasingFunction,
  SineEase,
  QuadraticEase,
  StandardMaterial,
  GlowLayer,
  TransformNode,
  ArcRotateCamera,
} from '@babylonjs/core';
import { GridPosition } from '../../types';
import { gridToWorld, TILE_SIZE } from '../../game';

/** Parameters for spell VFX */
export interface SpellVFXParams {
  origin: GridPosition;
  target: GridPosition;
  type: 'fire' | 'ice' | 'physical' | 'lightning' | 'holy' | 'dark' | 'magical';
  aoeRadius?: number;
  /** Optional ability ID for ability-specific VFX (e.g. arrow_shot vs slash) */
  abilityId?: string;
}

/** Parameters for impact VFX */
export interface ImpactVFXParams {
  position: GridPosition;
  type: 'damage' | 'heal' | 'buff' | 'debuff';
  value?: number;
}

export class VFXManager {
  private scene: Scene;
  private glowLayer: GlowLayer;
  private idleAnimations: Map<string, Animation[]> = new Map();
  private selectionPulseObserver: any = null;
  private ambientSystems: ParticleSystem[] = [];
  private ambientBaseEmitRates: Map<ParticleSystem, number> = new Map();
  private ambientDensityMultiplier = 1.0;
  private activeParticleSystems: Set<ParticleSystem> = new Set();

  // Reusable particle texture (white radial gradient circle)
  private particleTexture: Texture;

  constructor(scene: Scene, glowLayer: GlowLayer) {
    this.scene = scene;
    this.glowLayer = glowLayer;
    // Generate a procedural flare texture (radial gradient white circle)
    this.particleTexture = this.createProceduralFlare();
  }

  /**
   * Create a procedural flare texture (white radial gradient on transparent background)
   * This avoids needing an external flare.png file.
   */
  private createProceduralFlare(): Texture {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    
    const gradient = ctx.createRadialGradient(
      size / 2, size / 2, 0,
      size / 2, size / 2, size / 2
    );
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.2)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    
    const texture = new Texture(canvas.toDataURL(), this.scene);
    texture.hasAlpha = true;
    return texture;
  }

  // ========================================
  // SPELL VFX
  // ========================================

  /**
   * Play a spell visual effect from origin to target
   */
  public async playSpellVFX(params: SpellVFXParams): Promise<void> {
    const originWorld = gridToWorld(params.origin);
    const targetWorld = gridToWorld(params.target);

    // Ability-specific overrides for physical attacks
    if (params.type === 'physical' && params.abilityId) {
      switch (params.abilityId) {
        case 'arrow_shot':
          await this.playArrowShot(originWorld, targetWorld);
          return;
        case 'shield_bash':
          await this.playShieldBash(originWorld, targetWorld);
          return;
        case 'claw':
          await this.playClawAttack(targetWorld);
          return;
      }
    }

    switch (params.type) {
      case 'fire':
        await this.playFireball(originWorld, targetWorld, params.aoeRadius || 0);
        break;
      case 'ice':
        await this.playIceShard(originWorld, targetWorld);
        break;
      case 'physical':
        await this.playSlashEffect(originWorld, targetWorld);
        break;
      case 'lightning':
        await this.playLightningEffect(originWorld, targetWorld);
        break;
      case 'holy':
        await this.playHolyEffect(targetWorld);
        break;
      case 'dark':
        await this.playDarkEffect(targetWorld);
        break;
      case 'magical':
        await this.playMagicMissile(originWorld, targetWorld);
        break;
    }
  }

  /**
   * Fireball: glowing sphere mesh + massive fire trail + ground fire ring + explosion + lingering flames
   */
  private async playFireball(
    origin: { x: number; z: number },
    target: { x: number; z: number },
    aoeRadius: number
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      // Glowing fireball mesh (visible sphere that travels)
      const fireballMesh = MeshBuilder.CreateSphere('fireball_sphere', { diameter: 0.3, segments: 8 }, this.scene);
      const fbMat = new StandardMaterial('fireball_mat', this.scene);
      fbMat.emissiveColor = new Color3(1, 0.5, 0);
      fbMat.diffuseColor = new Color3(1, 0.3, 0);
      fbMat.specularColor = new Color3(1, 0.8, 0.3);
      fbMat.alpha = 0.95;
      fireballMesh.material = fbMat;
      fireballMesh.position = new Vector3(origin.x, 0.9, origin.z);
      this.glowLayer.addIncludedOnlyMesh(fireballMesh);

      // Inner bright core
      const coreMesh = MeshBuilder.CreateSphere('fireball_core', { diameter: 0.15, segments: 6 }, this.scene);
      const coreMat = new StandardMaterial('fireball_core_mat', this.scene);
      coreMat.emissiveColor = new Color3(1, 1, 0.6);
      coreMat.diffuseColor = new Color3(1, 1, 0.8);
      coreMat.alpha = 0.9;
      coreMesh.material = coreMat;
      coreMesh.parent = fireballMesh;
      this.glowLayer.addIncludedOnlyMesh(coreMesh);

      // Massive fire trail behind the fireball
      const trail = this.createParticleSystem('fireball_trail', 250);
      trail.emitter = fireballMesh;
      trail.minSize = 0.1;
      trail.maxSize = 0.5;
      trail.minLifeTime = 0.2;
      trail.maxLifeTime = 0.7;
      trail.emitRate = 300;
      trail.color1 = new Color4(1, 0.8, 0.1, 1);
      trail.color2 = new Color4(1, 0.35, 0, 1);
      trail.colorDead = new Color4(0.5, 0.1, 0, 0);
      trail.minEmitPower = 0.3;
      trail.maxEmitPower = 1.2;
      trail.direction1 = new Vector3(-0.5, 0.2, -0.5);
      trail.direction2 = new Vector3(0.5, 0.8, 0.5);
      trail.gravity = new Vector3(0, -1, 0);
      trail.addSizeGradient(0, 0.4);
      trail.addSizeGradient(0.3, 0.25);
      trail.addSizeGradient(1, 0);
      trail.minAngularSpeed = -2;
      trail.maxAngularSpeed = 2;
      trail.start();

      // Smoke trail (dark particles behind the fire)
      const smoke = this.createParticleSystem('fireball_smoke', 80);
      smoke.emitter = fireballMesh;
      smoke.minSize = 0.08;
      smoke.maxSize = 0.3;
      smoke.minLifeTime = 0.4;
      smoke.maxLifeTime = 0.9;
      smoke.emitRate = 60;
      smoke.color1 = new Color4(0.3, 0.2, 0.1, 0.4);
      smoke.color2 = new Color4(0.15, 0.1, 0.05, 0.25);
      smoke.colorDead = new Color4(0.1, 0.05, 0, 0);
      smoke.minEmitPower = 0.1;
      smoke.maxEmitPower = 0.4;
      smoke.direction1 = new Vector3(-0.3, 0.5, -0.3);
      smoke.direction2 = new Vector3(0.3, 1, 0.3);
      smoke.gravity = new Vector3(0, 0.5, 0);
      smoke.addSizeGradient(0, 0.15);
      smoke.addSizeGradient(1, 0);
      smoke.start();

      // Fireball pulsing scale animation (throbs as it flies)
      const pulseAnim = new Animation(
        'fb_pulse', 'scaling', 60,
        Animation.ANIMATIONTYPE_VECTOR3,
        Animation.ANIMATIONLOOPMODE_CYCLE
      );
      pulseAnim.setKeys([
        { frame: 0, value: new Vector3(1, 1, 1) },
        { frame: 5, value: new Vector3(1.2, 1.2, 1.2) },
        { frame: 10, value: new Vector3(0.9, 0.9, 0.9) },
        { frame: 15, value: new Vector3(1, 1, 1) },
      ]);

      // Animate fireball from origin to target
      const moveAnim = new Animation(
        'fireball_move', 'position', 60,
        Animation.ANIMATIONTYPE_VECTOR3,
        Animation.ANIMATIONLOOPMODE_CONSTANT
      );
      const targetPos = new Vector3(target.x, 0.9, target.z);
      moveAnim.setKeys([
        { frame: 0, value: fireballMesh.position.clone() },
        { frame: 25, value: targetPos },
      ]);
      fireballMesh.animations = [moveAnim, pulseAnim];

      this.scene.beginAnimation(fireballMesh, 0, 25, false, 1, () => {
        trail.stop();
        smoke.stop();

        // === EXPLOSION PHASE ===
        // 1. Main explosion particles
        this.playExplosion(target, aoeRadius, 'fire');
        
        // 2. Ground fire ring (expanding ring of flame)
        this.playGroundFireRing(target, aoeRadius);
        
        // 3. Shockwave ring (fast expanding transparent disc)
        this.playShockwaveRing(target, aoeRadius);
        
        // 4. Lingering ground flames
        this.playLingeringFlames(target, aoeRadius);
        
        // 5. Upward ember shower
        this.playEmberShower(target, aoeRadius);

        // Camera shake on impact
        this.shakeCamera(0.15 + aoeRadius * 0.05, 350);

        // Cleanup projectile
        setTimeout(() => {
          trail.dispose();
          smoke.dispose();
          fireballMesh.dispose();
          fbMat.dispose();
          coreMesh.dispose();
          coreMat.dispose();
          resolve();
        }, 800);
      });
    });
  }

  /**
   * Expanding ground fire ring at explosion point
   */
  private playGroundFireRing(pos: { x: number; z: number }, radius: number): void {
    const ring = MeshBuilder.CreateTorus('fire_ring', {
      diameter: 0.3, thickness: 0.06, tessellation: 32,
    }, this.scene);
    ring.position = new Vector3(pos.x, 0.1, pos.z);
    
    const ringMat = new StandardMaterial('fire_ring_mat', this.scene);
    ringMat.emissiveColor = new Color3(1, 0.5, 0);
    ringMat.diffuseColor = new Color3(1, 0.3, 0);
    ringMat.alpha = 0.8;
    ring.material = ringMat;
    this.glowLayer.addIncludedOnlyMesh(ring);

    // Expand + fade animation
    const expandAnim = new Animation(
      'fire_ring_expand', 'scaling', 60,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    const maxScale = 3 + radius * 2;
    expandAnim.setKeys([
      { frame: 0, value: new Vector3(1, 1, 1) },
      { frame: 20, value: new Vector3(maxScale, 1, maxScale) },
      { frame: 35, value: new Vector3(maxScale * 1.2, 0.5, maxScale * 1.2) },
    ]);

    const fadeAnim = new Animation(
      'fire_ring_fade', 'material.alpha', 60,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    fadeAnim.setKeys([
      { frame: 0, value: 0.9 },
      { frame: 15, value: 0.6 },
      { frame: 35, value: 0 },
    ]);

    ring.animations = [expandAnim, fadeAnim];
    this.scene.beginAnimation(ring, 0, 35, false, 1, () => {
      ring.dispose();
      ringMat.dispose();
    });
  }

  /**
   * Fast-expanding transparent shockwave disc
   */
  private playShockwaveRing(pos: { x: number; z: number }, radius: number): void {
    const disc = MeshBuilder.CreateDisc('shockwave', { radius: 0.2, tessellation: 32 }, this.scene);
    disc.position = new Vector3(pos.x, 0.15, pos.z);
    disc.rotation.x = Math.PI / 2; // Lay flat

    const discMat = new StandardMaterial('shockwave_mat', this.scene);
    discMat.emissiveColor = new Color3(1, 0.7, 0.2);
    discMat.diffuseColor = new Color3(1, 0.6, 0.1);
    discMat.alpha = 0.5;
    discMat.backFaceCulling = false;
    disc.material = discMat;

    const maxScale = 8 + radius * 4;
    const expandAnim = new Animation(
      'shockwave_expand', 'scaling', 60,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    expandAnim.setKeys([
      { frame: 0, value: new Vector3(1, 1, 1) },
      { frame: 12, value: new Vector3(maxScale, maxScale, 1) },
    ]);

    const fadeAnim = new Animation(
      'shockwave_fade', 'material.alpha', 60,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    fadeAnim.setKeys([
      { frame: 0, value: 0.6 },
      { frame: 12, value: 0 },
    ]);

    disc.animations = [expandAnim, fadeAnim];
    this.scene.beginAnimation(disc, 0, 12, false, 1, () => {
      disc.dispose();
      discMat.dispose();
    });
  }

  /**
   * Lingering ground flames after fireball explosion
   */
  private playLingeringFlames(pos: { x: number; z: number }, radius: number): void {
    const flameRadius = 0.3 + radius * 0.25;
    const system = this.createParticleSystem('lingering_flames', 150);
    system.emitter = new Vector3(pos.x, 0.05, pos.z);
    system.createCylinderEmitter(flameRadius, 0.05, 0, 0);
    system.minSize = 0.06;
    system.maxSize = 0.22;
    system.minLifeTime = 0.2;
    system.maxLifeTime = 0.5;
    system.emitRate = 80;
    system.minEmitPower = 0.3;
    system.maxEmitPower = 0.8;
    system.direction1 = new Vector3(-0.15, 0.8, -0.15);
    system.direction2 = new Vector3(0.15, 1.5, 0.15);
    system.gravity = new Vector3(0, 0.5, 0);
    system.color1 = new Color4(1, 0.6, 0, 0.9);
    system.color2 = new Color4(1, 0.25, 0, 0.7);
    system.colorDead = new Color4(0.3, 0.05, 0, 0);
    system.addSizeGradient(0, 0.15);
    system.addSizeGradient(0.5, 0.1);
    system.addSizeGradient(1, 0);
    system.start();
    this.activeParticleSystems.add(system);

    // Stop after 1.5 seconds
    setTimeout(() => {
      system.stop();
      setTimeout(() => {
        system.dispose();
        this.activeParticleSystems.delete(system);
      }, 600);
    }, 1500);
  }

  /**
   * Upward ember shower from explosion
   */
  private playEmberShower(pos: { x: number; z: number }, radius: number): void {
    const system = this.createParticleSystem('ember_shower', 100);
    system.emitter = new Vector3(pos.x, 0.3, pos.z);
    system.minSize = 0.02;
    system.maxSize = 0.08;
    system.minLifeTime = 0.8;
    system.maxLifeTime = 2.0;
    system.emitRate = 0;
    system.manualEmitCount = 60 + radius * 20;
    system.minEmitPower = 1;
    system.maxEmitPower = 3;
    system.direction1 = new Vector3(-1, 3, -1);
    system.direction2 = new Vector3(1, 5, 1);
    system.gravity = new Vector3(0, -1.5, 0);
    system.color1 = new Color4(1, 0.7, 0.1, 1);
    system.color2 = new Color4(1, 0.4, 0, 0.8);
    system.colorDead = new Color4(0.3, 0.1, 0, 0);
    system.addSizeGradient(0, 0.06);
    system.addSizeGradient(1, 0);
    system.minAngularSpeed = -3;
    system.maxAngularSpeed = 3;
    system.targetStopDuration = 1;
    system.disposeOnStop = true;
    system.start();
    this.activeParticleSystems.add(system);
    system.onDisposeObservable.addOnce(() => this.activeParticleSystems.delete(system));
  }

  /**
   * Explosion effect (used by fireball AOE)
   */
  private playExplosion(
    pos: { x: number; z: number },
    radius: number,
    type: 'fire' | 'ice'
  ): void {
    const emitterPos = new Vector3(pos.x, 0.5, pos.z);
    const system = this.createParticleSystem('explosion', 400);
    system.emitter = emitterPos;
    system.minSize = 0.15;
    system.maxSize = 0.6 + radius * 0.2;
    system.minLifeTime = 0.4;
    system.maxLifeTime = 1.0;
    system.emitRate = 0; // Use manual emit
    system.manualEmitCount = 120 + radius * 40;
    system.minEmitPower = 1.5 + radius * 0.5;
    system.maxEmitPower = 4 + radius * 1.2;
    system.direction1 = new Vector3(-1.5, 1.5, -1.5);
    system.direction2 = new Vector3(1.5, 3, 1.5);
    system.gravity = new Vector3(0, -4, 0);

    if (type === 'fire') {
      system.color1 = new Color4(1, 0.8, 0, 1);
      system.color2 = new Color4(1, 0.3, 0, 1);
      system.colorDead = new Color4(0.2, 0.05, 0, 0);
    } else {
      system.color1 = new Color4(0.7, 0.9, 1, 1);
      system.color2 = new Color4(0.3, 0.5, 1, 1);
      system.colorDead = new Color4(0.1, 0.2, 0.5, 0);
    }

    system.addSizeGradient(0, 0.3);
    system.addSizeGradient(0.5, 0.15);
    system.addSizeGradient(1, 0);
    system.targetStopDuration = 0.5;
    system.disposeOnStop = true;
    system.start();
    this.activeParticleSystems.add(system);
    system.onDisposeObservable.addOnce(() => this.activeParticleSystems.delete(system));
  }

  /**
   * Frost ground effect: icy disc + cold mist particles at impact
   */
  private playFrostGround(pos: { x: number; z: number }): void {
    // Icy ground disc
    const disc = MeshBuilder.CreateDisc('frost_ground', { radius: 0.5, tessellation: 24 }, this.scene);
    disc.position = new Vector3(pos.x, 0.08, pos.z);
    disc.rotation.x = Math.PI / 2;
    const discMat = new StandardMaterial('frost_ground_mat', this.scene);
    discMat.emissiveColor = new Color3(0.3, 0.6, 1);
    discMat.diffuseColor = new Color3(0.5, 0.8, 1);
    discMat.alpha = 0.6;
    discMat.backFaceCulling = false;
    disc.material = discMat;
    this.glowLayer.addIncludedOnlyMesh(disc);

    // Expand then fade
    const expandAnim = new Animation(
      'frost_expand', 'scaling', 60,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    expandAnim.setKeys([
      { frame: 0, value: new Vector3(0.2, 0.2, 1) },
      { frame: 10, value: new Vector3(1.3, 1.3, 1) },
      { frame: 60, value: new Vector3(1.5, 1.5, 1) },
      { frame: 90, value: new Vector3(1.2, 1.2, 1) },
    ]);
    const fadeAnim = new Animation(
      'frost_fade', 'material.alpha', 60,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    fadeAnim.setKeys([
      { frame: 0, value: 0.7 },
      { frame: 10, value: 0.6 },
      { frame: 60, value: 0.4 },
      { frame: 90, value: 0 },
    ]);
    disc.animations = [expandAnim, fadeAnim];
    this.scene.beginAnimation(disc, 0, 90, false, 1, () => {
      disc.dispose();
      discMat.dispose();
    });

    // Cold mist particles rising
    const mist = this.createParticleSystem('frost_mist', 60);
    mist.emitter = new Vector3(pos.x, 0.05, pos.z);
    mist.createCylinderEmitter(0.4, 0.02, 0, 0);
    mist.minSize = 0.06;
    mist.maxSize = 0.2;
    mist.minLifeTime = 0.5;
    mist.maxLifeTime = 1.2;
    mist.emitRate = 30;
    mist.minEmitPower = 0.1;
    mist.maxEmitPower = 0.3;
    mist.gravity = new Vector3(0, 0.3, 0);
    mist.color1 = new Color4(0.7, 0.85, 1, 0.3);
    mist.color2 = new Color4(0.5, 0.7, 1, 0.2);
    mist.colorDead = new Color4(0.3, 0.5, 0.8, 0);
    mist.addSizeGradient(0, 0.1);
    mist.addSizeGradient(0.5, 0.18);
    mist.addSizeGradient(1, 0);
    mist.start();
    this.activeParticleSystems.add(mist);

    setTimeout(() => {
      mist.stop();
      setTimeout(() => {
        mist.dispose();
        this.activeParticleSystems.delete(mist);
      }, 1200);
    }, 1000);
  }

  /**
   * Ice Shard: blue/white projectile with frost trail
   */
  private async playIceShard(
    origin: { x: number; z: number },
    target: { x: number; z: number }
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      const emitter = this.createEmitterMesh('ice_emitter');
      emitter.position = new Vector3(origin.x, 0.8, origin.z);

      // Create a small glowing ice mesh
      const shard = MeshBuilder.CreateIcoSphere('ice_shard', { radius: 0.12, subdivisions: 2 }, this.scene);
      shard.parent = emitter;
      const mat = new StandardMaterial('ice_mat', this.scene);
      mat.emissiveColor = new Color3(0.3, 0.6, 1);
      mat.diffuseColor = new Color3(0.5, 0.8, 1);
      mat.alpha = 0.85;
      shard.material = mat;
      this.glowLayer.addIncludedOnlyMesh(shard);

      // Frost trail
      const trail = this.createParticleSystem('ice_trail', 40);
      trail.emitter = emitter;
      trail.minSize = 0.04;
      trail.maxSize = 0.15;
      trail.minLifeTime = 0.2;
      trail.maxLifeTime = 0.5;
      trail.emitRate = 80;
      trail.color1 = new Color4(0.7, 0.9, 1, 0.8);
      trail.color2 = new Color4(0.3, 0.5, 1, 0.6);
      trail.colorDead = new Color4(0.1, 0.2, 0.4, 0);
      trail.minEmitPower = 0.05;
      trail.maxEmitPower = 0.3;
      trail.direction1 = new Vector3(-0.2, 0.1, -0.2);
      trail.direction2 = new Vector3(0.2, 0.3, 0.2);
      trail.gravity = new Vector3(0, -0.2, 0);
      trail.start();

      const targetPos = new Vector3(target.x, 0.8, target.z);
      const moveAnim = new Animation(
        'ice_move', 'position', 60,
        Animation.ANIMATIONTYPE_VECTOR3,
        Animation.ANIMATIONLOOPMODE_CONSTANT
      );
      moveAnim.setKeys([
        { frame: 0, value: emitter.position.clone() },
        { frame: 15, value: targetPos },
      ]);
      emitter.animations = [moveAnim];

      this.scene.beginAnimation(emitter, 0, 15, false, 1, () => {
        trail.stop();
        this.playExplosion(target, 0, 'ice');
        this.playFrostGround(target);
        setTimeout(() => {
          trail.dispose();
          shard.dispose();
          mat.dispose();
          emitter.dispose();
          resolve();
        }, 500);
      });
    });
  }

  /**
   * Sword slash: visible arc mesh + directional sparks + impact flash + metallic sparks
   */
  private async playSlashEffect(
    origin: { x: number; z: number },
    target: { x: number; z: number }
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      const pos = new Vector3(target.x, 0.6, target.z);
      
      // Calculate slash direction from attacker to target
      const dx = target.x - origin.x;
      const dz = target.z - origin.z;
      const angle = Math.atan2(dx, dz);

      // --- Visible slash arc mesh (curved plane) ---
      const arc = MeshBuilder.CreateDisc('slash_arc', { radius: 0.6, tessellation: 16, arc: 0.4 }, this.scene);
      arc.position = pos.clone();
      arc.position.y = 0.7;
      arc.rotation.x = Math.PI / 6; // Slight tilt
      arc.rotation.y = angle;

      const arcMat = new StandardMaterial('slash_arc_mat', this.scene);
      arcMat.emissiveColor = new Color3(1, 1, 0.9);
      arcMat.diffuseColor = new Color3(0.9, 0.9, 0.8);
      arcMat.alpha = 0.9;
      arcMat.backFaceCulling = false;
      arc.material = arcMat;
      this.glowLayer.addIncludedOnlyMesh(arc);

      // Slash arc animation: scale up fast then fade
      const slashScale = new Animation(
        'slash_scale', 'scaling', 60,
        Animation.ANIMATIONTYPE_VECTOR3,
        Animation.ANIMATIONLOOPMODE_CONSTANT
      );
      slashScale.setKeys([
        { frame: 0, value: new Vector3(0.1, 0.3, 0.1) },
        { frame: 4, value: new Vector3(1.3, 1.1, 1.3) },
        { frame: 8, value: new Vector3(1.5, 0.5, 1.5) },
        { frame: 12, value: new Vector3(1.6, 0.1, 1.6) },
      ]);

      const slashFade = new Animation(
        'slash_fade', 'material.alpha', 60,
        Animation.ANIMATIONTYPE_FLOAT,
        Animation.ANIMATIONLOOPMODE_CONSTANT
      );
      slashFade.setKeys([
        { frame: 0, value: 0.9 },
        { frame: 4, value: 1 },
        { frame: 8, value: 0.5 },
        { frame: 12, value: 0 },
      ]);

      // Slash rotation sweep
      const slashSweep = new Animation(
        'slash_sweep', 'rotation.z', 60,
        Animation.ANIMATIONTYPE_FLOAT,
        Animation.ANIMATIONLOOPMODE_CONSTANT
      );
      slashSweep.setKeys([
        { frame: 0, value: -0.6 },
        { frame: 6, value: 0.8 },
        { frame: 12, value: 1.2 },
      ]);

      arc.animations = [slashScale, slashFade, slashSweep];
      this.scene.beginAnimation(arc, 0, 12, false, 1, () => {
        arc.dispose();
        arcMat.dispose();
      });

      // --- Directional metallic sparks ---
      const sparks = this.createParticleSystem('slash_sparks', 80);
      sparks.emitter = pos;
      sparks.minSize = 0.02;
      sparks.maxSize = 0.1;
      sparks.minLifeTime = 0.1;
      sparks.maxLifeTime = 0.35;
      sparks.emitRate = 0;
      sparks.manualEmitCount = 60;
      sparks.minEmitPower = 2;
      sparks.maxEmitPower = 6;
      // Sparks fly perpendicular to attack direction
      sparks.direction1 = new Vector3(-dz * 2 - 0.5, 0.5, dx * 2 - 0.5);
      sparks.direction2 = new Vector3(-dz * 2 + 0.5, 2, dx * 2 + 0.5);
      sparks.gravity = new Vector3(0, -4, 0);
      sparks.color1 = new Color4(1, 1, 0.9, 1);
      sparks.color2 = new Color4(1, 0.9, 0.6, 0.9);
      sparks.colorDead = new Color4(0.6, 0.5, 0.3, 0);
      sparks.addSizeGradient(0, 0.08);
      sparks.addSizeGradient(1, 0);
      sparks.targetStopDuration = 0.3;
      sparks.disposeOnStop = true;
      sparks.start();
      this.activeParticleSystems.add(sparks);
      sparks.onDisposeObservable.addOnce(() => this.activeParticleSystems.delete(sparks));

      // --- Impact flash (brief bright burst) ---
      const flash = MeshBuilder.CreatePlane('slash_flash', { size: 0.8 }, this.scene);
      flash.position = pos.clone();
      flash.position.y = 0.8;
      flash.billboardMode = Mesh.BILLBOARDMODE_ALL;
      const flashMat = new StandardMaterial('slash_flash_mat', this.scene);
      flashMat.emissiveColor = new Color3(1, 1, 0.8);
      flashMat.alpha = 0.8;
      flashMat.backFaceCulling = false;
      flash.material = flashMat;
      this.glowLayer.addIncludedOnlyMesh(flash);

      const flashScaleAnim = new Animation(
        'flash_scale', 'scaling', 60,
        Animation.ANIMATIONTYPE_VECTOR3,
        Animation.ANIMATIONLOOPMODE_CONSTANT
      );
      flashScaleAnim.setKeys([
        { frame: 0, value: new Vector3(0.2, 0.2, 0.2) },
        { frame: 3, value: new Vector3(1.2, 1.2, 1.2) },
        { frame: 8, value: new Vector3(0.1, 0.1, 0.1) },
      ]);
      const flashFadeAnim = new Animation(
        'flash_fade', 'material.alpha', 60,
        Animation.ANIMATIONTYPE_FLOAT,
        Animation.ANIMATIONLOOPMODE_CONSTANT
      );
      flashFadeAnim.setKeys([
        { frame: 0, value: 0.9 },
        { frame: 3, value: 1 },
        { frame: 8, value: 0 },
      ]);
      flash.animations = [flashScaleAnim, flashFadeAnim];
      this.scene.beginAnimation(flash, 0, 8, false, 1, () => {
        flash.dispose();
        flashMat.dispose();
      });

      setTimeout(resolve, 300);
    });
  }

  /**
   * Lightning bolt: vertical spark column at target
   */
  private async playLightningEffect(
    _origin: { x: number; z: number },
    target: { x: number; z: number }
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      const pos = new Vector3(target.x, 0, target.z);
      // Upward bolt
      const system = this.createParticleSystem('lightning', 200);
      system.emitter = pos;
      system.minSize = 0.03;
      system.maxSize = 0.15;
      system.minLifeTime = 0.08;
      system.maxLifeTime = 0.3;
      system.emitRate = 0;
      system.manualEmitCount = 150;
      system.minEmitPower = 4;
      system.maxEmitPower = 12;
      system.direction1 = new Vector3(-0.5, 5, -0.5);
      system.direction2 = new Vector3(0.5, 8, 0.5);
      system.gravity = new Vector3(0, 0, 0);
      system.color1 = new Color4(0.9, 0.95, 1, 1);
      system.color2 = new Color4(0.5, 0.7, 1, 1);
      system.colorDead = new Color4(0.3, 0.4, 1, 0);
      system.addSizeGradient(0, 0.12);
      system.addSizeGradient(0.5, 0.06);
      system.addSizeGradient(1, 0);
      system.targetStopDuration = 0.2;
      system.disposeOnStop = true;
      system.start();
      this.activeParticleSystems.add(system);
      system.onDisposeObservable.addOnce(() => this.activeParticleSystems.delete(system));
      setTimeout(resolve, 400);
    });
  }

  /**
   * Holy effect: golden rising sparkles at target
   */
  private async playHolyEffect(target: { x: number; z: number }): Promise<void> {
    return new Promise<void>((resolve) => {
      const pos = new Vector3(target.x, 0.1, target.z);
      const system = this.createParticleSystem('holy', 60);
      system.emitter = pos;
      system.createCylinderEmitter(0.5, 0.1, 0, 0);
      system.minSize = 0.05;
      system.maxSize = 0.15;
      system.minLifeTime = 0.5;
      system.maxLifeTime = 1.2;
      system.emitRate = 0;
      system.manualEmitCount = 50;
      system.minEmitPower = 0.5;
      system.maxEmitPower = 1.5;
      system.gravity = new Vector3(0, 1, 0); // Float upward
      system.color1 = new Color4(1, 0.9, 0.4, 1);
      system.color2 = new Color4(1, 0.8, 0.2, 0.8);
      system.colorDead = new Color4(1, 0.6, 0, 0);
      system.addSizeGradient(0, 0.1);
      system.addSizeGradient(0.5, 0.15);
      system.addSizeGradient(1, 0);
      system.targetStopDuration = 1;
      system.disposeOnStop = true;
      system.start();
      this.activeParticleSystems.add(system);
      system.onDisposeObservable.addOnce(() => this.activeParticleSystems.delete(system));
      setTimeout(resolve, 800);
    });
  }

  /**
   * Dark effect: purple/black swirling vortex at target
   */
  private async playDarkEffect(target: { x: number; z: number }): Promise<void> {
    return new Promise<void>((resolve) => {
      const pos = new Vector3(target.x, 0.5, target.z);
      const system = this.createParticleSystem('dark', 80);
      system.emitter = pos;
      system.createCylinderEmitter(0.6, 0.3, 0, 0);
      system.minSize = 0.06;
      system.maxSize = 0.2;
      system.minLifeTime = 0.4;
      system.maxLifeTime = 1.0;
      system.emitRate = 0;
      system.manualEmitCount = 60;
      system.minEmitPower = 0.3;
      system.maxEmitPower = 1;
      system.gravity = new Vector3(0, -0.5, 0);
      system.color1 = new Color4(0.5, 0, 0.8, 1);
      system.color2 = new Color4(0.2, 0, 0.4, 0.8);
      system.colorDead = new Color4(0.1, 0, 0.1, 0);
      system.addSizeGradient(0, 0.05);
      system.addSizeGradient(0.3, 0.2);
      system.addSizeGradient(1, 0);
      // Swirl via angular speed
      system.minAngularSpeed = -4;
      system.maxAngularSpeed = 4;
      system.targetStopDuration = 0.6;
      system.disposeOnStop = true;
      system.start();
      this.activeParticleSystems.add(system);
      system.onDisposeObservable.addOnce(() => this.activeParticleSystems.delete(system));
      setTimeout(resolve, 700);
    });
  }

  /**
   * Magic Missile: generic purple/blue projectile
   */
  private async playMagicMissile(
    origin: { x: number; z: number },
    target: { x: number; z: number }
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      const emitter = this.createEmitterMesh('magic_emitter');
      emitter.position = new Vector3(origin.x, 0.8, origin.z);

      const trail = this.createParticleSystem('magic_trail', 40);
      trail.emitter = emitter;
      trail.minSize = 0.04;
      trail.maxSize = 0.14;
      trail.minLifeTime = 0.15;
      trail.maxLifeTime = 0.35;
      trail.emitRate = 80;
      trail.color1 = new Color4(0.6, 0.3, 1, 1);
      trail.color2 = new Color4(0.3, 0.1, 0.8, 0.7);
      trail.colorDead = new Color4(0.1, 0, 0.3, 0);
      trail.minEmitPower = 0.05;
      trail.maxEmitPower = 0.3;
      trail.direction1 = new Vector3(-0.2, 0.1, -0.2);
      trail.direction2 = new Vector3(0.2, 0.3, 0.2);
      trail.gravity = Vector3.Zero();
      trail.start();

      const targetPos = new Vector3(target.x, 0.8, target.z);
      const moveAnim = new Animation(
        'magic_move', 'position', 60,
        Animation.ANIMATIONTYPE_VECTOR3,
        Animation.ANIMATIONLOOPMODE_CONSTANT
      );
      moveAnim.setKeys([
        { frame: 0, value: emitter.position.clone() },
        { frame: 18, value: targetPos },
      ]);
      emitter.animations = [moveAnim];

      this.scene.beginAnimation(emitter, 0, 18, false, 1, () => {
        trail.stop();
        setTimeout(() => {
          trail.dispose();
          emitter.dispose();
          resolve();
        }, 400);
      });
    });
  }

  // ========================================
  // ABILITY-SPECIFIC VFX
  // ========================================

  /**
   * Arrow Shot: visible arrow mesh projectile with feather trail + impact sparks
   */
  private async playArrowShot(
    origin: { x: number; z: number },
    target: { x: number; z: number }
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      // Calculate direction for arrow orientation
      const dx = target.x - origin.x;
      const dz = target.z - origin.z;
      const angle = Math.atan2(dx, dz);

      // Arrow shaft (elongated box)
      const shaft = MeshBuilder.CreateBox('arrow_shaft', { width: 0.04, height: 0.04, depth: 0.45 }, this.scene);
      shaft.position = new Vector3(origin.x, 0.85, origin.z);
      shaft.rotation.y = angle;
      shaft.rotation.x = 0.1; // Slight upward angle
      const shaftMat = new StandardMaterial('arrow_shaft_mat', this.scene);
      shaftMat.diffuseColor = new Color3(0.55, 0.35, 0.15);
      shaftMat.emissiveColor = new Color3(0.15, 0.08, 0.02);
      shaft.material = shaftMat;

      // Arrow tip (small pyramid shape using cone)
      const tip = MeshBuilder.CreateCylinder('arrow_tip', {
        diameterTop: 0,
        diameterBottom: 0.08,
        height: 0.12,
        tessellation: 4,
      }, this.scene);
      tip.parent = shaft;
      tip.position.z = 0.25;
      tip.rotation.x = Math.PI / 2;
      const tipMat = new StandardMaterial('arrow_tip_mat', this.scene);
      tipMat.diffuseColor = new Color3(0.7, 0.7, 0.75);
      tipMat.emissiveColor = new Color3(0.3, 0.3, 0.35);
      tipMat.specularColor = new Color3(1, 1, 1);
      tip.material = tipMat;

      // Arrow fletching (small fins at the back)
      const fletch = MeshBuilder.CreatePlane('arrow_fletch', { width: 0.12, height: 0.08 }, this.scene);
      fletch.parent = shaft;
      fletch.position.z = -0.2;
      const fletchMat = new StandardMaterial('arrow_fletch_mat', this.scene);
      fletchMat.diffuseColor = new Color3(0.8, 0.2, 0.1);
      fletchMat.emissiveColor = new Color3(0.3, 0.05, 0.02);
      fletchMat.backFaceCulling = false;
      fletch.material = fletchMat;

      // Wind trail behind arrow
      const trail = this.createParticleSystem('arrow_trail', 40);
      trail.emitter = shaft;
      trail.minSize = 0.02;
      trail.maxSize = 0.06;
      trail.minLifeTime = 0.08;
      trail.maxLifeTime = 0.2;
      trail.emitRate = 100;
      trail.color1 = new Color4(0.9, 0.9, 0.85, 0.4);
      trail.color2 = new Color4(0.7, 0.7, 0.65, 0.2);
      trail.colorDead = new Color4(0.5, 0.5, 0.5, 0);
      trail.minEmitPower = 0.05;
      trail.maxEmitPower = 0.15;
      trail.direction1 = new Vector3(-0.1, 0.05, -0.1);
      trail.direction2 = new Vector3(0.1, 0.1, 0.1);
      trail.gravity = Vector3.Zero();
      trail.addSizeGradient(0, 0.04);
      trail.addSizeGradient(1, 0);
      trail.start();

      // Animate arrow from origin to target (fast!)
      const moveAnim = new Animation(
        'arrow_move', 'position', 60,
        Animation.ANIMATIONTYPE_VECTOR3,
        Animation.ANIMATIONLOOPMODE_CONSTANT
      );
      const targetPos = new Vector3(target.x, 0.75, target.z);
      moveAnim.setKeys([
        { frame: 0, value: shaft.position.clone() },
        { frame: 12, value: targetPos }, // Very fast - 0.2s
      ]);
      shaft.animations = [moveAnim];

      this.scene.beginAnimation(shaft, 0, 12, false, 1, () => {
        trail.stop();

        // Impact sparks
        const impact = this.createParticleSystem('arrow_impact', 40);
        impact.emitter = new Vector3(target.x, 0.7, target.z);
        impact.minSize = 0.02;
        impact.maxSize = 0.07;
        impact.minLifeTime = 0.1;
        impact.maxLifeTime = 0.25;
        impact.emitRate = 0;
        impact.manualEmitCount = 25;
        impact.minEmitPower = 1;
        impact.maxEmitPower = 3;
        impact.direction1 = new Vector3(-0.8, 0.5, -0.8);
        impact.direction2 = new Vector3(0.8, 1.5, 0.8);
        impact.gravity = new Vector3(0, -3, 0);
        impact.color1 = new Color4(0.9, 0.8, 0.5, 1);
        impact.color2 = new Color4(0.7, 0.6, 0.4, 0.8);
        impact.colorDead = new Color4(0.4, 0.3, 0.2, 0);
        impact.addSizeGradient(0, 0.05);
        impact.addSizeGradient(1, 0);
        impact.targetStopDuration = 0.2;
        impact.disposeOnStop = true;
        impact.start();
        this.activeParticleSystems.add(impact);
        impact.onDisposeObservable.addOnce(() => this.activeParticleSystems.delete(impact));

        // Small thud impact flash
        const thudFlash = MeshBuilder.CreatePlane('arrow_thud', { size: 0.4 }, this.scene);
        thudFlash.position = new Vector3(target.x, 0.75, target.z);
        thudFlash.billboardMode = Mesh.BILLBOARDMODE_ALL;
        const thudMat = new StandardMaterial('arrow_thud_mat', this.scene);
        thudMat.emissiveColor = new Color3(1, 0.9, 0.6);
        thudMat.alpha = 0.7;
        thudMat.backFaceCulling = false;
        thudFlash.material = thudMat;

        const thudFade = new Animation(
          'thud_fade', 'material.alpha', 60,
          Animation.ANIMATIONTYPE_FLOAT,
          Animation.ANIMATIONLOOPMODE_CONSTANT
        );
        thudFade.setKeys([
          { frame: 0, value: 0.7 },
          { frame: 6, value: 0 },
        ]);
        const thudScale = new Animation(
          'thud_scale', 'scaling', 60,
          Animation.ANIMATIONTYPE_VECTOR3,
          Animation.ANIMATIONLOOPMODE_CONSTANT
        );
        thudScale.setKeys([
          { frame: 0, value: new Vector3(0.5, 0.5, 0.5) },
          { frame: 6, value: new Vector3(1.5, 1.5, 1.5) },
        ]);
        thudFlash.animations = [thudFade, thudScale];
        this.scene.beginAnimation(thudFlash, 0, 6, false, 1, () => {
          thudFlash.dispose();
          thudMat.dispose();
        });

        setTimeout(() => {
          trail.dispose();
          shaft.dispose();
          shaftMat.dispose();
          tip.dispose();
          tipMat.dispose();
          fletch.dispose();
          fletchMat.dispose();
          resolve();
        }, 400);
      });
    });
  }

  /**
   * Shield Bash: impact shockwave + flash + heavy sparks
   */
  private async playShieldBash(
    origin: { x: number; z: number },
    target: { x: number; z: number }
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      const pos = new Vector3(target.x, 0.5, target.z);

      // Big white impact flash
      const flash = MeshBuilder.CreatePlane('bash_flash', { size: 1.2 }, this.scene);
      flash.position = pos.clone();
      flash.position.y = 0.8;
      flash.billboardMode = Mesh.BILLBOARDMODE_ALL;
      const flashMat = new StandardMaterial('bash_flash_mat', this.scene);
      flashMat.emissiveColor = new Color3(1, 1, 0.85);
      flashMat.alpha = 0.9;
      flashMat.backFaceCulling = false;
      flash.material = flashMat;
      this.glowLayer.addIncludedOnlyMesh(flash);

      const flashScale = new Animation(
        'bash_flash_scale', 'scaling', 60,
        Animation.ANIMATIONTYPE_VECTOR3,
        Animation.ANIMATIONLOOPMODE_CONSTANT
      );
      flashScale.setKeys([
        { frame: 0, value: new Vector3(0.1, 0.1, 0.1) },
        { frame: 3, value: new Vector3(1.5, 1.5, 1.5) },
        { frame: 8, value: new Vector3(0.5, 0.5, 0.5) },
      ]);
      const flashFade = new Animation(
        'bash_flash_fade', 'material.alpha', 60,
        Animation.ANIMATIONTYPE_FLOAT,
        Animation.ANIMATIONLOOPMODE_CONSTANT
      );
      flashFade.setKeys([
        { frame: 0, value: 1 },
        { frame: 3, value: 0.9 },
        { frame: 8, value: 0 },
      ]);
      flash.animations = [flashScale, flashFade];
      this.scene.beginAnimation(flash, 0, 8, false, 1, () => {
        flash.dispose();
        flashMat.dispose();
      });

      // Ground shockwave ring
      const ring = MeshBuilder.CreateTorus('bash_ring', {
        diameter: 0.3, thickness: 0.08, tessellation: 24,
      }, this.scene);
      ring.position = new Vector3(target.x, 0.15, target.z);
      const ringMat = new StandardMaterial('bash_ring_mat', this.scene);
      ringMat.emissiveColor = new Color3(0.9, 0.85, 0.6);
      ringMat.alpha = 0.8;
      ring.material = ringMat;
      this.glowLayer.addIncludedOnlyMesh(ring);

      const ringExpand = new Animation(
        'bash_ring_expand', 'scaling', 60,
        Animation.ANIMATIONTYPE_VECTOR3,
        Animation.ANIMATIONLOOPMODE_CONSTANT
      );
      ringExpand.setKeys([
        { frame: 0, value: new Vector3(0.5, 1, 0.5) },
        { frame: 10, value: new Vector3(4, 0.5, 4) },
        { frame: 18, value: new Vector3(5, 0.2, 5) },
      ]);
      const ringFade = new Animation(
        'bash_ring_fade', 'material.alpha', 60,
        Animation.ANIMATIONTYPE_FLOAT,
        Animation.ANIMATIONLOOPMODE_CONSTANT
      );
      ringFade.setKeys([
        { frame: 0, value: 0.8 },
        { frame: 10, value: 0.4 },
        { frame: 18, value: 0 },
      ]);
      ring.animations = [ringExpand, ringFade];
      this.scene.beginAnimation(ring, 0, 18, false, 1, () => {
        ring.dispose();
        ringMat.dispose();
      });

      // Heavy sparks flying outward
      const sparks = this.createParticleSystem('bash_sparks', 60);
      sparks.emitter = pos;
      sparks.minSize = 0.03;
      sparks.maxSize = 0.1;
      sparks.minLifeTime = 0.15;
      sparks.maxLifeTime = 0.4;
      sparks.emitRate = 0;
      sparks.manualEmitCount = 50;
      sparks.minEmitPower = 2;
      sparks.maxEmitPower = 5;
      sparks.direction1 = new Vector3(-1.5, 0.5, -1.5);
      sparks.direction2 = new Vector3(1.5, 2, 1.5);
      sparks.gravity = new Vector3(0, -4, 0);
      sparks.color1 = new Color4(1, 0.95, 0.7, 1);
      sparks.color2 = new Color4(0.9, 0.8, 0.5, 0.8);
      sparks.colorDead = new Color4(0.5, 0.4, 0.2, 0);
      sparks.addSizeGradient(0, 0.08);
      sparks.addSizeGradient(1, 0);
      sparks.targetStopDuration = 0.3;
      sparks.disposeOnStop = true;
      sparks.start();
      this.activeParticleSystems.add(sparks);
      sparks.onDisposeObservable.addOnce(() => this.activeParticleSystems.delete(sparks));

      // Camera shake for the bash
      this.shakeCamera(0.1, 200);

      setTimeout(resolve, 350);
    });
  }

  /**
   * Claw attack: 3 parallel red slash marks + blood-like particles
   */
  private async playClawAttack(target: { x: number; z: number }): Promise<void> {
    return new Promise<void>((resolve) => {
      const basePos = new Vector3(target.x, 0.7, target.z);

      // Create 3 parallel claw slash arcs
      for (let i = -1; i <= 1; i++) {
        const offset = i * 0.15;
        const slash = MeshBuilder.CreatePlane(`claw_slash_${i}`, { width: 0.08, height: 0.7 }, this.scene);
        slash.position = new Vector3(basePos.x + offset, basePos.y, basePos.z);
        slash.billboardMode = Mesh.BILLBOARDMODE_Y;

        const slashMat = new StandardMaterial(`claw_mat_${i}`, this.scene);
        slashMat.emissiveColor = new Color3(0.9, 0.15, 0);
        slashMat.diffuseColor = new Color3(0.8, 0.1, 0);
        slashMat.alpha = 0.9;
        slashMat.backFaceCulling = false;
        slash.material = slashMat;
        this.glowLayer.addIncludedOnlyMesh(slash);

        // Each claw appears with slight stagger
        const delay = (i + 1) * 2; // 0, 2, 4 frames
        const scaleAnim = new Animation(
          `claw_scale_${i}`, 'scaling', 60,
          Animation.ANIMATIONTYPE_VECTOR3,
          Animation.ANIMATIONLOOPMODE_CONSTANT
        );
        scaleAnim.setKeys([
          { frame: delay, value: new Vector3(1, 0.1, 1) },
          { frame: delay + 3, value: new Vector3(1.2, 1.3, 1) },
          { frame: delay + 8, value: new Vector3(0.8, 1.5, 1) },
          { frame: delay + 14, value: new Vector3(0.3, 0.1, 1) },
        ]);

        const fadeAnim = new Animation(
          `claw_fade_${i}`, 'material.alpha', 60,
          Animation.ANIMATIONTYPE_FLOAT,
          Animation.ANIMATIONLOOPMODE_CONSTANT
        );
        fadeAnim.setKeys([
          { frame: delay, value: 0 },
          { frame: delay + 3, value: 0.95 },
          { frame: delay + 8, value: 0.7 },
          { frame: delay + 14, value: 0 },
        ]);

        // Downward sweep motion
        const moveAnim = new Animation(
          `claw_move_${i}`, 'position.y', 60,
          Animation.ANIMATIONTYPE_FLOAT,
          Animation.ANIMATIONLOOPMODE_CONSTANT
        );
        moveAnim.setKeys([
          { frame: delay, value: 1.0 },
          { frame: delay + 5, value: 0.5 },
          { frame: delay + 14, value: 0.3 },
        ]);

        slash.animations = [scaleAnim, fadeAnim, moveAnim];
        this.scene.beginAnimation(slash, 0, 18, false, 1, () => {
          slash.dispose();
          slashMat.dispose();
        });
      }

      // Blood-like red particles on impact
      const blood = this.createParticleSystem('claw_blood', 50);
      blood.emitter = basePos;
      blood.minSize = 0.03;
      blood.maxSize = 0.1;
      blood.minLifeTime = 0.2;
      blood.maxLifeTime = 0.5;
      blood.emitRate = 0;
      blood.manualEmitCount = 35;
      blood.minEmitPower = 1;
      blood.maxEmitPower = 3;
      blood.direction1 = new Vector3(-1, 0.5, -1);
      blood.direction2 = new Vector3(1, 2, 1);
      blood.gravity = new Vector3(0, -5, 0);
      blood.color1 = new Color4(0.9, 0.1, 0, 1);
      blood.color2 = new Color4(0.6, 0.05, 0, 0.8);
      blood.colorDead = new Color4(0.3, 0, 0, 0);
      blood.addSizeGradient(0, 0.07);
      blood.addSizeGradient(1, 0);
      blood.targetStopDuration = 0.3;
      blood.disposeOnStop = true;
      blood.start();
      this.activeParticleSystems.add(blood);
      blood.onDisposeObservable.addOnce(() => this.activeParticleSystems.delete(blood));

      setTimeout(resolve, 350);
    });
  }

  // ========================================
  // IMPACT VFX
  // ========================================

  /**
   * Play a damage/heal number pop + particles
   */
  public playImpactVFX(params: ImpactVFXParams): void {
    const world = gridToWorld(params.position);
    const pos = new Vector3(world.x, 0.5, world.z);

    switch (params.type) {
      case 'damage':
        this.playDamageImpact(pos);
        break;
      case 'heal':
        this.playHealImpact(pos);
        break;
    }
  }

  private playDamageImpact(pos: Vector3): void {
    const system = this.createParticleSystem('dmg_impact', 60);
    system.emitter = pos;
    system.minSize = 0.05;
    system.maxSize = 0.18;
    system.minLifeTime = 0.3;
    system.maxLifeTime = 0.7;
    system.emitRate = 0;
    system.manualEmitCount = 40;
    system.minEmitPower = 1.5;
    system.maxEmitPower = 4;
    system.direction1 = new Vector3(-1.2, 1.5, -1.2);
    system.direction2 = new Vector3(1.2, 3, 1.2);
    system.gravity = new Vector3(0, -5, 0);
    system.color1 = new Color4(1, 0.3, 0, 1);
    system.color2 = new Color4(1, 0.1, 0, 0.9);
    system.colorDead = new Color4(0.6, 0, 0, 0);
    system.addSizeGradient(0, 0.15);
    system.addSizeGradient(0.5, 0.08);
    system.addSizeGradient(1, 0);
    system.targetStopDuration = 0.4;
    system.disposeOnStop = true;
    system.start();
    this.activeParticleSystems.add(system);
    system.onDisposeObservable.addOnce(() => this.activeParticleSystems.delete(system));
  }

  private playHealImpact(pos: Vector3): void {
    const system = this.createParticleSystem('heal_impact', 30);
    system.emitter = pos;
    system.createCylinderEmitter(0.3, 0.1, 0, 0);
    system.minSize = 0.04;
    system.maxSize = 0.12;
    system.minLifeTime = 0.5;
    system.maxLifeTime = 1;
    system.emitRate = 0;
    system.manualEmitCount = 20;
    system.minEmitPower = 0.3;
    system.maxEmitPower = 1;
    system.gravity = new Vector3(0, 1.5, 0);
    system.color1 = new Color4(0.2, 1, 0.4, 1);
    system.color2 = new Color4(0.1, 0.8, 0.3, 0.8);
    system.colorDead = new Color4(0, 0.4, 0.1, 0);
    system.targetStopDuration = 0.8;
    system.disposeOnStop = true;
    system.start();
    this.activeParticleSystems.add(system);
    system.onDisposeObservable.addOnce(() => this.activeParticleSystems.delete(system));
  }

  // ========================================
  // DEATH VFX
  // ========================================

  /**
   * Play a death effect on a unit: soul particles rise, then the rig tips
   * over onto its back and stays laid on the ground as a corpse. User asked
   * for a visible body rather than a full fade-out — the fade path left dead
   * units without any on-map indicator; the skull overlay lives only in the
   * turn order strip. The corpse is cleaned up by the GameCanvas diff-dispose
   * loop when the store entry is removed (e.g. Play Again clearUnits).
   */
  public async playDeathVFX(mesh: AbstractMesh, team: string): Promise<void> {
    return new Promise<void>((resolve) => {
      const pos = mesh.position.clone();
      pos.y = 0.5;

      // Soul particles rising
      const system = this.createParticleSystem('death_soul', 120);
      system.emitter = pos;
      system.createCylinderEmitter(0.5, 0.3, 0, 0);
      system.minSize = 0.06;
      system.maxSize = 0.25;
      system.minLifeTime = 0.8;
      system.maxLifeTime = 2.0;
      system.emitRate = 60;
      system.minEmitPower = 0.5;
      system.maxEmitPower = 1.5;
      system.gravity = new Vector3(0, 2, 0);

      if (team === 'player') {
        system.color1 = new Color4(0.3, 0.6, 1, 0.8);
        system.color2 = new Color4(0.1, 0.3, 0.8, 0.5);
        system.colorDead = new Color4(0, 0.1, 0.3, 0);
      } else {
        system.color1 = new Color4(0.8, 0.2, 0, 0.8);
        system.color2 = new Color4(0.5, 0, 0, 0.5);
        system.colorDead = new Color4(0.2, 0, 0, 0);
      }

      system.addSizeGradient(0, 0.15);
      system.addSizeGradient(1, 0);
      system.minAngularSpeed = -2;
      system.maxAngularSpeed = 2;
      system.start();
      this.activeParticleSystems.add(system);

      // Tip the rig over so the body lies on the ground. The rig
      // (`unit_<id>__Rig_*`) carries the per-unit orientation; rotating
      // its x-axis by ~90deg drops the character on its back. Fallback to
      // the root mesh if the rig naming doesn't match.
      const rig = this.findRig(mesh) ?? mesh;
      this.layDown(rig, 700);

      // Stop particles after 1.2s; resolve after they fade. Do NOT dispose
      // the mesh — the corpse is a visible indicator that stays until the
      // unit is removed from the store (Play Again / map switch / cleanup).
      setTimeout(() => {
        system.stop();
        setTimeout(() => {
          system.dispose();
          this.activeParticleSystems.delete(system);
          resolve();
        }, 1500);
      }, 1200);
    });
  }

  /** Locate the `__Rig_*` transform under a unit root. Returns null if the
   *  unit uses a plain mesh with no rig child (shouldn't happen for imported
   *  character glTFs but we stay defensive). */
  private findRig(root: AbstractMesh): AbstractMesh | null {
    for (const child of root.getChildren()) {
      if ((child as any).name && String((child as any).name).includes('__Rig_')) {
        return child as AbstractMesh;
      }
    }
    return null;
  }

  /** Animate a transform rotation.x from current to +PI/2 (fall backward)
   *  and drop it slightly to sit on the ground plane. */
  private layDown(target: AbstractMesh, durationMs: number): void {
    const fps = 30;
    const totalFrames = Math.round((durationMs / 1000) * fps);
    const startX = target.rotation.x;
    const endX = startX + Math.PI / 2;

    const rotAnim = new Animation(
      'death_layDown_rot', 'rotation.x', fps,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT,
    );
    const ease = new QuadraticEase();
    ease.setEasingMode(EasingFunction.EASINGMODE_EASEIN);
    rotAnim.setEasingFunction(ease);
    rotAnim.setKeys([
      { frame: 0, value: startX },
      { frame: totalFrames, value: endX },
    ]);
    target.animations.push(rotAnim);
    this.scene.beginAnimation(target, 0, totalFrames, false);
  }

  /** Reverse of playDeathVFX's lay-down pose: rotate the rig back upright
   *  over ~400ms when the DM revives a dead unit via DmAdjustHp. No
   *  particles — revival is a quiet operation, not a spell event. */
  public playReviveVFX(mesh: AbstractMesh): void {
    const rig = this.findRig(mesh) ?? mesh;
    const fps = 30;
    const durationMs = 400;
    const totalFrames = Math.round((durationMs / 1000) * fps);
    const startX = rig.rotation.x;
    // Snap back to the nearest multiple of 2π so the upright pose matches
    // whatever rotation the model had before the death animation ran.
    const endX = Math.round(startX / (Math.PI * 2)) * (Math.PI * 2);
    if (Math.abs(endX - startX) < 0.01) return;

    const rotAnim = new Animation(
      'revive_rise_rot', 'rotation.x', fps,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT,
    );
    const ease = new QuadraticEase();
    ease.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);
    rotAnim.setEasingFunction(ease);
    rotAnim.setKeys([
      { frame: 0, value: startX },
      { frame: totalFrames, value: endX },
    ]);
    rig.animations.push(rotAnim);
    this.scene.beginAnimation(rig, 0, totalFrames, false);
  }

  /**
   * Gradually fade out a mesh's visibility
   */
  private fadeOutMesh(mesh: AbstractMesh, durationMs: number): void {
    const fps = 30;
    const totalFrames = Math.round((durationMs / 1000) * fps);

    // Fade root mesh
    const fadeAnim = new Animation(
      'fade_out', 'visibility', fps,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    fadeAnim.setKeys([
      { frame: 0, value: 1 },
      { frame: totalFrames, value: 0 },
    ]);
    mesh.animations.push(fadeAnim);
    this.scene.beginAnimation(mesh, 0, totalFrames, false);

    // Fade children too
    mesh.getChildMeshes(true).forEach((child) => {
      const childFade = fadeAnim.clone();
      child.animations.push(childFade);
      this.scene.beginAnimation(child, 0, totalFrames, false);
    });
  }

  // ========================================
  // IDLE FLOATING ANIMATION (enhanced: bob + breathing + sway)
  // ========================================

  /**
   * Add rich idle animation: Y-axis bob + breathing scale pulse + body sway
   * Makes characters feel alive and dynamic instead of standing still
   */
  public addIdleAnimation(mesh: AbstractMesh, unitId: string): void {
    const baseY = mesh.position.y;
    const bobHeight = 0.08; // 8cm bob
    const fps = 30;
    const duration = 120; // 4 seconds per full cycle

    // --- Y-axis bob (floating) ---
    const bobAnim = new Animation(
      `idle_bob_${unitId}`,
      'position.y', fps,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CYCLE
    );
    const sineEase = new SineEase();
    sineEase.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
    bobAnim.setKeys([
      { frame: 0, value: baseY },
      { frame: duration * 0.25, value: baseY + bobHeight * 0.6 },
      { frame: duration * 0.5, value: baseY + bobHeight },
      { frame: duration * 0.75, value: baseY + bobHeight * 0.6 },
      { frame: duration, value: baseY },
    ]);
    bobAnim.setEasingFunction(sineEase);

    // --- Breathing scale pulse (subtle) ---
    const baseScale = mesh.scaling.clone();
    const s = baseScale.x;
    const breathAnim = new Animation(
      `idle_breath_${unitId}`,
      'scaling', fps,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CYCLE
    );
    breathAnim.setKeys([
      { frame: 0, value: new Vector3(s, s, s) },
      { frame: duration * 0.3, value: new Vector3(s * 1.015, s * 1.025, s * 1.015) },
      { frame: duration * 0.5, value: new Vector3(s * 1.01, s * 1.02, s * 1.01) },
      { frame: duration * 0.8, value: new Vector3(s * 0.995, s * 0.99, s * 0.995) },
      { frame: duration, value: new Vector3(s, s, s) },
    ]);
    breathAnim.setEasingFunction(sineEase);

    mesh.animations = [bobAnim, breathAnim];
    this.scene.beginAnimation(mesh, 0, duration, true);

    // --- Body sway on Rig node ---
    const descendants = mesh.getDescendants(false);
    const rigNode = descendants.find(node => node.name.includes('Rig')) as TransformNode | undefined;
    if (rigNode) {
      if (rigNode.rotationQuaternion) {
        rigNode.rotation = rigNode.rotationQuaternion.toEulerAngles();
        rigNode.rotationQuaternion = null;
      }
      
      const baseRotZ = rigNode.rotation.z || 0;
      const swayAmount = 0.035; // ~2 degrees each way
      const swayDuration = 150; // slightly different period for organic feel
      
      const swayAnim = new Animation(
        `idle_sway_${unitId}`,
        'rotation.z', fps,
        Animation.ANIMATIONTYPE_FLOAT,
        Animation.ANIMATIONLOOPMODE_CYCLE
      );
      swayAnim.setKeys([
        { frame: 0, value: baseRotZ },
        { frame: swayDuration * 0.25, value: baseRotZ + swayAmount },
        { frame: swayDuration * 0.5, value: baseRotZ },
        { frame: swayDuration * 0.75, value: baseRotZ - swayAmount },
        { frame: swayDuration, value: baseRotZ },
      ]);
      swayAnim.setEasingFunction(sineEase);

      // Only add sway if not conflicting with other rig anims
      const existingAnims = rigNode.animations || [];
      rigNode.animations = [...existingAnims.filter(a => !a.name.includes('idle_sway')), swayAnim];
      this.scene.beginAnimation(rigNode, 0, swayDuration, true);
    }

    this.idleAnimations.set(unitId, [bobAnim, breathAnim]);
  }

  /**
   * Remove idle animation for a unit
   */
  public removeIdleAnimation(unitId: string, mesh: AbstractMesh): void {
    this.scene.stopAnimation(mesh);
    this.idleAnimations.delete(unitId);
  }

  // ========================================
  // SELECTION PULSE
  // ========================================

  /**
   * Create a pulsing ring effect under the selected unit
   */
  public createSelectionPulse(position: GridPosition, team: string): Mesh {
    const world = gridToWorld(position);
    const ring = MeshBuilder.CreateTorus(
      'selection_pulse',
      { diameter: 0.9, thickness: 0.04, tessellation: 32 },
      this.scene
    );
    ring.position = new Vector3(world.x, 0.15, world.z);

    const mat = new StandardMaterial('selection_pulse_mat', this.scene);
    const baseColor = team === 'player'
      ? new Color3(0.2, 0.6, 1)
      : new Color3(1, 0.3, 0.2);
    mat.emissiveColor = baseColor;
    mat.diffuseColor = baseColor;
    mat.alpha = 0.7;
    ring.material = mat;

    // Pulse scale animation
    const pulseAnim = new Animation(
      'sel_pulse_scale', 'scaling', 30,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CYCLE
    );
    const ease = new SineEase();
    ease.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
    pulseAnim.setKeys([
      { frame: 0, value: new Vector3(0.9, 1, 0.9) },
      { frame: 30, value: new Vector3(1.15, 1, 1.15) },
      { frame: 60, value: new Vector3(0.9, 1, 0.9) },
    ]);
    pulseAnim.setEasingFunction(ease);

    // Pulse alpha
    const alphaAnim = new Animation(
      'sel_pulse_alpha', 'material.alpha', 30,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CYCLE
    );
    alphaAnim.setKeys([
      { frame: 0, value: 0.7 },
      { frame: 30, value: 0.3 },
      { frame: 60, value: 0.7 },
    ]);
    alphaAnim.setEasingFunction(ease);

    ring.animations = [pulseAnim, alphaAnim];
    this.scene.beginAnimation(ring, 0, 60, true);

    return ring;
  }

  // ========================================
  // AMBIENT SCENE EFFECTS
  // ========================================

  /**
   * Add ambient dust motes floating in the dungeon
   */
  public startAmbientDust(): void {
    const system = this.createParticleSystem('ambient_dust', 100);
    system.emitter = Vector3.Zero();
    system.createBoxEmitter(
      new Vector3(-0.1, 0.3, -0.1),
      new Vector3(0.1, 0.5, 0.1),
      new Vector3(-5, 0, -5),
      new Vector3(5, 0, 5)
    );
    system.minSize = 0.01;
    system.maxSize = 0.04;
    system.minLifeTime = 4;
    system.maxLifeTime = 8;
    system.emitRate = 8;
    system.minEmitPower = 0.01;
    system.maxEmitPower = 0.05;
    system.gravity = new Vector3(0, 0.02, 0);
    system.color1 = new Color4(0.8, 0.8, 0.7, 0.15);
    system.color2 = new Color4(0.6, 0.6, 0.5, 0.08);
    system.colorDead = new Color4(0.5, 0.5, 0.4, 0);
    system.minAngularSpeed = -0.5;
    system.maxAngularSpeed = 0.5;
    this.ambientBaseEmitRates.set(system, system.emitRate);
    system.emitRate = system.emitRate * this.ambientDensityMultiplier;
    system.start();
    this.ambientSystems.push(system);
  }

  /**
   * Add magical ambient particles (subtle sparkles near the ground)
   */
  public startAmbientMagic(): void {
    const system = this.createParticleSystem('ambient_magic', 60);
    system.emitter = Vector3.Zero();
    system.createBoxEmitter(
      new Vector3(-0.02, 0.5, -0.02),
      new Vector3(0.02, 1, 0.02),
      new Vector3(-4, 0, -4),
      new Vector3(4, 0, 4)
    );
    system.minSize = 0.015;
    system.maxSize = 0.04;
    system.minLifeTime = 2;
    system.maxLifeTime = 5;
    system.emitRate = 4;
    system.minEmitPower = 0.01;
    system.maxEmitPower = 0.03;
    system.gravity = new Vector3(0, 0.03, 0);
    system.color1 = new Color4(0.4, 0.6, 1, 0.2);
    system.color2 = new Color4(0.6, 0.3, 1, 0.15);
    system.colorDead = new Color4(0.2, 0.1, 0.5, 0);
    system.addSizeGradient(0, 0);
    system.addSizeGradient(0.3, 0.04);
    system.addSizeGradient(0.7, 0.03);
    system.addSizeGradient(1, 0);
    this.ambientBaseEmitRates.set(system, system.emitRate);
    system.emitRate = system.emitRate * this.ambientDensityMultiplier;
    system.start();
    this.ambientSystems.push(system);
  }

  /**
   * Add torch fire particles at a specific position
   */
  public addTorchEffect(worldX: number, worldZ: number): ParticleSystem {
    const system = this.createParticleSystem('torch', 40);
    system.emitter = new Vector3(worldX, 0.8, worldZ);
    system.minSize = 0.02;
    system.maxSize = 0.08;
    system.minLifeTime = 0.2;
    system.maxLifeTime = 0.5;
    system.emitRate = 25;
    system.minEmitPower = 0.3;
    system.maxEmitPower = 0.8;
    system.direction1 = new Vector3(-0.1, 0.8, -0.1);
    system.direction2 = new Vector3(0.1, 1.2, 0.1);
    system.gravity = new Vector3(0, 0.5, 0);
    system.color1 = new Color4(1, 0.7, 0.2, 1);
    system.color2 = new Color4(1, 0.4, 0, 0.8);
    system.colorDead = new Color4(0.3, 0.1, 0, 0);
    system.addSizeGradient(0, 0.06);
    system.addSizeGradient(0.5, 0.04);
    system.addSizeGradient(1, 0);
    this.ambientBaseEmitRates.set(system, system.emitRate);
    system.emitRate = system.emitRate * this.ambientDensityMultiplier;
    system.start();
    this.ambientSystems.push(system);
    return system;
  }

  /**
   * Scale ambient particle emission rate by `multiplier`. 0 stops emission;
   * 1 is the authored default; 1.5 over-emits. Applies live to already-
   * running systems and to any started afterwards.
   */
  public setAmbientDensity(multiplier: number): void {
    this.ambientDensityMultiplier = multiplier;
    this.ambientSystems.forEach((system) => {
      const base = this.ambientBaseEmitRates.get(system);
      if (base !== undefined) {
        system.emitRate = base * multiplier;
      }
    });
  }

  public setAmbientEnabled(enabled: boolean): void {
    if (enabled) {
      this.resumeAmbient();
    } else {
      this.pauseAmbient();
    }
  }

  // ========================================
  // TURN TRANSITION VFX
  // ========================================

  /**
   * Flash effect when a new turn begins
   */
  public playTurnStartVFX(unitPosition: GridPosition, team: string): void {
    const world = gridToWorld(unitPosition);
    const pos = new Vector3(world.x, 0.2, world.z);

    const system = this.createParticleSystem('turn_start', 80);
    system.emitter = pos;
    system.createCylinderEmitter(0.6, 0.08, 0, 0);
    system.minSize = 0.05;
    system.maxSize = 0.16;
    system.minLifeTime = 0.4;
    system.maxLifeTime = 1.0;
    system.emitRate = 0;
    system.manualEmitCount = 50;
    system.minEmitPower = 0.8;
    system.maxEmitPower = 2.0;
    system.gravity = new Vector3(0, 1.5, 0);

    if (team === 'player') {
      system.color1 = new Color4(0.3, 0.7, 1, 0.8);
      system.color2 = new Color4(0.1, 0.4, 1, 0.5);
      system.colorDead = new Color4(0, 0.2, 0.5, 0);
    } else {
      system.color1 = new Color4(1, 0.4, 0.2, 0.8);
      system.color2 = new Color4(0.8, 0.1, 0, 0.5);
      system.colorDead = new Color4(0.3, 0, 0, 0);
    }

    system.addSizeGradient(0, 0.08);
    system.addSizeGradient(1, 0);
    system.targetStopDuration = 0.5;
    system.disposeOnStop = true;
    system.start();
    this.activeParticleSystems.add(system);
    system.onDisposeObservable.addOnce(() => this.activeParticleSystems.delete(system));
  }

  // ========================================
  // HIT REACTION ANIMATION
  // ========================================

  /**
   * Play a knockback micro-animation when a unit takes damage
   * Tilts the model backward, flashes red, then returns
   */
  public playHitReaction(mesh: AbstractMesh): void {
    const descendants = mesh.getDescendants(false);
    const rigNode = descendants.find(node => node.name.includes('Rig')) as TransformNode | undefined;

    if (rigNode) {
      if (rigNode.rotationQuaternion) {
        rigNode.rotation = rigNode.rotationQuaternion.toEulerAngles();
        rigNode.rotationQuaternion = null;
      }

      const baseX = rigNode.rotation.x;
      const fps = 60;
      const knockAnim = new Animation(
        'hit_knock', 'rotation.x', fps,
        Animation.ANIMATIONTYPE_FLOAT,
        Animation.ANIMATIONLOOPMODE_CONSTANT
      );
      knockAnim.setKeys([
        { frame: 0, value: baseX },
        { frame: 4, value: baseX - 0.25 }, // tilt backward
        { frame: 10, value: baseX + 0.08 }, // slight overshoot forward
        { frame: 16, value: baseX },
      ]);
      
      const existingAnims = (rigNode.animations || []).filter(a => a.name !== 'hit_knock');
      rigNode.animations = [...existingAnims, knockAnim];
      this.scene.beginAnimation(rigNode, 0, 16, false, 1.5);
    }

    // Squash reaction on root mesh
    const baseScale = mesh.scaling.clone();
    const s = baseScale.x;
    const fps = 60;
    const squashAnim = new Animation(
      'hit_squash', 'scaling', fps,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    squashAnim.setKeys([
      { frame: 0, value: baseScale.clone() },
      { frame: 3, value: new Vector3(s * 1.12, s * 0.88, s * 1.12) }, // squash on impact
      { frame: 8, value: new Vector3(s * 0.95, s * 1.05, s * 0.95) }, // stretch rebound
      { frame: 14, value: baseScale.clone() },
    ]);

    const existingMeshAnims = (mesh.animations || []).filter(a => a.name !== 'hit_squash');
    mesh.animations = [...existingMeshAnims, squashAnim];
    this.scene.beginAnimation(mesh, 0, 14, false, 1.5);
  }

  // ========================================
  // MOVEMENT DUST TRAIL
  // ========================================

  /**
   * Spawn dust particles along a unit's movement path
   * Call when a unit starts moving to create a trail effect
   */
  public playMovementDust(origin: { x: number; z: number }, target: { x: number; z: number }): void {
    // Dust cloud at departure point
    const departSystem = this.createParticleSystem('move_dust_depart', 40);
    departSystem.emitter = new Vector3(origin.x, 0.05, origin.z);
    departSystem.minSize = 0.03;
    departSystem.maxSize = 0.12;
    departSystem.minLifeTime = 0.3;
    departSystem.maxLifeTime = 0.8;
    departSystem.emitRate = 0;
    departSystem.manualEmitCount = 15;
    departSystem.minEmitPower = 0.3;
    departSystem.maxEmitPower = 1;
    departSystem.direction1 = new Vector3(-0.5, 0.3, -0.5);
    departSystem.direction2 = new Vector3(0.5, 0.8, 0.5);
    departSystem.gravity = new Vector3(0, -1, 0);
    departSystem.color1 = new Color4(0.7, 0.65, 0.5, 0.5);
    departSystem.color2 = new Color4(0.5, 0.45, 0.35, 0.3);
    departSystem.colorDead = new Color4(0.4, 0.35, 0.25, 0);
    departSystem.addSizeGradient(0, 0.06);
    departSystem.addSizeGradient(0.5, 0.1);
    departSystem.addSizeGradient(1, 0);
    departSystem.targetStopDuration = 0.3;
    departSystem.disposeOnStop = true;
    departSystem.start();
    this.activeParticleSystems.add(departSystem);
    departSystem.onDisposeObservable.addOnce(() => this.activeParticleSystems.delete(departSystem));

    // Dust cloud at arrival point (delayed)
    setTimeout(() => {
      const arriveSystem = this.createParticleSystem('move_dust_arrive', 40);
      arriveSystem.emitter = new Vector3(target.x, 0.05, target.z);
      arriveSystem.minSize = 0.04;
      arriveSystem.maxSize = 0.15;
      arriveSystem.minLifeTime = 0.3;
      arriveSystem.maxLifeTime = 0.7;
      arriveSystem.emitRate = 0;
      arriveSystem.manualEmitCount = 20;
      arriveSystem.minEmitPower = 0.2;
      arriveSystem.maxEmitPower = 0.8;
      arriveSystem.direction1 = new Vector3(-0.6, 0.2, -0.6);
      arriveSystem.direction2 = new Vector3(0.6, 0.5, 0.6);
      arriveSystem.gravity = new Vector3(0, -1.5, 0);
      arriveSystem.color1 = new Color4(0.7, 0.65, 0.5, 0.6);
      arriveSystem.color2 = new Color4(0.5, 0.45, 0.35, 0.35);
      arriveSystem.colorDead = new Color4(0.4, 0.35, 0.25, 0);
      arriveSystem.addSizeGradient(0, 0.08);
      arriveSystem.addSizeGradient(0.5, 0.12);
      arriveSystem.addSizeGradient(1, 0);
      arriveSystem.targetStopDuration = 0.3;
      arriveSystem.disposeOnStop = true;
      arriveSystem.start();
      this.activeParticleSystems.add(arriveSystem);
      arriveSystem.onDisposeObservable.addOnce(() => this.activeParticleSystems.delete(arriveSystem));
    }, 400); // timed to match movement landing
  }

  // ========================================
  // SCREEN SHAKE / CAMERA EFFECTS
  // ========================================

  /**
   * Shake the camera for dramatic impact (big hit, explosion, death)
   * @param intensity - shake magnitude (0.05 = subtle, 0.15 = medium, 0.3 = heavy)
   * @param durationMs - how long to shake
   */
  public shakeCamera(intensity: number = 0.12, durationMs: number = 300): void {
    const camera = this.scene.activeCamera as ArcRotateCamera;
    if (!camera) return;

    const originalTarget = camera.target.clone();
    const startTime = performance.now();

    const shakeObserver = this.scene.onBeforeRenderObservable.add(() => {
      const elapsed = performance.now() - startTime;
      if (elapsed > durationMs) {
        camera.target = originalTarget;
        this.scene.onBeforeRenderObservable.remove(shakeObserver);
        return;
      }

      const progress = elapsed / durationMs;
      const decay = 1 - progress; // linear decay
      const shakeX = (Math.random() - 0.5) * 2 * intensity * decay;
      const shakeY = (Math.random() - 0.5) * 2 * intensity * decay * 0.5;
      const shakeZ = (Math.random() - 0.5) * 2 * intensity * decay;

      camera.target = new Vector3(
        originalTarget.x + shakeX,
        originalTarget.y + shakeY,
        originalTarget.z + shakeZ
      );
    });
  }

  // ========================================
  // HELPERS
  // ========================================

  /**
   * Create a particle system with default texture
   */
  private createParticleSystem(name: string, capacity: number): ParticleSystem {
    const system = new ParticleSystem(name, capacity, this.scene);
    system.particleTexture = this.particleTexture;
    system.blendMode = ParticleSystem.BLENDMODE_ADD;
    return system;
  }

  /**
   * Create a tiny invisible mesh to use as a particle emitter
   * (ParticleSystem.emitter requires Vector3 | AbstractMesh, not TransformNode)
   */
  private createEmitterMesh(name: string): Mesh {
    const mesh = MeshBuilder.CreateBox(name, { size: 0.001 }, this.scene);
    mesh.isVisible = false;
    mesh.isPickable = false;
    return mesh;
  }

  /**
   * Map DamageType string to VFX type
   */
  public static damageTypeToVFX(damageType: string): SpellVFXParams['type'] {
    const mapping: Record<string, SpellVFXParams['type']> = {
      'fire': 'fire',
      'ice': 'ice',
      'physical': 'physical',
      'lightning': 'lightning',
      'holy': 'holy',
      'dark': 'dark',
      'magical': 'magical',
    };
    return mapping[damageType] || 'magical';
  }

  // ========================================
  // CLEANUP
  // ========================================

  public stopAmbientEffects(): void {
    this.ambientSystems.forEach(s => {
      s.stop();
      s.dispose();
    });
    this.ambientSystems = [];
    this.ambientBaseEmitRates.clear();
  }

  /**
   * Pause ambient particle systems without disposing them so they can be
   * resumed after a map reset. Also wipes the live particle buffer so we
   * don't render trails from the previous map on the first frame of the
   * next one.
   */
  public pauseAmbient(): void {
    this.ambientSystems.forEach(s => {
      s.stop();
      // `reset` clears any particle that is currently alive.
      s.reset();
    });
  }

  /**
   * Resume ambient systems paused by `pauseAmbient`. Called by
   * SceneResetManager.finishLoad() once the new map is on screen.
   */
  public resumeAmbient(): void {
    this.ambientSystems.forEach(s => {
      if (!s.isStarted()) {
        s.start();
      }
    });
  }

  public dispose(): void {
    this.stopAmbientEffects();
    this.activeParticleSystems.forEach(s => {
      if (!s.isStarted()) return;
      s.stop();
      s.dispose();
    });
    this.activeParticleSystems.clear();
    this.idleAnimations.clear();
    if (this.particleTexture) {
      this.particleTexture.dispose();
    }
  }
}
