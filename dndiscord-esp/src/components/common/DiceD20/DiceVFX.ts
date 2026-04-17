/**
 * Lightweight 2D particle overlay drawn on a separate canvas above the
 * Babylon scene. Used only for the celebratory flourish on nat 1 / nat 20
 * (embers + sparkles) — we deliberately keep the 3D scene free of particles
 * to avoid loading additional Babylon modules.
 */

export type CritKind = "crit-success" | "crit-fail";

interface Particle {
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number;
	maxLife: number;
	size: number;
	hue: number;
	sat: number;
	lightness: number;
	kind: "spark" | "ring" | "glyph";
	angle?: number;
	angularVel?: number;
}

export class DiceVFX {
	private ctx: CanvasRenderingContext2D;
	private particles: Particle[] = [];
	private running = false;
	private disposed = false;
	private rafId = 0;
	private lastFrame = 0;
	private ringTime = 0;
	private ringKind: CritKind | null = null;

	constructor(private canvas: HTMLCanvasElement) {
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("DiceVFX: 2D context unavailable");
		this.ctx = ctx;
	}

	resize(width: number, height: number): void {
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		this.canvas.width = Math.floor(width * dpr);
		this.canvas.height = Math.floor(height * dpr);
		this.canvas.style.width = `${width}px`;
		this.canvas.style.height = `${height}px`;
		this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}

	burstBounce(x: number, y: number, intensity: number): void {
		const count = Math.max(2, Math.floor(intensity * 6));
		for (let i = 0; i < count; i++) {
			const angle = Math.random() * Math.PI * 2;
			const speed = 40 + Math.random() * 80 * intensity;
			this.particles.push({
				x,
				y,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed,
				life: 0,
				maxLife: 0.35 + Math.random() * 0.25,
				size: 1 + Math.random() * 1.5,
				hue: 42,
				sat: 80,
				lightness: 70,
				kind: "spark",
			});
		}
		this.ensureRunning();
	}

	critBurst(kind: CritKind, cx: number, cy: number): void {
		this.ringTime = 0;
		this.ringKind = kind;

		const gold = kind === "crit-success";
		const count = gold ? 90 : 70;
		for (let i = 0; i < count; i++) {
			const angle = Math.random() * Math.PI * 2;
			const speed = 90 + Math.random() * 260;
			const hue = gold ? 42 + (Math.random() * 14 - 7) : 358 + (Math.random() * 10 - 5);
			this.particles.push({
				x: cx,
				y: cy,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed - (gold ? 20 : 10),
				life: 0,
				maxLife: 0.8 + Math.random() * 0.6,
				size: 1.2 + Math.random() * 2.2,
				hue,
				sat: gold ? 90 : 70,
				lightness: gold ? 68 : 55,
				kind: "spark",
				angle: Math.random() * Math.PI * 2,
				angularVel: (Math.random() - 0.5) * 8,
			});
		}

		if (gold) {
			for (let i = 0; i < 8; i++) {
				const angle = (i / 8) * Math.PI * 2;
				this.particles.push({
					x: cx,
					y: cy,
					vx: Math.cos(angle) * 50,
					vy: Math.sin(angle) * 50,
					life: 0,
					maxLife: 1.4,
					size: 4,
					hue: 42,
					sat: 95,
					lightness: 75,
					kind: "glyph",
					angle: 0,
					angularVel: (Math.random() - 0.5) * 2,
				});
			}
		}

		this.ensureRunning();
	}

	private ensureRunning(): void {
		if (this.running || this.disposed) return;
		this.running = true;
		this.lastFrame = performance.now();
		const loop = (now: number) => {
			if (this.disposed) return;
			const dt = Math.min(0.04, (now - this.lastFrame) / 1000);
			this.lastFrame = now;
			this.step(dt);
			if (this.particles.length === 0 && this.ringTime > 0.9) {
				this.running = false;
				this.clear();
				return;
			}
			this.rafId = requestAnimationFrame(loop);
		};
		this.rafId = requestAnimationFrame(loop);
	}

	private step(dt: number): void {
		const { width, height } = this.canvas;
		this.ctx.clearRect(0, 0, width, height);

		if (this.ringKind) {
			this.ringTime += dt;
			this.drawRing(this.ringTime, this.ringKind);
			if (this.ringTime > 1.2) this.ringKind = null;
		}

		const gravity = 320;
		const remaining: Particle[] = [];
		for (const p of this.particles) {
			p.life += dt;
			if (p.life >= p.maxLife) continue;
			p.vy += gravity * dt * 0.35;
			p.vx *= Math.pow(0.82, dt * 60);
			p.vy *= Math.pow(0.88, dt * 60);
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			if (p.angularVel !== undefined) p.angle = (p.angle ?? 0) + p.angularVel * dt;

			const t = p.life / p.maxLife;
			const alpha = (1 - t) * (p.kind === "glyph" ? 0.9 : 0.95);
			this.ctx.save();
			if (p.kind === "spark") {
				this.ctx.globalCompositeOperation = "lighter";
				this.ctx.fillStyle = `hsla(${p.hue}, ${p.sat}%, ${p.lightness}%, ${alpha})`;
				this.ctx.beginPath();
				this.ctx.arc(p.x, p.y, p.size * (1 - t * 0.4), 0, Math.PI * 2);
				this.ctx.fill();
			} else if (p.kind === "glyph") {
				this.ctx.globalCompositeOperation = "lighter";
				this.ctx.translate(p.x, p.y);
				this.ctx.rotate(p.angle ?? 0);
				this.ctx.strokeStyle = `hsla(${p.hue}, ${p.sat}%, ${p.lightness}%, ${alpha})`;
				this.ctx.lineWidth = 1.5;
				const r = p.size * (1 + t * 2);
				this.ctx.beginPath();
				for (let i = 0; i < 4; i++) {
					const a = (i / 4) * Math.PI * 2;
					const x = Math.cos(a) * r;
					const y = Math.sin(a) * r;
					if (i === 0) this.ctx.moveTo(x, y);
					else this.ctx.lineTo(x, y);
				}
				this.ctx.closePath();
				this.ctx.stroke();
			}
			this.ctx.restore();

			remaining.push(p);
		}
		this.particles = remaining;
	}

	private drawRing(age: number, kind: CritKind): void {
		const { width, height } = this.canvas;
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		const cx = width / (2 * dpr);
		const cy = height / (2 * dpr);
		const t = Math.min(age / 0.9, 1);
		const radius = 30 + t * Math.min(width, height) * 0.6;
		const alpha = (1 - t) * 0.8;

		this.ctx.save();
		this.ctx.globalCompositeOperation = "lighter";
		const color = kind === "crit-success" ? "#F4C542" : "#EF4444";
		this.ctx.strokeStyle = color;
		this.ctx.shadowColor = color;
		this.ctx.shadowBlur = 20;
		this.ctx.globalAlpha = alpha;
		this.ctx.lineWidth = 3 * (1 - t * 0.6);
		this.ctx.beginPath();
		this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
		this.ctx.stroke();
		this.ctx.restore();
	}

	private clear(): void {
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
	}

	dispose(): void {
		this.disposed = true;
		if (this.rafId) cancelAnimationFrame(this.rafId);
		this.particles = [];
		this.clear();
	}
}
