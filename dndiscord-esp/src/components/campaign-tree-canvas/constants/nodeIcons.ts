/**
 * SVG icons extraits directement des données Lucide v0.548.0.
 *
 * draw2d.SVGFigure n'hérite PAS les attributs du <svg> parent lors du
 * parsing (importSVG). Chaque élément enfant doit donc porter ses propres
 * attributs stroke/fill.
 */

const P = 'stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"';

const wrap = (inner: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">${inner}</svg>`;

// ─── Scène — Book ────────────────────────────────────────────────────────────
export const ICON_SCENE = wrap(
  `<path ${P} d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/>`
);

// ─── Choix — GripHorizontal (6 points solides) ───────────────────────────────
export const ICON_CHOICES = wrap(
  `<circle cx="5"  cy="9"  r="1.5" fill="white" stroke="none"/>` +
  `<circle cx="12" cy="9"  r="1.5" fill="white" stroke="none"/>` +
  `<circle cx="19" cy="9"  r="1.5" fill="white" stroke="none"/>` +
  `<circle cx="5"  cy="15" r="1.5" fill="white" stroke="none"/>` +
  `<circle cx="12" cy="15" r="1.5" fill="white" stroke="none"/>` +
  `<circle cx="19" cy="15" r="1.5" fill="white" stroke="none"/>`
);

// ─── Combat — Sword ──────────────────────────────────────────────────────────
export const ICON_COMBAT = wrap(
  `<path ${P} d="m11 19-6-6"/>` +
  `<path ${P} d="m5 21-2-2"/>` +
  `<path ${P} d="m8 16-4 4"/>` +
  `<path ${P} d="M9.5 17.5 21 6V3h-3L6.5 14.5"/>`
);

// ─── Carte — Map ─────────────────────────────────────────────────────────────
export const ICON_MAP = wrap(
  `<path ${P} d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/>` +
  `<path ${P} d="M15 5.764v15"/>` +
  `<path ${P} d="M9 3.236v15"/>`
);
