/**
 * 2D particle overlay drawn on a canvas above the Babylon scene.
 *
 * Hosts:
 *   - a lightweight always-on sparkle aura (ambient magical dust)
 *   - charge swirl (orbiting motes while the user holds the die)
 *   - trail sparks behind the die while it tumbles
 *   - bounce debris on every floor hit
 *   - multi-ring shockwaves + starburst rays on nat 1 / nat 20
 */

export type CritKind = "crit-success" | "crit-fail";

interface Particle {
	kind: "spark" | "ring" | "glyph" | "ray" | "swirl";
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
	angle?: number;
	angularVel?: number;
	gravity?: number;
	orbitRadius?: number;
	orbitOmega?: number;
	cx?: number;
	cy?: number;
}

interface Ring {
	kind: CritKind;
	life: number;
	maxLife: number;
	speed: number;
	thickness: number;
}

export class DiceVFX {
	private ctx: CanvasRenderingContext2D;
	private particles: Particle[] = [];
	private rings: Ring[] = [];
	private running = false;
	private disposed = false;
	private rafId = 0;
	private lastFrame = 0;
	private ambientCooldown = 0;
	private tumbleTrail: { active: boolean; intensity: number } = { active: false, intensity: 0 };

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

	/** Starts / stops the lightweight always-on ambience. */
	setAmbient(on: boolean): void {
		this.ambientOn = on;
		if (on) this.ensureRunning();
	}

	private ambientOn = false;

	/** Drives the swirl and trail systems (intensity 0..1 while charging). */
	setCharging(intensity: number): void {
		this.chargingIntensity = clamp(intensity, 0, 1);
		if (intensity > 0) this.ensureRunning();
	}

	private chargingIntensity = 0;

	/** Toggles the per-frame trail while the die is in-air. */
	setTumble(active: boolean, intensity = 1): void {
		this.tumbleTrail.active = active;
		this.tumbleTrail.intensity = intensity;
		if (active) this.ensureRunning();
	}

	/** Bursts a handful of debris sparks when the die hits the floor. */
	burstBounce(cx: number, cy: number, intensity: number): void {
		const count = Math.max(6, Math.floor(intensity * 18));
		for (let i = 0; i < count; i++) {
			const angle = -Math.PI + Math.random() * Math.PI;
			const speed = 120 + Math.random() * 260 * intensity;
			this.particles.push({
				kind: "spark",
				x: cx,
				y: cy,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed,
				life: 0,
				maxLife: 0.45 + Math.random() * 0.35,
				size: 1.4 + Math.random() * 2.2,
				hue: 42 + (Math.random() * 16 - 8),
				sat: 85,
				lightness: 70,
				gravity: 900,
			});
		}
		this.ensureRunning();
	}

