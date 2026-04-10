import { createSignal, onMount, onCleanup } from "solid-js";
import { playDiceRollSound } from "../../game/audio/SoundIntegration";

interface AnimatedD20Props {
	size?: number;
	rollOnMount?: boolean;
	class?: string;
}

/**
 * Animated D20 dice component that spins and shows random values.
 * Rolls once on page load and can be clicked to re-roll.
 */
export function AnimatedD20(props: AnimatedD20Props) {
	const size = () => props.size ?? 100;
	const rollOnMount = () => props.rollOnMount ?? true;
	
	const [currentValue, setCurrentValue] = createSignal(20);
	const [isRolling, setIsRolling] = createSignal(false);
	const [rotation, setRotation] = createSignal(0);
	const [tilt, setTilt] = createSignal({ x: 0, y: 0 });
	
	let rollTimeoutId: number | undefined;

	// All possible D20 values
	const d20Values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
	
	// Generate unique ID for gradients to avoid conflicts
	const uniqueId = Math.random().toString(36).substring(7);

	const rollDice = () => {
		if (isRolling()) return;
		
		setIsRolling(true);
		playDiceRollSound();
		
		// Number of value changes during roll
		const rollDuration = 1500;
		const changeInterval = 80;
		let elapsed = 0;
		
		const animateRoll = () => {
			if (elapsed < rollDuration) {
				// Show random values during roll
				const randomIndex = Math.floor(Math.random() * d20Values.length);
				setCurrentValue(d20Values[randomIndex]);
				
				// Update rotation for spinning effect
				setRotation(prev => prev + 45);
				
				// Random tilt for tumbling effect
				setTilt({
					x: (Math.random() - 0.5) * 30,
					y: (Math.random() - 0.5) * 30
				});
				
				elapsed += changeInterval;
				rollTimeoutId = window.setTimeout(animateRoll, changeInterval);
			} else {
				// Final value - dice settles completely
				const finalValue = d20Values[Math.floor(Math.random() * d20Values.length)];
				setCurrentValue(finalValue);
				setRotation(0);
				setTilt({ x: 0, y: 0 });
				setIsRolling(false);
			}
		};
		
		animateRoll();
	};

	onMount(() => {
		// Roll once on mount
		if (rollOnMount()) {
			// Small delay for page load visual effect
			setTimeout(rollDice, 300);
		}
	});

	onCleanup(() => {
		if (rollTimeoutId) clearTimeout(rollTimeoutId);
	});

	// Dynamic styles based on state
	const getTransformStyle = () => {
		const baseRotation = isRolling() ? rotation() : 0;
		const tiltX = tilt().x;
		const tiltY = tilt().y;
		return `perspective(200px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) rotate(${baseRotation}deg)`;
	};

	// Color based on roll value (critical hits/fails)
	const getValueColor = () => {
		const val = currentValue();
		if (val === 20) return "var(--gold-300)";
		if (val === 1) return "var(--status-danger)";
		return "white";
	};

	const getGlowColor = () => {
		const val = currentValue();
		if (val === 20) return "rgba(255, 215, 0, 0.6)";
		if (val === 1) return "rgba(255, 68, 68, 0.6)";
		return "rgba(139, 92, 246, 0.5)";
	};

	return (
		<div 
			class={`relative cursor-pointer select-none ${props.class ?? ''}`}
			style={{
				width: `${size()}px`,
				height: `${size()}px`,
			}}
			onClick={rollDice}
			title="Click to roll!"
		>
			<svg 
				viewBox="0 0 100 100" 
				class="w-full h-full drop-shadow-2xl transition-transform"
				style={{
					transform: getTransformStyle(),
					"transition-duration": isRolling() ? "0ms" : "300ms",
					filter: `drop-shadow(0 0 10px ${getGlowColor()})`,
				}}
			>
				<defs>
					{/* Main gradient */}
					<linearGradient id={`d20Gradient-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
						<stop offset="0%" style="stop-color:var(--plum-500)" />
						<stop offset="50%" style="stop-color:var(--plum-500)" />
						<stop offset="100%" style="stop-color:var(--arcindigo-500)" />
					</linearGradient>
					
					{/* Highlight gradient for 3D effect */}
					<linearGradient id={`d20Highlight-${uniqueId}`} x1="0%" y1="0%" x2="50%" y2="100%">
						<stop offset="0%" style="stop-color:rgba(255,255,255,0.3)" />
						<stop offset="100%" style="stop-color:rgba(255,255,255,0)" />
					</linearGradient>
					
					{/* Shadow gradient */}
					<linearGradient id={`d20Shadow-${uniqueId}`} x1="50%" y1="0%" x2="100%" y2="100%">
						<stop offset="0%" style="stop-color:rgba(0,0,0,0)" />
						<stop offset="100%" style="stop-color:rgba(0,0,0,0.3)" />
					</linearGradient>

					{/* Inner glow filter */}
					<filter id={`innerGlow-${uniqueId}`} x="-50%" y="-50%" width="200%" height="200%">
						<feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
						<feComposite in="blur" in2="SourceGraphic" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" />
					</filter>
				</defs>

				{/* D20 hexagon shape - main body */}
				<polygon 
					points="50,5 95,30 95,70 50,95 5,70 5,30" 
					fill={`url(#d20Gradient-${uniqueId})`}
					stroke="rgba(255,255,255,0.8)" 
					stroke-width="1.5"
				/>
				
				{/* Top face highlight */}
				<polygon 
					points="50,5 95,30 50,50 5,30" 
					fill={`url(#d20Highlight-${uniqueId})`}
				/>
				
				{/* Bottom face shadow */}
				<polygon 
					points="50,50 95,70 50,95 5,70" 
					fill={`url(#d20Shadow-${uniqueId})`}
				/>
				
				{/* Edge lines for 3D effect */}
				<line x1="50" y1="5" x2="50" y2="50" stroke="rgba(255,255,255,0.2)" stroke-width="1" />
				<line x1="50" y1="50" x2="5" y2="30" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
				<line x1="50" y1="50" x2="95" y2="30" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
				<line x1="50" y1="50" x2="50" y2="95" stroke="rgba(0,0,0,0.2)" stroke-width="1" />
				<line x1="50" y1="50" x2="5" y2="70" stroke="rgba(0,0,0,0.15)" stroke-width="1" />
				<line x1="50" y1="50" x2="95" y2="70" stroke="rgba(0,0,0,0.15)" stroke-width="1" />
				
				{/* Center decoration ring */}
				<circle 
					cx="50" 
					cy="50" 
					r="22" 
					fill="none" 
					stroke="rgba(255,255,255,0.15)" 
					stroke-width="1"
				/>
				
				{/* Number display with dynamic styling */}
				<text 
					x="50" 
					y="58" 
					text-anchor="middle" 
					fill={getValueColor()}
					font-size={currentValue() >= 10 ? "26" : "30"}
					font-weight="bold"
					class="transition-all duration-200"
					style={{
						"text-shadow": isRolling() 
							? "0 0 10px rgba(255,255,255,0.8)" 
							: `0 0 15px ${getGlowColor()}, 0 2px 4px rgba(0,0,0,0.5)`,
						"font-family": "'Cinzel', 'Georgia', serif",
					}}
				>
					{currentValue()}
				</text>
			</svg>
			
			{/* Glow effect behind the dice */}
			<div 
				class="absolute inset-0 rounded-full -z-10 transition-all duration-500"
				style={{
					background: `radial-gradient(circle, ${getGlowColor()} 0%, transparent 70%)`,
					transform: `scale(${isRolling() ? 1.5 : 1.2})`,
					opacity: isRolling() ? 0.8 : 0.4,
					animation: isRolling() ? "pulse 0.2s ease-in-out infinite" : "none",
				}}
			/>

			{/* Sparkle effects for nat 20 */}
			{currentValue() === 20 && !isRolling() && (
				<>
					<div class="absolute top-0 left-1/2 w-1 h-1 bg-yellow-300 rounded-full animate-ping" style="animation-duration: 1s;" />
					<div class="absolute bottom-0 right-1/4 w-1 h-1 bg-yellow-300 rounded-full animate-ping" style="animation-duration: 1.2s; animation-delay: 0.3s;" />
					<div class="absolute top-1/4 left-0 w-1 h-1 bg-yellow-300 rounded-full animate-ping" style="animation-duration: 0.8s; animation-delay: 0.6s;" />
				</>
			)}

			<style>{`
				@keyframes pulse {
					0%, 100% {
						opacity: 0.6;
						transform: scale(1.3);
					}
					50% {
						opacity: 1;
						transform: scale(1.6);
					}
				}
			`}</style>
		</div>
	);
}

export default AnimatedD20;

