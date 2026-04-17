/**
 * Runtime mirror of the Arcane Grimoire design tokens.
 *
 * Use this for HTML5 canvas / runtime JS consumers that cannot read
 * Tailwind classes (e.g. CampagnTreeCanvas). For CSS / JSX styling,
 * prefer Tailwind utilities or CSS custom properties.
 *
 * Source of truth: docs/design/DESIGN_SYSTEM.md §2.
 */

export const tokens = {
  ink: {
    950: "#070812",
    900: "#0F0F1A",
    800: "#14162B",
    700: "#1A1A2E",
    600: "#232544",
    500: "#2E3150",
  },
  plum: {
    900: "#2B0F2E",
    700: "#4B1E4E",
    500: "#6B2C6F",
    300: "#A968AE",
  },
  arcindigo: {
    900: "#0B1A2C",
    700: "#162C44",
    500: "#2A4E78",
    300: "#6A90C0",
  },
  gold: {
    700: "#8A6A1C",
    500: "#C99A2C",
    400: "#E3B23C",
    300: "#F4C542",
    200: "#FFE08A",
  },
  parchment: "#F5F1E4",
  text: {
    high: "#F5F1E4",
    mid:  "#CBC6B3",
    low:  "#8A8574",
    mute: "#5A5648",
  },
  status: {
    success: "#4ADE80",
    danger:  "#EF4444",
    warning: "#F59E0B",
    info:    "#38BDF8",
    crit:    "#F4C542",
    fumble:  "#9F1239",
  },
  discord: {
    blurple:     "#5865F2",
    blurpleDark: "#4752C4",
  },
  nodes: {
    story: {
      fill:   "#14162B",
      stroke: "#A968AE",
      text:   "#F5F1E4",
    },
    combat: {
      fill:   "#1A1A2E",
      stroke: "#EF4444",
      text:   "#F5F1E4",
    },
    start: {
      fill:   "#4B1E4E",
      stroke: "#F4C542",
      text:   "#F5F1E4",
    },
    end: {
      fill:   "#162C44",
      stroke: "#F4C542",
      text:   "#F5F1E4",
    },
  },
} as const;

export type Tokens = typeof tokens;
