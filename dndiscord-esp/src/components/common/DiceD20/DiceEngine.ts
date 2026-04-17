import {
	ArcRotateCamera,
	Color3,
	Color4,
	Engine,
	HemisphericLight,
	Mesh,
	PointLight,
	Quaternion,
	Scene,
	StandardMaterial,
	Vector3,
	VertexData,
} from "@babylonjs/core";

import { buildD20Geometry, type D20Geometry, topFaceIndex } from "./diceGeometry";
import { createEmissiveAtlas, createNumeralAtlas, GRIMOIRE_DIE } from "./diceTextures";

export type DiceTone = "idle" | "crit-success" | "crit-fail";

export interface DiceEngineCallbacks {
	/** Fires when the tumble starts. */
	onRollStart?: (value: number) => void;
	/** Fires on every virtual "bounce" during tumble — plug procedural SFX here. */
	onBounce?: (intensity: number) => void;
	/** Fires when the die has settled on its target face. */
	onRollEnd?: (value: number) => void;
	/** Fires continuously as the currently top-facing numeral changes. */
	onFaceChange?: (value: number) => void;
}

interface InternalState {
	geometry: D20Geometry;
	engine: Engine;
	scene: Scene;
	dice: Mesh;
	/** Current rotation quaternion (separate from mesh so we can animate freely). */
	rotation: Quaternion;
	angular: Vector3;
	phase: "idle" | "charging" | "tumbling" | "settling" | "resting";
	rollStart: number;
	rollDuration: number;
	targetValue: number;
	targetQuat: Quaternion | null;
	settleFrom: Quaternion | null;
	settleStart: number;
	settleDuration: number;
	chargeIntensity: number;
	lastBounceAt: number;
	lastTopFace: number;
	reducedMotion: boolean;
	critPulse: number;
}

const DICE_RADIUS = 1.1;

/**
 * Builds a Babylon scene with a custom icosahedron d20 and exposes a tiny
 * imperative API for the Solid component to drive rolling / charging / etc.
 *
 * The die is rendered on a transparent canvas so the page's existing nebula
 * background shows through. No physics engine is used — tumbling is a
 * lightweight kinematic simulation, enough for a satisfying home-screen toy.
 */
export class DiceEngine {
	private state: InternalState;
	private callbacks: DiceEngineCallbacks;
	private disposed = false;
	private hoverTarget = { x: 0, y: 0 };
	private cameraShake = { amplitude: 0, decay: 0 };
	private flashLight: PointLight;
	private baseEmissive = new Color3(0.08, 0.04, 0.12);
	private critEmissive = new Color3(0, 0, 0);

