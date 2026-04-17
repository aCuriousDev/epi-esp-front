import { createSignal, onCleanup, onMount, Show } from "solid-js";

import {
	playDiceCritFailSound,
	playDiceCritSuccessSound,
	playDiceImpactSound,
	playDiceRollSound,
	playDiceShakeSound,
} from "../../../game/audio/SoundIntegration";

import { DiceEngine } from "./DiceEngine";
import { DiceVFX } from "./DiceVFX";

export interface Dice3DProps {
	/** Rendered width/height in CSS pixels. Defaults to 128. */
	size?: number;
	/** Roll once automatically on mount. Defaults to true. */
	rollOnMount?: boolean;
	/** Optional extra CSS class applied to the wrapper. */
	class?: string;
	/** Fires after a roll settles — useful for parent-driven flourishes. */
	onRolled?: (value: number) => void;
}

interface ChargeState {
	active: boolean;
	startedAt: number;
	startX: number;
	startY: number;
	lastX: number;
	lastY: number;
	velX: number;
	velY: number;
	shakeScore: number;
}

/**
 * The new 3D d20 for the home screen.
 *
 * Interaction model:
 *   - Click → quick roll with moderate power.
 *   - Press-and-hold → "charge" (die rattles, rumble plays); release to throw,
 *     with power proportional to hold duration + shake vigor.
 *   - Press-and-drag → flick throw; speed & direction of the flick scale the
 *     roll power and axial spin axis.
 *   - Hover (desktop) → subtle parallax tilt.
 *
 * Rendering: Babylon-powered real 3D mesh on a transparent canvas, with a
 * separate 2D canvas on top for celebratory particles.
 */
