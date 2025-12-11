/** @type {import('tailwindcss').Config} */
export default {
	content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
	theme: {
		extend: {
			colors: {
				// POC game colors
				"game-dark": "#1a1a2e",
				"game-darker": "#0f0f1a",
				"game-accent": "#e94560",
				"game-gold": "#f4c542",
				"game-blue": "#0f3460",
				"game-blue-light": "#1e5a8e",
				"game-green": "#4ade80",
				"game-red": "#ef4444",
				// Brand colors (purple/dark blue theme)
				brandStart: "#4B1E4E",
				brandEnd: "#162C44",
				ink: "#0b0e12",
				cloud: "rgba(255,255,255,0.06)",
			},
			fontFamily: {
				fantasy: ["Cinzel", "Georgia", "serif"],
				display: ["Cinzel", "serif"],
				old: ["IM Fell English SC", "serif"],
			},
			boxShadow: {
				insetGlow: "inset 0 0 40px rgba(148, 163, 184, 0.2)",
				soft: "0 10px 30px rgba(0,0,0,0.25)",
			},
			backgroundImage: {
				"brand-gradient": "linear-gradient(135deg, #4B1E4E 0%, #162C44 100%)",
			},
		},
	},
	plugins: [],
};