	constructor(canvas: HTMLCanvasElement, callbacks: DiceEngineCallbacks = {}) {
		this.callbacks = callbacks;

		const engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: false }, true);
		engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2));
		const scene = new Scene(engine);
		scene.clearColor = new Color4(0, 0, 0, 0);

		const camera = new ArcRotateCamera(
			"d20-cam",
			Math.PI / 2,
			Math.PI / 2,
			4.2,
			Vector3.Zero(),
			scene,
		);
		camera.minZ = 0.1;
		camera.fov = 0.9;
		// Camera is driven manually (hover parallax); detach inputs.
		camera.detachControl();

		// Warm key + cool rim — echoes the plum / gold design language.
		const key = new HemisphericLight("d20-key", new Vector3(0.3, 1, 0.4), scene);
		key.intensity = 0.75;
		key.diffuse = new Color3(1, 0.95, 0.85);
		key.groundColor = new Color3(0.12, 0.08, 0.18);

		const rim = new PointLight("d20-rim", new Vector3(-3, 2, -3), scene);
		rim.diffuse = new Color3(0.65, 0.5, 1);
		rim.intensity = 0.9;

		this.flashLight = new PointLight("d20-flash", new Vector3(0, 0, 3), scene);
		this.flashLight.diffuse = new Color3(1, 0.85, 0.35);
		this.flashLight.intensity = 0;

		const geometry = buildD20Geometry();
		const dice = this.buildDiceMesh(scene, geometry);

		this.state = {
			geometry,
			engine,
			scene,
			dice,
			rotation: Quaternion.Identity(),
			angular: new Vector3(0.3, 0.5, 0.2),
			phase: "idle",
			rollStart: 0,
			rollDuration: 1.6,
			targetValue: 20,
			targetQuat: null,
			settleFrom: null,
			settleStart: 0,
			settleDuration: 0.55,
			chargeIntensity: 0,
			lastBounceAt: 0,
			lastTopFace: 0,
			reducedMotion: prefersReducedMotion(),
			critPulse: 0,
		};

		dice.rotationQuaternion = this.state.rotation.clone();

		scene.registerBeforeRender(() => this.update());
		engine.runRenderLoop(() => {
			if (!this.disposed) scene.render();
		});
	}

	// =========================================================
	// PUBLIC API
	// =========================================================

	/** Forwards the current pointer position (normalized -1..1) for hover parallax. */
	setHover(nx: number, ny: number): void {
		this.hoverTarget.x = clamp(nx, -1, 1);
		this.hoverTarget.y = clamp(ny, -1, 1);
	}

	clearHover(): void {
		this.hoverTarget.x = 0;
		this.hoverTarget.y = 0;
	}

	/**
	 * Begin a "charging" wobble that should be held while the user is
	 * pressing down / shaking. `intensity` 0..1 modulates the wobble.
	 */
	beginCharge(): void {
		if (this.state.phase === "tumbling" || this.state.phase === "settling") return;
		this.state.phase = "charging";
		this.state.chargeIntensity = 0;
	}

	updateCharge(intensity: number): void {
		if (this.state.phase !== "charging") return;
		this.state.chargeIntensity = clamp(intensity, 0, 1);
	}

	cancelCharge(): void {
		if (this.state.phase === "charging") this.state.phase = "idle";
		this.state.chargeIntensity = 0;
	}

	/**
	 * Throw the die. `power` 0..1 extends the tumble duration and spin speed.
	 * If `value` is omitted a random 1..20 is chosen. Returns the resolved value.
	 */
	roll(power = 0.7, value?: number): number {
		const s = this.state;
		if (s.phase === "tumbling" || s.phase === "settling") return s.targetValue;

		const resolved = value ?? 1 + Math.floor(Math.random() * 20);
		const face = s.geometry.faces.find((f) => f.value === resolved)!;
		s.targetValue = resolved;
		s.targetQuat = face.targetQuat.clone();

		const spin = s.reducedMotion ? 4 : 9 + power * 14;
		const axis = new Vector3(
			Math.random() * 2 - 1,
			Math.random() * 2 - 1,
			Math.random() * 2 - 1,
		).normalize();
		s.angular = axis.scale(spin);

		s.phase = "tumbling";
		s.rollStart = performance.now() / 1000;
		s.rollDuration = s.reducedMotion ? 0.4 : 0.9 + power * 1.0;
		s.chargeIntensity = 0;
		s.lastBounceAt = 0;
		this.callbacks.onRollStart?.(resolved);
		return resolved;
	}

	/** Visual flourish (flash + critical-hued emissive) without rolling. */
	critFlare(kind: "crit-success" | "crit-fail"): void {
		if (kind === "crit-success") {
			this.flashLight.diffuse = new Color3(1, 0.85, 0.3);
			this.critEmissive = new Color3(0.35, 0.2, 0.0);
		} else {
			this.flashLight.diffuse = new Color3(1, 0.15, 0.12);
			this.critEmissive = new Color3(0.4, 0.04, 0.04);
		}
		this.flashLight.intensity = 4;
		this.state.critPulse = 1;
		this.cameraShake.amplitude = kind === "crit-success" ? 0.08 : 0.12;
		this.cameraShake.decay = 4.0;
	}

	resize(): void {
		this.state.engine.resize();
	}

	dispose(): void {
		this.disposed = true;
		try {
			this.state.engine.stopRenderLoop();
			this.state.scene.dispose();
			this.state.engine.dispose();
		} catch {
			// ignore cleanup errors
		}
	}

	// =========================================================
	// INTERNAL
	// =========================================================

	private buildDiceMesh(scene: Scene, geometry: D20Geometry): Mesh {
		const positions: number[] = [];
		const indices: number[] = [];
		const normals: number[] = [];
		const uvs: number[] = [];

		for (const face of geometry.faces) {
			const base = positions.length / 3;
			const [a, b, c] = face.indices;
			const verts = [
				geometry.vertices[a].scale(DICE_RADIUS),
				geometry.vertices[b].scale(DICE_RADIUS),
				geometry.vertices[c].scale(DICE_RADIUS),
			];
			// Flat-shade: duplicate vertices per face so normals are per-face.
			for (const v of verts) {
				positions.push(v.x, v.y, v.z);
				normals.push(face.normal.x, face.normal.y, face.normal.z);
			}
			indices.push(base, base + 1, base + 2);
			const uvForLocal = (local: 0 | 1 | 2): [number, number] => {
				if (local === face.topLocal) return face.uvs.top;
				if (local === face.leftLocal) return face.uvs.left;
				return face.uvs.right;
			};
			uvs.push(...uvForLocal(0), ...uvForLocal(1), ...uvForLocal(2));
		}

		const mesh = new Mesh("d20", scene);
		const vd = new VertexData();
		vd.positions = positions;
		vd.indices = indices;
		vd.normals = normals;
		vd.uvs = uvs;
		vd.applyToMesh(mesh, true);

		const mat = new StandardMaterial("d20-mat", scene);
		mat.diffuseTexture = createNumeralAtlas(scene, GRIMOIRE_DIE);
		mat.emissiveTexture = createEmissiveAtlas(scene, "#F4C542");
		mat.emissiveColor = this.baseEmissive.clone();
		mat.specularColor = new Color3(0.85, 0.75, 0.55);
		mat.specularPower = 48;
		mat.ambientColor = new Color3(0.35, 0.2, 0.45);
		mesh.material = mat;

		return mesh;
	}

	private update(): void {
		const s = this.state;
		const dt = s.engine.getDeltaTime() / 1000;
		if (dt <= 0) return;

		const now = performance.now() / 1000;

		switch (s.phase) {
			case "idle":
				this.stepIdle(dt);
				break;
			case "charging":
				this.stepCharging(dt);
				break;
			case "tumbling":
				this.stepTumbling(dt, now);
				break;
			case "settling":
				this.stepSettling(dt, now);
				break;
			case "resting":
				this.stepResting(dt);
				break;
		}

		s.dice.rotationQuaternion = s.rotation;

		this.applyHoverParallax(dt);
		this.applyCameraShake(dt);
		this.applyFlash(dt);
		this.applyCritEmissive(dt);
		this.maybeEmitFaceChange();
	}

	private stepIdle(dt: number): void {
		const drift = new Vector3(0.08, 0.22, 0.05);
		this.integrateRotation(drift, dt);
	}

	private stepCharging(dt: number): void {
		const s = this.state;
		const wobble = 0.6 + s.chargeIntensity * 4.0;
		const axis = new Vector3(
			Math.sin(performance.now() * 0.02) * wobble,
			Math.cos(performance.now() * 0.017) * wobble,
			Math.sin(performance.now() * 0.013) * wobble * 0.5,
		);
		this.integrateRotation(axis, dt);
	}

	private stepTumbling(dt: number, now: number): void {
		const s = this.state;
		const elapsed = now - s.rollStart;
		const t = Math.min(elapsed / s.rollDuration, 1);
		const damping = 0.82;
		s.angular = s.angular.scale(Math.pow(damping, dt * 60));
		this.integrateRotation(s.angular, dt);

		const speed = s.angular.length();
		// Fake "bounces" when spinning hits certain speed thresholds (synthesized sound beats).
		if (now - s.lastBounceAt > 0.1) {
			const threshold = 6 + Math.sin(elapsed * 13) * 2;
			if (speed > threshold) {
				s.lastBounceAt = now;
				const intensity = clamp(speed / 24, 0.1, 1);
				this.callbacks.onBounce?.(intensity);
			}
		}

		if (t >= 1 && s.targetQuat) {
			s.phase = "settling";
			s.settleFrom = s.rotation.clone();
			s.settleStart = now;
		}
	}

	private stepSettling(dt: number, now: number): void {
		const s = this.state;
		if (!s.targetQuat || !s.settleFrom) {
			s.phase = "resting";
			return;
		}
		const elapsed = now - s.settleStart;
		const t = clamp(elapsed / s.settleDuration, 0, 1);
		const eased = easeOutBack(t);
		s.rotation = Quaternion.Slerp(s.settleFrom, s.targetQuat, eased);

		if (t >= 1) {
			s.rotation = s.targetQuat.clone();
			s.phase = "resting";
			s.angular = Vector3.Zero();
			this.callbacks.onRollEnd?.(s.targetValue);
			// Tiny celebratory wobble for crits
			if (s.targetValue === 20 || s.targetValue === 1) {
				s.critPulse = 1;
			}
		}
		void dt;
	}

	private stepResting(dt: number): void {
		const s = this.state;
		// Gentle idle breathing rotation so the die never feels completely frozen.
		const drift = new Vector3(0, 0.05, 0);
		this.integrateRotation(drift, dt);
	}

	private integrateRotation(angular: Vector3, dt: number): void {
		const s = this.state;
		const angle = angular.length() * dt;
		if (angle <= 1e-6) return;
		const axis = angular.normalizeToNew();
		const delta = Quaternion.RotationAxis(axis, angle);
		s.rotation = delta.multiply(s.rotation);
		s.rotation.normalize();
	}

	private applyHoverParallax(dt: number): void {
		const camera = this.state.scene.activeCamera as ArcRotateCamera;
		if (!camera) return;
		const targetAlpha = Math.PI / 2 + this.hoverTarget.x * 0.25;
		const targetBeta = Math.PI / 2 - this.hoverTarget.y * 0.2;
		const k = 1 - Math.exp(-dt * 6);
		camera.alpha += (targetAlpha - camera.alpha) * k;
		camera.beta += (targetBeta - camera.beta) * k;
	}

	private applyCameraShake(dt: number): void {
		if (this.cameraShake.amplitude <= 0.0001) return;
		const camera = this.state.scene.activeCamera as ArcRotateCamera;
		if (!camera) return;
		camera.alpha += (Math.random() - 0.5) * this.cameraShake.amplitude * dt * 10;
		camera.beta += (Math.random() - 0.5) * this.cameraShake.amplitude * dt * 10;
		this.cameraShake.amplitude *= Math.max(0, 1 - this.cameraShake.decay * dt);
	}

	private applyFlash(dt: number): void {
		if (this.flashLight.intensity <= 0.01) {
			this.flashLight.intensity = 0;
			return;
		}
		this.flashLight.intensity *= Math.max(0, 1 - dt * 4);
	}

	private applyCritEmissive(dt: number): void {
		const mat = this.state.dice.material as StandardMaterial | null;
		if (!mat) return;
		const s = this.state;
		s.critPulse = Math.max(0, s.critPulse - dt * 1.2);
		const blend = s.critPulse;
		mat.emissiveColor = Color3.Lerp(this.baseEmissive, this.critEmissive, blend);
	}

	private maybeEmitFaceChange(): void {
		const s = this.state;
		const idx = topFaceIndex(s.geometry, s.rotation);
		if (idx !== s.lastTopFace) {
			s.lastTopFace = idx;
			this.callbacks.onFaceChange?.(s.geometry.faces[idx].value);
		}
	}
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, v));
}

function easeOutBack(t: number): number {
	const c1 = 1.70158;
	const c3 = c1 + 1;
	const x = t - 1;
	return 1 + c3 * x * x * x + c1 * x * x;
}

function prefersReducedMotion(): boolean {
	if (typeof window === "undefined" || !window.matchMedia) return false;
	try {
		return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	} catch {
		return false;
	}
}