export function Dice3D(props: Dice3DProps) {
	const size = () => props.size ?? 128;

	let containerRef: HTMLDivElement | undefined;
	let canvasRef: HTMLCanvasElement | undefined;
	let vfxCanvasRef: HTMLCanvasElement | undefined;
	let engine: DiceEngine | null = null;
	let vfx: DiceVFX | null = null;
	let chargeIntervalId: number | undefined;
	let shakeSoundThrottle = 0;

	const [currentValue, setCurrentValue] = createSignal(20);
	const [isRolling, setIsRolling] = createSignal(false);
	const [isCharging, setIsCharging] = createSignal(false);
	const [flash, setFlash] = createSignal<"crit-success" | "crit-fail" | null>(null);

	const charge: ChargeState = {
		active: false,
		startedAt: 0,
		startX: 0,
		startY: 0,
		lastX: 0,
		lastY: 0,
		velX: 0,
		velY: 0,
		shakeScore: 0,
	};

	onMount(() => {
		if (!canvasRef || !vfxCanvasRef || !containerRef) return;

		engine = new DiceEngine(canvasRef, {
			onRollStart: (value) => {
				setIsRolling(true);
				playDiceRollSound();
				// Note: the roll SFX itself is a full tumble sequence; no need
				// to spam per-bounce impacts on top. We let onBounce handle a
				// couple of light tactile clicks for extra texture.
				void value;
			},
			onBounce: (intensity) => {
				if (!vfx || !vfxCanvasRef) return;
				const rect = vfxCanvasRef.getBoundingClientRect();
				vfx.burstBounce(rect.width / 2, rect.height / 2, intensity);
				// Only the louder bounces get a sound — the procedural roll
				// already covers the tumble cadence.
				if (intensity > 0.65) playDiceImpactSound(intensity * 0.6);
			},
			onRollEnd: (value) => {
				setCurrentValue(value);
				setIsRolling(false);
				if (value === 20) {
					setFlash("crit-success");
					playDiceCritSuccessSound();
					engine?.critFlare("crit-success");
					if (vfxCanvasRef && vfx) {
						const rect = vfxCanvasRef.getBoundingClientRect();
						vfx.critBurst("crit-success", rect.width / 2, rect.height / 2);
					}
					setTimeout(() => setFlash(null), 900);
				} else if (value === 1) {
					setFlash("crit-fail");
					playDiceCritFailSound();
					engine?.critFlare("crit-fail");
					if (vfxCanvasRef && vfx) {
						const rect = vfxCanvasRef.getBoundingClientRect();
						vfx.critBurst("crit-fail", rect.width / 2, rect.height / 2);
					}
					setTimeout(() => setFlash(null), 900);
				} else {
					playDiceImpactSound(0.85);
				}
				props.onRolled?.(value);
			},
			onFaceChange: (value) => setCurrentValue(value),
		});

		vfx = new DiceVFX(vfxCanvasRef);
		vfx.resize(size(), size());

		if (props.rollOnMount ?? true) {
			window.setTimeout(() => engine?.roll(0.7), 350);
		}
	});

	onCleanup(() => {
		if (chargeIntervalId) window.clearInterval(chargeIntervalId);
		engine?.dispose();
		vfx?.dispose();
		engine = null;
		vfx = null;
	});

	const handlePointerDown = (e: PointerEvent) => {
		if (!engine || isRolling()) return;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		charge.active = true;
		charge.startedAt = performance.now();
		charge.startX = e.clientX;
		charge.startY = e.clientY;
		charge.lastX = e.clientX;
		charge.lastY = e.clientY;
		charge.velX = 0;
		charge.velY = 0;
		charge.shakeScore = 0;
		setIsCharging(true);
		engine.beginCharge();

		// Tick charge intensity + periodic shake rumble while held.
		chargeIntervalId = window.setInterval(() => {
			if (!engine || !charge.active) return;
			const heldMs = performance.now() - charge.startedAt;
			const holdPower = Math.min(heldMs / 1200, 1);
			const intensity = Math.min(1, holdPower + charge.shakeScore * 0.5);
			engine.updateCharge(intensity);

			const nowMs = performance.now();
			if (charge.shakeScore > 0.3 && nowMs - shakeSoundThrottle > 180) {
				shakeSoundThrottle = nowMs;
				playDiceShakeSound();
			}
			charge.shakeScore *= 0.85;
		}, 60);
	};

	const handlePointerMove = (e: PointerEvent) => {
		if (!charge.active) return;
		const dx = e.clientX - charge.lastX;
		const dy = e.clientY - charge.lastY;
		charge.velX = 0.8 * charge.velX + 0.2 * dx;
		charge.velY = 0.8 * charge.velY + 0.2 * dy;
		charge.lastX = e.clientX;
		charge.lastY = e.clientY;
		charge.shakeScore = Math.min(1.4, charge.shakeScore + Math.hypot(dx, dy) * 0.015);
	};

	const handlePointerUp = (e: PointerEvent) => {
		if (!engine) return;
		try {
			(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
		} catch {
			// pointer capture may have already been released
		}
		if (!charge.active) return;
		charge.active = false;
		setIsCharging(false);
		if (chargeIntervalId) {
			window.clearInterval(chargeIntervalId);
			chargeIntervalId = undefined;
		}

		const heldSec = (performance.now() - charge.startedAt) / 1000;
		const travel = Math.hypot(e.clientX - charge.startX, e.clientY - charge.startY);
		const flickSpeed = Math.hypot(charge.velX, charge.velY);
		const holdPower = Math.min(heldSec / 1.2, 1);
		const flickPower = Math.min(flickSpeed / 60, 1);
		const travelPower = Math.min(travel / 120, 1);
		const shakeBoost = Math.min(charge.shakeScore * 0.5, 0.5);
		const power = Math.max(0.35, Math.min(1, holdPower * 0.6 + flickPower * 0.5 + travelPower * 0.3 + shakeBoost));
		engine.roll(power);
	};

	const handlePointerCancel = (e: PointerEvent) => {
		if (!engine) return;
		try {
			(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
		} catch {
			// ignore
		}
		if (chargeIntervalId) {
			window.clearInterval(chargeIntervalId);
			chargeIntervalId = undefined;
		}
		if (charge.active) {
			charge.active = false;
			setIsCharging(false);
			engine.cancelCharge();
		}
	};

	const handleMouseMove = (e: MouseEvent) => {
		if (!engine || !containerRef) return;
		const rect = containerRef.getBoundingClientRect();
		const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
		const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
		engine.setHover(nx, ny);
	};

	const handleMouseLeave = () => engine?.clearHover();

	const handleKeyDown = (e: KeyboardEvent) => {
		if (isRolling()) return;
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			engine?.roll(0.7);
		}
	};

	return (
		<div
			ref={containerRef}
			class={`dice3d relative select-none ${props.class ?? ""}`}
			style={{
				width: `${size()}px`,
				height: `${size()}px`,
				"touch-action": "none",
			}}
			role="button"
			tabindex={0}
			aria-label={`D20: ${currentValue()}. Appuyez pour relancer.`}
			title="Click, hold, or flick to roll"
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
			onPointerCancel={handlePointerCancel}
			onMouseMove={handleMouseMove}
			onMouseLeave={handleMouseLeave}
			onKeyDown={handleKeyDown}
		>
			{/* Aura / glow halo that intensifies while charging. */}
			<div
				class="dice3d-aura pointer-events-none absolute inset-0 -z-10 rounded-full transition-all duration-300 ease-grimoire"
				style={{
					background: auraBackground(flash(), isCharging()),
					transform: `scale(${isCharging() ? 1.55 : flash() ? 1.7 : 1.25})`,
					opacity: isCharging() ? 0.9 : flash() ? 0.95 : 0.45,
					filter: `blur(${isCharging() ? 18 : 14}px)`,
				}}
			/>

			<canvas
				ref={canvasRef}
				class="dice3d-scene absolute inset-0 h-full w-full cursor-pointer rounded-full"
				style={{
					filter: flash() === "crit-success"
						? "drop-shadow(0 0 18px rgba(244,197,66,0.9))"
						: flash() === "crit-fail"
							? "drop-shadow(0 0 18px rgba(239,68,68,0.85))"
							: "drop-shadow(0 8px 18px rgba(0,0,0,0.55))",
				}}
			/>

			<canvas
				ref={vfxCanvasRef}
				class="dice3d-vfx pointer-events-none absolute inset-0 h-full w-full"
			/>

			{/* Crit banner — compact, respects the Arcane Grimoire type scale. */}
			<Show when={flash()}>
				<div
					class="dice3d-banner pointer-events-none absolute left-1/2 top-full -translate-x-1/2 translate-y-3 whitespace-nowrap font-display text-ds-small uppercase tracking-[0.22em]"
					style={{
						color: flash() === "crit-success" ? "var(--gold-300)" : "var(--status-danger)",
						"text-shadow": flash() === "crit-success"
							? "0 0 12px rgba(244,197,66,0.85)"
							: "0 0 12px rgba(239,68,68,0.85)",
					}}
				>
					{flash() === "crit-success" ? "Critique !" : "Échec critique"}
				</div>
			</Show>

			<style>{`
				.dice3d { cursor: pointer; outline: none; }
				.dice3d:focus-visible {
					box-shadow: 0 0 0 2px rgba(244,197,66,0.7);
					border-radius: 50%;
				}
				.dice3d-banner {
					animation: dice3d-pop 0.9s cubic-bezier(0.2, 0.8, 0.2, 1);
				}
				@keyframes dice3d-pop {
					0% { opacity: 0; transform: translate(-50%, 0); }
					25% { opacity: 1; transform: translate(-50%, 10px) scale(1.05); }
					100% { opacity: 0; transform: translate(-50%, 18px) scale(1); }
				}
				.ease-grimoire { transition-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1); }
				@media (prefers-reduced-motion: reduce) {
					.dice3d-banner { animation-duration: 0.2s; }
				}
			`}</style>
		</div>
	);
}

function auraBackground(flash: "crit-success" | "crit-fail" | null, charging: boolean): string {
	if (flash === "crit-success") {
		return "radial-gradient(circle, rgba(244,197,66,0.7) 0%, rgba(139,92,246,0.2) 45%, transparent 75%)";
	}
	if (flash === "crit-fail") {
		return "radial-gradient(circle, rgba(239,68,68,0.7) 0%, rgba(43,15,46,0.35) 45%, transparent 75%)";
	}
	if (charging) {
		return "radial-gradient(circle, rgba(169,104,174,0.55) 0%, rgba(42,78,120,0.35) 45%, transparent 80%)";
	}
	return "radial-gradient(circle, rgba(169,104,174,0.45) 0%, rgba(42,78,120,0.25) 45%, transparent 80%)";
}

export default Dice3D;
