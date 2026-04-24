/**
 * Sound Integration - Bridges game actions with audio
 * 
 * Same pattern as VFXIntegration: the SoundManager reference is set
 * by GameCanvas on mount, and game actions call these typed functions.
 */

import { SoundManager } from '../../engine/audio/SoundManager';
import { soundSettings } from '../../stores/sound.store';

let soundManager: SoundManager | null = null;

/** Called by GameCanvas on mount to provide its instance */
export function setSoundEngine(manager: SoundManager | null): void {
  if (soundManager && soundManager !== manager) {
    soundManager.dispose();
  }
  soundManager = manager;
}

/** Lazily creates a SoundManager if none is set (e.g. menu page) */
function getOrCreate(): SoundManager {
  if (!soundManager) {
    soundManager = new SoundManager();
    soundManager.ambientVolume = soundSettings.musicEnabled() ? soundSettings.musicVolume() : 0;
    soundManager.sfxVolume = soundSettings.sfxEnabled() ? soundSettings.sfxVolume() : 0;
  }
  return soundManager;
}

export function getSoundManager(): SoundManager | null {
  return soundManager;
}

// ============================================
// AMBIENT
// ============================================

export function playAmbientMusic(mode: 'menu' | 'exploration' | 'combat'): void {
  if (!soundSettings.musicEnabled()) return;
  const mgr = getOrCreate();
  mgr.resume();
  mgr.startAmbient(mode);
}

export function stopAmbientMusic(): void {
  soundManager?.stopAmbient();
}

// ============================================
// COMBAT SOUNDS
// ============================================

export function playSwordHitSound(): void {
  if (!soundManager || !soundSettings.sfxEnabled()) return;
  soundManager.playSwordHit();
}

export function playSpellCastSound(damageType: string): void {
  if (!soundManager || !soundSettings.sfxEnabled()) return;
  soundManager.playSpellCast(damageType);
}

export function playImpactSound(): void {
  if (!soundManager || !soundSettings.sfxEnabled()) return;
  soundManager.playImpact();
}

export function playDeathSound(): void {
  if (!soundManager || !soundSettings.sfxEnabled()) return;
  soundManager.playDeath();
}

// ============================================
// MOVEMENT
// ============================================

export function playFootstepSound(): void {
  if (!soundManager || !soundSettings.sfxEnabled()) return;
  soundManager.playFootstep();
}

// ============================================
// UI SOUNDS
// ============================================

export function playTurnStartSound(): void {
  if (!soundManager || !soundSettings.sfxEnabled()) return;
  soundManager.playTurnStart();
}

export function playNewRoundSound(): void {
  if (!soundManager || !soundSettings.sfxEnabled()) return;
  soundManager.playNewRound();
}

export function playSelectSound(): void {
  if (!soundManager || !soundSettings.sfxEnabled()) return;
  soundManager.playSelect();
}

export function playVictorySound(): void {
  if (!soundManager || !soundSettings.sfxEnabled()) return;
  soundManager.playVictory();
}

export function playDefeatSound(): void {
  if (!soundManager || !soundSettings.sfxEnabled()) return;
  soundManager.playDefeat();
}

export function playHoverSound(): void {
  if (!soundManager || !soundSettings.sfxEnabled()) return;
  soundManager.playHover();
}

export function playMenuHoverSound(): void {
  if (!soundSettings.sfxEnabled()) return;
  getOrCreate().playMenuHover();
}

export function playMenuClickSound(): void {
  if (!soundSettings.sfxEnabled()) return;
  getOrCreate().playMenuClick();
}

// ============================================
// PER-ABILITY COMBAT SOUNDS
// ============================================

export function playArrowShotSound(): void {
  if (!soundManager || !soundSettings.sfxEnabled()) return;
  soundManager.playArrowShot();
}

export function playShieldBashSound(): void {
  if (!soundManager || !soundSettings.sfxEnabled()) return;
  soundManager.playShieldBash();
}

export function playClawAttackSound(): void {
  if (!soundManager || !soundSettings.sfxEnabled()) return;
  soundManager.playClawAttack();
}

// ============================================
// DICE & VOICE
// ============================================

export function playDiceRollSound(): void {
  if (!soundSettings.sfxEnabled()) return;
  getOrCreate().playDiceRoll();
}

export function playDiceImpactSound(volume = 0.7): void {
  if (!soundSettings.sfxEnabled()) return;
  getOrCreate().playDiceImpact(volume);
}

export function playDiceShakeSound(): void {
  if (!soundSettings.sfxEnabled()) return;
  getOrCreate().playDiceShake();
}

export function playDiceCritSuccessSound(): void {
  if (!soundSettings.sfxEnabled()) return;
  getOrCreate().playDiceCritSuccess();
}

export function playDiceCritFailSound(): void {
  if (!soundSettings.sfxEnabled()) return;
  getOrCreate().playDiceCritFail();
}

export function playDiceWindupSound(): void {
  if (!soundSettings.sfxEnabled()) return;
  getOrCreate().playDiceWindup();
}

export function playDiceLaunchSound(): void {
  if (!soundSettings.sfxEnabled()) return;
  getOrCreate().playDiceLaunch();
}

export function playDiceSuspenseSound(): void {
  if (!soundSettings.sfxEnabled()) return;
  getOrCreate().playDiceSuspense();
}

export function playBabbleSound(text: string, pitch: 'low' | 'mid' | 'high' = 'mid'): void {
  if (!soundSettings.sfxEnabled()) return;
  getOrCreate().playBabbleVoice(text, pitch);
}

// ============================================
// EXTRA UI SOUNDS
// ============================================

export function playPageTransitionSound(): void {
  if (!soundSettings.sfxEnabled()) return;
  getOrCreate().playPageTransition();
}

export function playToggleOnSound(): void {
  if (!soundSettings.sfxEnabled()) return;
  getOrCreate().playToggleOn();
}

export function playToggleOffSound(): void {
  if (!soundSettings.sfxEnabled()) return;
  getOrCreate().playToggleOff();
}

export function playErrorSound(): void {
  if (!soundSettings.sfxEnabled()) return;
  getOrCreate().playError();
}

export function playNotificationSound(): void {
  if (!soundSettings.sfxEnabled()) return;
  getOrCreate().playNotification();
}
