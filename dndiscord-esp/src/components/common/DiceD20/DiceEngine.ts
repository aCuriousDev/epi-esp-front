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

export interface DiceEngineCallbacks {
	onRollStart?: (value: number) => void;
	/** Fires on every "bounce" of the die (x, y in local canvas px relative to centre, intensity 0..1). */
	onBounce?: (x: number, y: number, intensity: number) => void;
	/** Fires once the die is fully settled on its target face. */
	onRollEnd?: (value: number) => void;
	/** Fires when the currently top-facing numeral changes during the tumble. */
	onFaceChange?: (value: number) => void;
	/** Fires when the windup (pre-launch suspense) begins. */
	onWindup?: () => void;
	/** Fires the moment the die is flung into the air — big whoosh SFX hooks here. */
	onLaunch?: (power: number) => void;
	/** Fires as the die enters the hanging suspense pause (last bounce before reveal). */
	onSuspense?: () => void;
}

/** Phases of a dice throw — ordered from first to last. */
type Phase =
	| "idle"
	| "charging"
	| "windup"
	| "tumbling"
	| "suspense"
	| "settling"
	| "resting";

interface InternalState {
	geometry: D20Geometry;
	engine: Engine;
	scene: Scene;
	dice: Mesh;
	rotation: Quaternion;
	angular: Vector3;
	phase: Phase;
	/** Simulated local position relative to the die's "rest" origin. */
	position: Vector3;
	/** Velocity for the kinematic leap simulation. */
	velocity: Vector3;
	phaseStart: number;
	phaseDuration: number;
	targetValue: number;
	targetQuat: Quaternion | null;
	settleFrom: Quaternion | null;
	settleRotation: Quaternion;
	chargeIntensity: number;
	lastTopFace: number;
	reducedMotion: boolean;
	critPulse: number;
	rollPower: number;
	bounceCount: number;
	squash: number;
}

const DICE_RADIUS = 1.1;
const GROUND_Y = -0.95;
const GRAVITY = -22;

/**
 * Babylon scene that renders a chunky, bouncy 3D d20 with a dramatic
 * multi-phase throw. No physics engine — positions are a simple kinematic
 * simulation with projectile arcs + impulsive bounces, which looks lively
 * without pulling in Havok.
 */