	/** Big dramatic burst: shockwaves + embers + starburst rays. */
	critBurst(kind: CritKind, cx: number, cy: number): void {
		const gold = kind === "crit-success";

		// Multiple staggered shockwaves — faster rings travel further.
		for (let i = 0; i < 3; i++) {
			this.rings.push({
				kind,
				life: -i * 0.12,
				maxLife: 1.3,
				speed: 320 + i * 160,
				thickness: 6 - i * 1.4,
			});
		}

		// Star-shaped ray burst for nat 20.
		if (gold) {
			const rays = 16;
			for (let i = 0; i < rays; i++) {
				const angle = (i / rays) * Math.PI * 2;
				this.particles.push({
					kind: "ray",
					x: cx,
					y: cy,
					vx: Math.cos(angle) * 540,
					vy: Math.sin(angle) * 540,
					life: 0,
					maxLife: 0.55,
					size: 3,
					hue: 42 + (Math.random() * 14 - 7),
					sat: 95,
					lightness: 78,
					angle,
				});
			}
		}

		const count = gold ? 140 : 110;
		for (let i = 0; i < count; i++) {
			const angle = Math.random() * Math.PI * 2;
			const speed = 80 + Math.random() * 420;
			const hue = gold ? 42 + (Math.random() * 16 - 8) : 358 + (Math.random() * 12 - 6);
			this.particles.push({
				kind: "spark",
				x: cx,
				y: cy,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed - (gold ? 30 : 10),
				life: 0,
				maxLife: 0.9 + Math.random() * 0.9,
				size: 1.4 + Math.random() * 2.6,
				hue,
				sat: gold ? 95 : 75,
				lightness: gold ? 72 : 55,
				angle: Math.random() * Math.PI * 2,
				angularVel: (Math.random() - 0.5) * 10,
				gravity: gold ? 140 : 220,
			});
		}

		if (gold) {
			for (let i = 0; i < 10; i++) {
				const angle = (i / 10) * Math.PI * 2;
				this.particles.push({
					kind: "glyph",
					x: cx,
					y: cy,
					vx: Math.cos(angle) * 80,
					vy: Math.sin(angle) * 80 - 40,
					life: 0,
					maxLife: 1.6,
					size: 5,
					hue: 42,
					sat: 100,
					lightness: 78,
					angle: 0,
					angularVel: (Math.random() - 0.5) * 3,
					gravity: 60,
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
			const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
			this.lastFrame = now;
			this.step(dt);
			const stillBusy =
				this.particles.length > 0 ||
				this.rings.length > 0 ||
				this.ambientOn ||
				this.chargingIntensity > 0 ||
				this.tumbleTrail.active;
			if (!stillBusy) {
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
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		const cssW = width / dpr;
		const cssH = height / dpr;
		this.ctx.clearRect(0, 0, cssW, cssH);

		const cx = cssW / 2;
		const cy = cssH / 2;

		this.spawnAmbient(dt, cx, cy);
		this.spawnCharge(dt, cx, cy);
		this.spawnTrail(dt, cx, cy);
		this.drawRings(dt, cx, cy);
		this.updateParticles(dt);
	}

	private spawnAmbient(dt: number, cx: number, cy: number): void {
		if (!this.ambientOn) return;
		this.ambientCooldown -= dt;
		if (this.ambientCooldown > 0) return;
		this.ambientCooldown = 0.09 + Math.random() * 0.06;
		const radius = Math.min(cx, cy) * 0.9;
		const angle = Math.random() * Math.PI * 2;
		const r = radius * (0.55 + Math.random() * 0.4);
		this.particles.push({
			kind: "spark",
			x: cx + Math.cos(angle) * r,
			y: cy + Math.sin(angle) * r,
			vx: (Math.random() - 0.5) * 20,
			vy: -10 - Math.random() * 30,
			life: 0,
			maxLife: 1.2 + Math.random() * 0.6,
			size: 1 + Math.random() * 1.6,
			hue: Math.random() < 0.5 ? 42 : 280,
			sat: 70,
			lightness: 70,
			gravity: -20,
		});
	}

	private spawnCharge(dt: number, cx: number, cy: number): void {
		if (this.chargingIntensity <= 0.001) return;
		const motes = Math.ceil(3 + this.chargingIntensity * 8);
		const radius = Math.min(cx, cy) * (0.35 + this.chargingIntensity * 0.25);
		for (let i = 0; i < motes; i++) {
			if (Math.random() > 0.5 + this.chargingIntensity * 0.4) continue;
			const angle = Math.random() * Math.PI * 2;
			const r = radius * (0.9 + Math.random() * 0.2);
			this.particles.push({
				kind: "swirl",
				x: cx + Math.cos(angle) * r,
				y: cy + Math.sin(angle) * r,
				vx: 0,
				vy: 0,
				life: 0,
				maxLife: 0.6 + Math.random() * 0.4,
				size: 1.5 + Math.random() * 2.4,
				hue: Math.random() < 0.4 ? 42 : 285,
				sat: 90,
				lightness: 72,
				cx,
				cy,
				orbitRadius: r,
				orbitOmega: (Math.random() < 0.5 ? -1 : 1) * (3 + this.chargingIntensity * 6),
				angle,
			});
		}
		void dt;
	}

	private spawnTrail(dt: number, cx: number, cy: number): void {
		if (!this.tumbleTrail.active) return;
		const count = Math.max(1, Math.floor(this.tumbleTrail.intensity * 4));
		for (let i = 0; i < count; i++) {
			const spread = 22;
			this.particles.push({
				kind: "spark",
				x: cx + (Math.random() - 0.5) * spread,
				y: cy + (Math.random() - 0.5) * spread,
				vx: (Math.random() - 0.5) * 40,
				vy: (Math.random() - 0.5) * 40,
				life: 0,
				maxLife: 0.35 + Math.random() * 0.25,
				size: 1 + Math.random() * 1.6,
				hue: 42 + (Math.random() * 20 - 10),
				sat: 80,
				lightness: 68,
				gravity: 0,
			});
		}
		void dt;
	}

	private drawRings(dt: number, cx: number, cy: number): void {
		const remaining: Ring[] = [];
		for (const r of this.rings) {
			r.life += dt;
			if (r.life < 0) {
				remaining.push(r);
				continue;
			}
			const t = r.life / r.maxLife;
			if (t >= 1) continue;
			const radius = 20 + r.life * r.speed;
			const alpha = (1 - t) * 0.85;
			const color = r.kind === "crit-success" ? "#F4C542" : "#EF4444";
			this.ctx.save();
			this.ctx.globalCompositeOperation = "lighter";
			this.ctx.strokeStyle = color;
			this.ctx.shadowColor = color;
			this.ctx.shadowBlur = 24;
			this.ctx.globalAlpha = alpha;
			this.ctx.lineWidth = r.thickness * (1 - t * 0.6);
			this.ctx.beginPath();
			this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
			this.ctx.stroke();
			this.ctx.restore();
			remaining.push(r);
		}
		this.rings = remaining;
	}

	private updateParticles(dt: number): void {
		const remaining: Particle[] = [];
		for (const p of this.particles) {
			p.life += dt;
			if (p.life >= p.maxLife) continue;

			if (p.kind === "swirl" && p.cx !== undefined && p.cy !== undefined && p.orbitRadius !== undefined && p.orbitOmega !== undefined) {
				p.angle = (p.angle ?? 0) + p.orbitOmega * dt;
				p.orbitRadius *= 1 - dt * 0.4;
				p.x = p.cx + Math.cos(p.angle) * p.orbitRadius;
				p.y = p.cy + Math.sin(p.angle) * p.orbitRadius;
			} else {
				if (p.gravity !== undefined) p.vy += p.gravity * dt;
				p.vx *= Math.pow(0.9, dt * 60);
				p.vy *= Math.pow(0.92, dt * 60);
				p.x += p.vx * dt;
				p.y += p.vy * dt;
				if (p.angularVel !== undefined) p.angle = (p.angle ?? 0) + p.angularVel * dt;
			}

			const t = p.life / p.maxLife;
			const alpha = (1 - t);
			this.ctx.save();
			this.ctx.globalCompositeOperation = "lighter";

			if (p.kind === "spark" || p.kind === "swirl") {
				this.ctx.fillStyle = `hsla(${p.hue}, ${p.sat}%, ${p.lightness}%, ${alpha})`;
				this.ctx.beginPath();
				this.ctx.arc(p.x, p.y, p.size * (1 - t * 0.5), 0, Math.PI * 2);
				this.ctx.fill();
			} else if (p.kind === "ray") {
				const len = (p.maxLife - p.life) * 900;
				const tailX = p.x - (p.vx / Math.max(1, Math.hypot(p.vx, p.vy))) * len * 0.18;
				const tailY = p.y - (p.vy / Math.max(1, Math.hypot(p.vx, p.vy))) * len * 0.18;
				const grad = this.ctx.createLinearGradient(tailX, tailY, p.x, p.y);
				grad.addColorStop(0, `hsla(${p.hue}, ${p.sat}%, ${p.lightness}%, 0)`);
				grad.addColorStop(1, `hsla(${p.hue}, ${p.sat}%, ${p.lightness}%, ${alpha})`);
				this.ctx.strokeStyle = grad;
				this.ctx.lineWidth = p.size * (1 - t * 0.4);
				this.ctx.lineCap = "round";
				this.ctx.beginPath();
				this.ctx.moveTo(tailX, tailY);
				this.ctx.lineTo(p.x, p.y);
				this.ctx.stroke();
			} else if (p.kind === "glyph") {
				this.ctx.translate(p.x, p.y);
				this.ctx.rotate(p.angle ?? 0);
				this.ctx.strokeStyle = `hsla(${p.hue}, ${p.sat}%, ${p.lightness}%, ${alpha})`;
				this.ctx.lineWidth = 1.6;
				const r = p.size * (1 + t * 2.5);
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

	private clear(): void {
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		this.ctx.clearRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);
	}

	dispose(): void {
		this.disposed = true;
		if (this.rafId) cancelAnimationFrame(this.rafId);
		this.particles = [];
		this.rings = [];
		this.clear();
	}
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, v));
}
