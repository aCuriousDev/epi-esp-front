/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'game-dark': '#1a1a2e',
        'game-darker': '#0f0f1a',
        'game-accent': '#e94560',
        'game-gold': '#f4c542',
        'game-blue': '#0f3460',
        'game-blue-light': '#1e5a8e',
        'game-green': '#4ade80',
        'game-red': '#ef4444',
      },
      fontFamily: {
        'fantasy': ['Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