export class DiceEngine {
	private state: InternalState;
	private callbacks: DiceEngineCallbacks;
	private disposed = false;
	private hoverTarget = { x: 0, y: 0 };
	private cameraShake = { amplitude: 0, decay: 0 };
	private flashLight: PointLight;
	private baseEmissive = new Color3(0.1, 0.05, 0.14);
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
			5.2,
			Vector3.Zero(),
			scene,
		);
		camera.minZ = 0.1;
		camera.fov = 0.75;
		camera.detachControl();

		const key = new HemisphericLight("d20-key", new Vector3(0.3, 1, 0.4), scene);
		key.intensity = 0.8;
		key.diffuse = new Color3(1, 0.95, 0.85);
		key.groundColor = new Color3(0.12, 0.08, 0.18);

		const rim = new PointLight("d20-rim", new Vector3(-3, 2, -3), scene);
		rim.diffuse = new Color3(0.7, 0.55, 1);
		rim.intensity = 1.0;

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
			position: Vector3.Zero(),
			velocity: Vector3.Zero(),
			phaseStart: 0,
			phaseDuration: 0,
			targetValue: 20,
			targetQuat: null,
			settleFrom: null,
			settleRotation: Quaternion.Identity(),
			chargeIntensity: 0,
			lastTopFace: 0,
			reducedMotion: prefersReducedMotion(),
			critPulse: 0,
			rollPower: 0.7,
			bounceCount: 0,
			squash: 0,
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

	setHover(nx: number, ny: number): void {
		this.hoverTarget.x = clamp(nx, -1, 1);
		this.hoverTarget.y = clamp(ny, -1, 1);
	}

	clearHover(): void {
		this.hoverTarget.x = 0;
		this.hoverTarget.y = 0;
	}

	beginCharge(): void {
		const s = this.state;
		if (s.phase === "tumbling" || s.phase === "settling" || s.phase === "windup" || s.phase === "suspense") return;
		s.phase = "charging";
		s.chargeIntensity = 0;
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
	 * Kick off a full throw sequence. `power` 0..1 controls windup intensity,
	 * launch velocity, spin and number of bounces. Returns the resolved face value.
	 */
	roll(power = 0.7, value?: number): number {
		const s = this.state;
		if (
			s.phase === "tumbling" ||
			s.phase === "settling" ||
			s.phase === "windup" ||
			s.phase === "suspense"
		) {
			return s.targetValue;
		}

		const resolved = value ?? 1 + Math.floor(Math.random() * 20);
		const face = s.geometry.faces.find((f) => f.value === resolved)!;
		s.targetValue = resolved;
		s.targetQuat = face.targetQuat.clone();
		s.rollPower = clamp(power, 0, 1);
		s.chargeIntensity = 0;
		s.bounceCount = 0;

		// Give the die a touch of extra spin on the final settle so it slams
		// into place rather than slerping blandly.
		const extraTwist = Quaternion.RotationAxis(new Vector3(0, 0, 1), Math.PI * 2);
		s.settleRotation = s.targetQuat.multiply(extraTwist);

		const windupDur = s.reducedMotion ? 0.05 : 0.35 + power * 0.25;
		s.phase = "windup";
		s.phaseStart = performance.now() / 1000;
		s.phaseDuration = windupDur;
		this.callbacks.onRollStart?.(resolved);
		this.callbacks.onWindup?.();
		return resolved;
	}

	critFlare(kind: "crit-success" | "crit-fail"): void {
		if (kind === "crit-success") {
			this.flashLight.diffuse = new Color3(1, 0.85, 0.3);
			this.critEmissive = new Color3(0.55, 0.35, 0.05);
		} else {
			this.flashLight.diffuse = new Color3(1, 0.15, 0.12);
			this.critEmissive = new Color3(0.6, 0.06, 0.06);
		}
		this.flashLight.intensity = kind === "crit-success" ? 6 : 5;
		this.state.critPulse = 1;
		this.cameraShake.amplitude = kind === "crit-success" ? 0.12 : 0.18;
		this.cameraShake.decay = 3.5;
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
			for (const v of verts) {
				positions.push(v.x, v.y, v.z);
				normals.push(face.normal.x, face.normal.y, face.normal.z);
			}
			// Geometry stores triangles CCW-from-outside, but Babylon's default
			// left-handed system treats CW-from-outside as front-facing. Without
			// the flip, the user sees the *back* of the mesh (i.e. the opposite
			// face, which on a d20 sums to 21 with the intended one — that's
			// why nat 20 used to show a 1 and vice-versa).
			indices.push(base, base + 2, base + 1);
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
		mat.specularColor = new Color3(0.9, 0.78, 0.55);
		mat.specularPower = 56;
		mat.ambientColor = new Color3(0.4, 0.25, 0.5);
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
			case "windup":
				this.stepWindup(dt, now);
				break;
			case "tumbling":
				this.stepTumbling(dt, now);
				break;
			case "suspense":
				this.stepSuspense(dt, now);
				break;
			case "settling":
				this.stepSettling(dt, now);
				break;
			case "resting":
				this.stepResting(dt);
				break;
		}

		// Relax squash back to 0 every frame.
		s.squash *= Math.pow(0.6, dt * 60);
		this.applyTransform();
		this.applyHoverParallax(dt);
		this.applyCameraShake(dt);
		this.applyFlash(dt);
		this.applyCritEmissive(dt);
		this.maybeEmitFaceChange();
	}

	// ----- phase steps -----

	private stepIdle(dt: number): void {
		const drift = new Vector3(0.12, 0.35, 0.08);
		this.integrateRotation(drift, dt);
		this.ease(this.state.position, Vector3.Zero(), dt, 6);
		this.state.velocity.copyFromFloats(0, 0, 0);
	}

	private stepCharging(dt: number): void {
		const s = this.state;
		const wobble = 0.8 + s.chargeIntensity * 6.0;
		const t = performance.now() * 0.001;
		const axis = new Vector3(
			Math.sin(t * 18) * wobble,
			Math.cos(t * 15) * wobble,
			Math.sin(t * 12) * wobble * 0.5,
		);
		this.integrateRotation(axis, dt);

		const jitter = s.chargeIntensity * 0.06;
		const target = new Vector3(
			(Math.random() - 0.5) * jitter,
			Math.sin(t * 35) * jitter * 0.5,
			(Math.random() - 0.5) * jitter * 0.4,
		);
		this.ease(s.position, target, dt, 30);
		s.squash = Math.max(s.squash, s.chargeIntensity * 0.12);
	}

	/**
	 * Windup: die pulls back, rotates ominously; emissive pulses. Ends with
	 * a big "launch" impulse into `tumbling`.
	 */
	private stepWindup(dt: number, now: number): void {
		const s = this.state;
		const elapsed = now - s.phaseStart;
		const t = clamp(elapsed / s.phaseDuration, 0, 1);
		const eased = easeInCubic(t);

		// Pull the die back toward the camera and downward like a sling loading.
		const targetY = -0.05 - eased * 0.45;
		const targetZ = eased * 0.35;
		this.ease(s.position, new Vector3(0, targetY, targetZ), dt, 10);

		// Slow ominous twist that accelerates.
		const twist = new Vector3(0.4, 1.8 + eased * 2.5, 0.3);
		this.integrateRotation(twist, dt);

		// Vertical compression for the "crouch".
		s.squash = Math.max(s.squash, 0.15 + eased * 0.2);

		if (t >= 1) {
			this.launch();
		}
	}

	private launch(): void {
		const s = this.state;
		const power = s.rollPower;
		const now = performance.now() / 1000;

		const vy = 9 + power * 6;
		const vx = (Math.random() - 0.5) * 2.2;
		const vz = -1.2 - power * 1.4;
		s.velocity = new Vector3(vx, vy, vz);

		const spin = s.reducedMotion ? 6 : 14 + power * 18;
		const axis = new Vector3(
			Math.random() * 2 - 1,
			Math.random() * 2 - 1,
			Math.random() * 2 - 1,
		).normalize();
		s.angular = axis.scale(spin);

		const tumbleDur = s.reducedMotion ? 0.6 : 1.1 + power * 1.1;
		s.phase = "tumbling";
		s.phaseStart = now;
		s.phaseDuration = tumbleDur;
		s.bounceCount = 0;
		s.squash = 0.18;

		this.callbacks.onLaunch?.(power);
	}

	/**
	 * Tumbling: projectile arc, bounces on the invisible floor, progressively
	 * damped. Emits per-bounce callbacks so the Solid layer can play SFX /
	 * spawn particles.
	 */
	private stepTumbling(dt: number, now: number): void {
		const s = this.state;

		// Integrate gravity-driven position.
		s.velocity.y += GRAVITY * dt;
		s.position.addInPlace(s.velocity.scale(dt));

		// Angular damping so spin slows as bounces pile up.
		s.angular = s.angular.scale(Math.pow(0.94, dt * 60));
		this.integrateRotation(s.angular, dt);

		// Floor collision.
		if (s.position.y <= GROUND_Y && s.velocity.y < 0) {
			const impactSpeed = Math.abs(s.velocity.y);
			s.position.y = GROUND_Y;

			const restitution = 0.55 - s.bounceCount * 0.06;
			s.velocity.y = impactSpeed * Math.max(0.18, restitution);
			s.velocity.x *= 0.78;
			s.velocity.z *= 0.78;

			// Add a fresh spin kick on each bounce for chaotic tumbling.
			const kick = new Vector3(
				(Math.random() - 0.5) * impactSpeed * 1.1,
				(Math.random() - 0.5) * impactSpeed * 0.9,
				(Math.random() - 0.5) * impactSpeed * 1.1,
			);
			s.angular.addInPlace(kick);

			s.squash = Math.min(0.45, 0.15 + impactSpeed * 0.05);
			s.bounceCount += 1;
			const intensity = clamp(impactSpeed / 12, 0.15, 1);
			this.callbacks.onBounce?.(s.position.x, s.position.y, intensity);

			// Tiny camera shake per bounce.
			this.cameraShake.amplitude = Math.max(this.cameraShake.amplitude, intensity * 0.04);
			this.cameraShake.decay = 6;
		}

		// End tumble → suspense when time is up OR the die is nearly resting.
		const elapsed = now - s.phaseStart;
		const nearlyResting =
			s.bounceCount >= 3 &&
			Math.abs(s.velocity.y) < 1.0 &&
			Math.hypot(s.velocity.x, s.velocity.z) < 0.4;
		if (elapsed >= s.phaseDuration || nearlyResting) {
			this.enterSuspense(now);
		}
	}

	private enterSuspense(now: number): void {
		const s = this.state;
		s.phase = "suspense";
		s.phaseStart = now;
		// Reduced motion trims suspense to a blink.
		s.phaseDuration = s.reducedMotion ? 0.12 : 0.55;
		// Float the die up slightly and freeze rotation for a held beat.
		s.velocity.copyFromFloats(0, 0.8, 0);
		// Cache current rotation as the slerp-start for the settle phase.
		s.settleFrom = s.rotation.clone();
		this.callbacks.onSuspense?.();
	}

	/**
	 * Suspense: die hangs in the air, slowly lifting and twirling while a
	 * bated-breath SFX plays. Camera tightens in slightly for drama.
	 */
	private stepSuspense(dt: number, now: number): void {
		const s = this.state;
		const elapsed = now - s.phaseStart;
		const t = clamp(elapsed / s.phaseDuration, 0, 1);

		// Gentle float upward, easing into position.
		const targetPos = new Vector3(0, 0.6 + Math.sin(elapsed * 6) * 0.06, 0);
		this.ease(s.position, targetPos, dt, 8);
		s.velocity.copyFromFloats(0, 0, 0);

		// Very slow axial twirl.
		const twirl = new Vector3(0, 1.6, 0);
		this.integrateRotation(twirl, dt);

		// Subtle pulse of the emissive.
		s.critPulse = Math.max(s.critPulse, 0.25 + 0.25 * Math.sin(elapsed * 12));

		if (t >= 1) {
			s.phase = "settling";
			s.phaseStart = now;
			s.phaseDuration = s.reducedMotion ? 0.35 : 0.85;
			s.settleFrom = s.rotation.clone();
		}
	}

	private stepSettling(dt: number, now: number): void {
		const s = this.state;
		if (!s.targetQuat || !s.settleFrom) {
			s.phase = "resting";
			return;
		}
		const elapsed = now - s.phaseStart;
		const t = clamp(elapsed / s.phaseDuration, 0, 1);
		const eased = easeOutBack(t);

		// Interpolate rotation via an intermediate "overshoot" frame to make
		// the reveal feel snappy and confident.
		if (t < 0.7) {
			const k = t / 0.7;
			s.rotation = Quaternion.Slerp(s.settleFrom, s.settleRotation, easeOutQuart(k));
		} else {
			const k = (t - 0.7) / 0.3;
			s.rotation = Quaternion.Slerp(s.settleRotation, s.targetQuat, easeOutBack(k));
		}

		// Position drops from suspense height down to rest with a small squash.
		const posT = easeOutQuart(t);
		const targetY = 0.0;
		s.position.y = lerp(s.position.y, targetY, posT);
		s.position.x = lerp(s.position.x, 0, posT);
		s.position.z = lerp(s.position.z, 0, posT);
		if (t > 0.6 && s.squash < 0.25) s.squash = 0.22;

		if (t >= 1) {
			s.rotation = s.targetQuat.clone();
			s.phase = "resting";
			s.angular = Vector3.Zero();
			s.velocity = Vector3.Zero();
			s.position = Vector3.Zero();
			this.callbacks.onRollEnd?.(s.targetValue);
			if (s.targetValue === 20 || s.targetValue === 1) {
				s.critPulse = 1;
			}
		}
		void dt;
		void eased;
	}

	private stepResting(dt: number): void {
		const drift = new Vector3(0, 0.08, 0);
		this.integrateRotation(drift, dt);
		this.ease(this.state.position, Vector3.Zero(), dt, 4);
	}

	// ----- helpers -----

	private integrateRotation(angular: Vector3, dt: number): void {
		const s = this.state;
		const angle = angular.length() * dt;
		if (angle <= 1e-6) return;
		const axis = angular.normalizeToNew();
		const delta = Quaternion.RotationAxis(axis, angle);
		s.rotation = delta.multiply(s.rotation);
		s.rotation.normalize();
	}

	private applyTransform(): void {
		const s = this.state;
		s.dice.rotationQuaternion = s.rotation;
		s.dice.position.copyFrom(s.position);

		// Squash-and-stretch: preserve volume (roughly) by shrinking Y and
		// expanding X/Z by sqrt of the inverse.
		const sq = clamp(s.squash, 0, 0.5);
		const ySc = 1 - sq;
		const xzSc = 1 + sq * 0.5;
		s.dice.scaling.set(xzSc, ySc, xzSc);
	}

	private applyHoverParallax(dt: number): void {
		const camera = this.state.scene.activeCamera as ArcRotateCamera;
		if (!camera) return;
		const targetAlpha = Math.PI / 2 + this.hoverTarget.x * 0.3;
		const targetBeta = Math.PI / 2 - this.hoverTarget.y * 0.22;
		// Slight dolly-in during suspense + crit flash.
		const s = this.state;
		const tightness = (s.phase === "suspense" ? 0.4 : 0) + s.critPulse * 0.3;
		const targetRadius = 5.2 - tightness * 0.8;
		const k = 1 - Math.exp(-dt * 6);
		camera.alpha += (targetAlpha - camera.alpha) * k;
		camera.beta += (targetBeta - camera.beta) * k;
		camera.radius += (targetRadius - camera.radius) * k;
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
		this.flashLight.intensity *= Math.max(0, 1 - dt * 3.5);
	}

	private applyCritEmissive(dt: number): void {
		const mat = this.state.dice.material as StandardMaterial | null;
		if (!mat) return;
		const s = this.state;
		s.critPulse = Math.max(0, s.critPulse - dt * 1.0);
		const blend = clamp(s.critPulse, 0, 1);
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

	private ease(out: Vector3, target: Vector3, dt: number, speed: number): void {
		const k = 1 - Math.exp(-dt * speed);
		out.x += (target.x - out.x) * k;
		out.y += (target.y - out.y) * k;
		out.z += (target.z - out.z) * k;
	}
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, v));
}

function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * clamp(t, 0, 1);
}

function easeOutBack(t: number): number {
	const c1 = 1.70158;
	const c3 = c1 + 1;
	const x = t - 1;
	return 1 + c3 * x * x * x + c1 * x * x;
}

function easeOutQuart(t: number): number {
	const x = 1 - t;
	return 1 - x * x * x * x;
}

function easeInCubic(t: number): number {
	return t * t * t;
}

function prefersReducedMotion(): boolean {
	if (typeof window === "undefined" || !window.matchMedia) return false;
	try {
		return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	} catch {
		return false;
	}
}
