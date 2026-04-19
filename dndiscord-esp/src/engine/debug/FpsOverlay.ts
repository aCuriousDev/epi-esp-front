import type { Engine, Scene } from '@babylonjs/core';

/**
 * FpsOverlay - lightweight DOM overlay showing FPS, frame time, and active
 * mesh count. Uses a fixed-position element rather than Babylon GUI so it
 * costs nothing when off and plays nicely with the Discord Activity CSP.
 */
export class FpsOverlay {
  private engine: Engine;
  private scene: Scene;
  private element: HTMLDivElement | null = null;
  private intervalId: number | null = null;
  private lastSample = performance.now();

  constructor(engine: Engine, scene: Scene) {
    this.engine = engine;
    this.scene = scene;
  }

  show(): void {
    if (this.element) return;

    const el = document.createElement('div');
    el.setAttribute('data-testid', 'fps-overlay');
    el.style.cssText = [
      'position:fixed',
      'top:8px',
      'right:8px',
      'z-index:9999',
      'padding:4px 8px',
      'font:12px/1.2 monospace',
      'color:#e2e8f0',
      'background:rgba(0,0,0,0.55)',
      'border:1px solid rgba(255,255,255,0.08)',
      'border-radius:4px',
      'pointer-events:none',
      'letter-spacing:0.02em',
    ].join(';');
    el.textContent = 'FPS … | … ms';
    document.body.appendChild(el);
    this.element = el;

    this.intervalId = window.setInterval(() => this.sample(), 250);
  }

  hide(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
  }

  dispose(): void {
    this.hide();
  }

  private sample(): void {
    if (!this.element) return;
    const now = performance.now();
    const fps = this.engine.getFps();
    const frameMs = now - this.lastSample;
    this.lastSample = now;
    const active = this.scene.getActiveMeshes().length;
    this.element.textContent = `FPS ${fps.toFixed(0).padStart(2, ' ')} | ${frameMs.toFixed(1)} ms | meshes ${active}`;
  }
}
