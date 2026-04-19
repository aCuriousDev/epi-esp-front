import { createSignal, onCleanup, onMount, Show } from "solid-js";

import {
	playDiceCritFailSound,
	playDiceCritSuccessSound,
	playDiceImpactSound,
	playDiceLaunchSound,
	playDiceShakeSound,
	playDiceSuspenseSound,
	playDiceWindupSound,
} from "../../../game/audio/SoundIntegration";

import { DiceEngine } from "./DiceEngine";
import { DiceVFX } from "./DiceVFX";

export interface Dice3DProps {
	/** Rendered width/height in CSS pixels. Defaults to 200. */
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
 * Dramatic 3D d20 for the home screen.
 *
 * Interaction model (mouse + touch, unified through pointer events):
 *   - Tap / click               → quick roll
 *   - Press-and-hold + shake    → charges a bigger throw (longer windup + more
 *                                 spin + more bounces), with the die rattling
 *                                 harder the more you shake
 *   - Drag-and-release (flick)  → flick speed & travel extend the power
 *   - Hover (desktop only)      → subtle parallax tilt
 *   - Keyboard Enter / Space    → roll
 */
export function Dice3D(props: Dice3DProps) {
	const size = () => props.size ?? 200;

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

	const vfxCenter = () => {
		if (!vfxCanvasRef) return { x: size() / 2, y: size() / 2 };
		const rect = vfxCanvasRef.getBoundingClientRect();
		return { x: rect.width / 2, y: rect.height / 2 };
	};

	onMount(() => {
		if (!canvasRef || !vfxCanvasRef || !containerRef) return;

		engine = new DiceEngine(canvasRef, {
			onRollStart: () => {
				setIsRolling(true);
			},
			onWindup: () => {
				playDiceWindupSound();
				vfx?.setTumble(true, 0.4);
			},
			onLaunch: (power) => {
				playDiceLaunchSound();
				vfx?.setTumble(true, 0.8 + power * 0.4);
			},
			onBounce: (_x, _y, intensity) => {
				if (!vfxCanvasRef || !vfx) return;
				const c = vfxCenter();
				vfx.burstBounce(c.x, c.y + size() * 0.18, intensity);
				playDiceImpactSound(0.4 + intensity * 0.6);
			},
			onSuspense: () => {
				playDiceSuspenseSound();
				vfx?.setTumble(false);
			},
			onRollEnd: (value) => {
				setCurrentValue(value);
				setIsRolling(false);
				vfx?.setTumble(false);

				if (value === 20) {
					setFlash("crit-success");
					playDiceCritSuccessSound();
					engine?.critFlare("crit-success");
					if (vfx) {
						const c = vfxCenter();
						vfx.critBurst("crit-success", c.x, c.y);
					}
					setTimeout(() => setFlash(null), 1400);
				} else if (value === 1) {
					setFlash("crit-fail");
					playDiceCritFailSound();
					engine?.critFlare("crit-fail");
					if (vfx) {
						const c = vfxCenter();
						vfx.critBurst("crit-fail", c.x, c.y);
					}
					setTimeout(() => setFlash(null), 1400);
				} else {
					playDiceImpactSound(0.9);
				}
				props.onRolled?.(value);
			},
			onFaceChange: (value) => setCurrentValue(value),
		});

		vfx = new DiceVFX(vfxCanvasRef);
		vfx.resize(size(), size());
		vfx.setAmbient(true);

		if (props.rollOnMount ?? true) {
			window.setTimeout(() => engine?.roll(0.75), 450);
		}

		// React to DPR / container size changes (orientation flips on mobile).
		const ro = new ResizeObserver(() => {
			engine?.resize();
			vfx?.resize(size(), size());
		});
		ro.observe(containerRef);
		onCleanup(() => ro.disconnect());
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
		vfx?.setCharging(0.1);

		chargeIntervalId = window.setInterval(() => {
			if (!engine || !charge.active) return;
			const heldMs = performance.now() - charge.startedAt;
			const holdPower = Math.min(heldMs / 1400, 1);
			const intensity = Math.min(1, holdPower + charge.shakeScore * 0.5);
			engine.updateCharge(intensity);
			vfx?.setCharging(intensity);

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

	const endCharge = () => {
		if (chargeIntervalId) {
			window.clearInterval(chargeIntervalId);
			chargeIntervalId = undefined;
		}
		charge.active = false;
		setIsCharging(false);
		vfx?.setCharging(0);
	};

	const handlePointerUp = (e: PointerEvent) => {
		if (!engine) return;
		try {
			(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
		} catch {
			// pointer capture may have already been released
		}
		if (!charge.active) return;

		const heldSec = (performance.now() - charge.startedAt) / 1000;
		const travel = Math.hypot(e.clientX - charge.startX, e.clientY - charge.startY);
		const flickSpeed = Math.hypot(charge.velX, charge.velY);
		const holdPower = Math.min(heldSec / 1.4, 1);
		const flickPower = Math.min(flickSpeed / 60, 1);
		const travelPower = Math.min(travel / 140, 1);
		const shakeBoost = Math.min(charge.shakeScore * 0.5, 0.5);
		const power = Math.max(0.4, Math.min(1, holdPower * 0.55 + flickPower * 0.5 + travelPower * 0.3 + shakeBoost));

		endCharge();
		engine.roll(power);
	};

	const handlePointerCancel = (e: PointerEvent) => {
		if (!engine) return;
		try {
			(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
		} catch {
			// ignore
		}
		if (charge.active) {
			endCharge();
			engine.cancelCharge();
		}
	};

	const handleMouseMove = (e: MouseEvent) => {
		if (!engine || !containerRef) return;
		// Skip parallax on touch: the same position is already fed via pointer events.
		if ("pointerType" in e && (e as unknown as PointerEvent).pointerType === "touch") return;
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
			engine?.roll(0.75);
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
			aria-label={`D20: ${currentValue()}. Cliquez, maintenez ou secouez pour relancer.`}
			title="Click, hold-and-shake, or flick to roll"
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
			onPointerCancel={handlePointerCancel}
			onMouseMove={handleMouseMove}
			onMouseLeave={handleMouseLeave}
			onKeyDown={handleKeyDown}
			onContextMenu={(e) => e.preventDefault()}
		>
			{/* Deep aura halo — intensifies while charging, flashes on crits. */}
			<div
				class="dice3d-aura pointer-events-none absolute -inset-[18%] -z-10 rounded-full transition-all duration-500 ease-grimoire"
				style={{
					background: auraBackground(flash(), isCharging()),
					transform: `scale(${isCharging() ? 1.1 : flash() ? 1.3 : 0.95})`,
					opacity: isCharging() ? 0.95 : flash() ? 1 : 0.55,
					filter: `blur(${isCharging() ? 22 : 18}px)`,
				}}
			/>

			{/* Rotating runic ring that lights up during charging. */}
			<div
				class="dice3d-ring pointer-events-none absolute inset-0 -z-[5]"
				style={{
					opacity: isCharging() ? 0.9 : isRolling() ? 0.6 : 0.35,
				}}
			>
				<div class="dice3d-ring-inner absolute inset-[6%] rounded-full border-2"
					style={{
						"border-color": flash() === "crit-success"
							? "rgba(244,197,66,0.7)"
							: flash() === "crit-fail"
								? "rgba(239,68,68,0.65)"
								: "rgba(169,104,174,0.55)",
						"box-shadow": flash() === "crit-success"
							? "0 0 40px rgba(244,197,66,0.55), inset 0 0 30px rgba(244,197,66,0.3)"
							: flash() === "crit-fail"
								? "0 0 40px rgba(239,68,68,0.5), inset 0 0 30px rgba(239,68,68,0.25)"
								: "0 0 22px rgba(139,92,246,0.35), inset 0 0 18px rgba(139,92,246,0.2)",
					}}
				/>
			</div>

			<canvas
				ref={canvasRef}
				class="dice3d-scene absolute inset-0 h-full w-full cursor-pointer rounded-full"
				style={{
					filter: flash() === "crit-success"
						? "drop-shadow(0 0 26px rgba(244,197,66,0.95))"
						: flash() === "crit-fail"
							? "drop-shadow(0 0 26px rgba(239,68,68,0.9))"
							: "drop-shadow(0 14px 28px rgba(0,0,0,0.6))",
				}}
			/>

			<canvas
				ref={vfxCanvasRef}
				class="dice3d-vfx pointer-events-none absolute inset-0 h-full w-full"
			/>

			<Show when={flash()}>
				<div
					class="dice3d-banner pointer-events-none absolute left-1/2 top-full -translate-x-1/2 translate-y-4 whitespace-nowrap font-display text-ds-h3 uppercase tracking-[0.28em]"
					style={{
						color: flash() === "crit-success" ? "var(--gold-300)" : "var(--status-danger)",
						"text-shadow": flash() === "crit-success"
							? "0 0 18px rgba(244,197,66,0.95), 0 0 34px rgba(244,197,66,0.55)"
							: "0 0 18px rgba(239,68,68,0.9), 0 0 34px rgba(239,68,68,0.5)",
					}}
				>
					{flash() === "crit-success" ? "Critique !" : "Échec critique"}
				</div>
			</Show>

			<style>{`
				.dice3d { cursor: pointer; outline: none; }
				.dice3d:focus-visible {
					box-shadow: 0 0 0 3px rgba(244,197,66,0.7);
					border-radius: 50%;
				}
				.dice3d-ring {
					animation: dice3d-spin 18s linear infinite;
				}
				.dice3d:hover .dice3d-ring-inner,
				.dice3d:focus-visible .dice3d-ring-inner {
					filter: brightness(1.25);
				}
				.dice3d-banner {
					animation: dice3d-pop 1.3s cubic-bezier(0.2, 0.8, 0.2, 1);
				}
				@keyframes dice3d-pop {
					0%   { opacity: 0; transform: translate(-50%, -6px) scale(0.9); letter-spacing: 0.1em; }
					18%  { opacity: 1; transform: translate(-50%, 14px) scale(1.15); letter-spacing: 0.32em; }
					70%  { opacity: 1; transform: translate(-50%, 16px) scale(1); letter-spacing: 0.28em; }
					100% { opacity: 0; transform: translate(-50%, 22px) scale(0.98); letter-spacing: 0.26em; }
				}
				@keyframes dice3d-spin {
					from { transform: rotate(0deg); }
					to   { transform: rotate(360deg); }
				}
				.ease-grimoire { transition-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1); }
				@media (prefers-reduced-motion: reduce) {
					.dice3d-ring   { animation-duration: 60s; }
					.dice3d-banner { animation-duration: 0.4s; }
				}
			`}</style>
		</div>
	);
}

function auraBackground(flash: "crit-success" | "crit-fail" | null, charging: boolean): string {
	if (flash === "crit-success") {
		return "radial-gradient(circle, rgba(244,197,66,0.8) 0%, rgba(139,92,246,0.28) 45%, transparent 75%)";
	}
	if (flash === "crit-fail") {
		return "radial-gradient(circle, rgba(239,68,68,0.78) 0%, rgba(43,15,46,0.4) 45%, transparent 75%)";
	}
	if (charging) {
		return "radial-gradient(circle, rgba(169,104,174,0.6) 0%, rgba(42,78,120,0.4) 45%, transparent 82%)";
	}
	return "radial-gradient(circle, rgba(169,104,174,0.45) 0%, rgba(42,78,120,0.28) 45%, transparent 82%)";
}

export default Dice3D;
