import { DynamicTexture, Scene } from "@babylonjs/core";

import { ATLAS_COLS, ATLAS_ROWS } from "./diceGeometry";

const ATLAS_SIZE = 1024;

interface AtlasOptions {
	background: string;
	numeralColor: string;
	underlineColor: string;
	shadowColor: string;
	highlight?: string;
}

/**
 * Build a dynamic canvas texture laying numerals 1..20 in an ATLAS_COLS x
 * ATLAS_ROWS grid. Each cell is a rounded-square "face plate" that shows the
 * numeral rendered in the Cinzel-family fantasy font with a small underline
 * beneath 6 and 9 (so players can tell them apart — a classic d20 convention).
 */
export function createNumeralAtlas(scene: Scene, options: AtlasOptions): DynamicTexture {
	const tex = new DynamicTexture(
		"d20-numeral-atlas",
		{ width: ATLAS_SIZE, height: ATLAS_SIZE },
		scene,
		false,
	);
	tex.hasAlpha = true;

	const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
	ctx.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);

	const cellW = ATLAS_SIZE / ATLAS_COLS;
	const cellH = ATLAS_SIZE / ATLAS_ROWS;

	for (let value = 1; value <= 20; value++) {
		const idx = value - 1;
		const col = idx % ATLAS_COLS;
		const row = Math.floor(idx / ATLAS_COLS);
		const x = col * cellW;
		const y = row * cellH;
		paintCell(ctx, value, x, y, cellW, cellH, options);
	}

	tex.update(false);
	tex.anisotropicFilteringLevel = 8;
	return tex;
}

function paintCell(
	ctx: CanvasRenderingContext2D,
	value: number,
	x: number,
	y: number,
	w: number,
	h: number,
	opts: AtlasOptions,
): void {
	ctx.save();
	ctx.translate(x, y);

	const cx = w / 2;
	const cy = h / 2;
	const r = Math.min(w, h) * 0.42;

	const gradient = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
	gradient.addColorStop(0, opts.highlight ?? opts.background);
	gradient.addColorStop(1, opts.background);
	ctx.fillStyle = gradient;
	ctx.beginPath();
	ctx.arc(cx, cy, r, 0, Math.PI * 2);
	ctx.fill();

	// Subtle bevel ring to suggest a faceted dais
	ctx.strokeStyle = "rgba(255,224,138,0.12)";
	ctx.lineWidth = Math.max(2, r * 0.025);
	ctx.stroke();

	const fontSize = Math.floor(r * (value >= 10 ? 1.0 : 1.15));
	ctx.font = `900 ${fontSize}px 'Cinzel','IM Fell English SC',Georgia,serif`;
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";

	ctx.fillStyle = opts.shadowColor;
	ctx.fillText(`${value}`, cx + 4, cy + 6);

	ctx.save();
	ctx.shadowColor = opts.numeralColor;
	ctx.shadowBlur = r * 0.18;
	ctx.fillStyle = opts.numeralColor;
	ctx.fillText(`${value}`, cx, cy);
	ctx.restore();

	if (value === 6 || value === 9) {
		const underlineW = r * 0.55;
		const underlineY = cy + fontSize * 0.42;
		ctx.strokeStyle = opts.underlineColor;
		ctx.lineWidth = Math.max(3, r * 0.05);
		ctx.lineCap = "round";
		ctx.beginPath();
		ctx.moveTo(cx - underlineW / 2, underlineY);
		ctx.lineTo(cx + underlineW / 2, underlineY);
		ctx.stroke();
	}

	ctx.restore();
}

/**
 * Additive emissive mask: same glyphs as the base atlas but fully transparent
 * except under the numerals. Layered as an emissive texture this lights the
 * numbers up without washing out the dark plum base.
 */
export function createEmissiveAtlas(scene: Scene, color: string): DynamicTexture {
	const tex = new DynamicTexture(
		"d20-numeral-emissive",
		{ width: ATLAS_SIZE, height: ATLAS_SIZE },
		scene,
		false,
	);
	tex.hasAlpha = true;
	const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
	ctx.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);

	const cellW = ATLAS_SIZE / ATLAS_COLS;
	const cellH = ATLAS_SIZE / ATLAS_ROWS;

	for (let value = 1; value <= 20; value++) {
		const idx = value - 1;
		const col = idx % ATLAS_COLS;
		const row = Math.floor(idx / ATLAS_COLS);
		const cx = col * cellW + cellW / 2;
		const cy = row * cellH + cellH / 2;
		const r = Math.min(cellW, cellH) * 0.42;
		const fontSize = Math.floor(r * (value >= 10 ? 1.0 : 1.15));
		ctx.font = `900 ${fontSize}px 'Cinzel','IM Fell English SC',Georgia,serif`;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillStyle = color;
		ctx.shadowColor = color;
		ctx.shadowBlur = r * 0.25;
		ctx.fillText(`${value}`, cx, cy);

		if (value === 6 || value === 9) {
			const underlineW = r * 0.55;
			const underlineY = cy + fontSize * 0.42;
			ctx.strokeStyle = color;
			ctx.lineWidth = Math.max(3, r * 0.05);
			ctx.lineCap = "round";
			ctx.beginPath();
			ctx.moveTo(cx - underlineW / 2, underlineY);
			ctx.lineTo(cx + underlineW / 2, underlineY);
			ctx.stroke();
		}
	}

	tex.update(false);
	tex.anisotropicFilteringLevel = 8;
	return tex;
}

/** Default palette pulled from the Arcane Grimoire design tokens. */
export const GRIMOIRE_DIE: AtlasOptions = {
	background: "#2B0F2E",
	highlight: "#4B1E4E",
	numeralColor: "#F4C542",
	underlineColor: "#E3B23C",
	shadowColor: "rgba(0,0,0,0.55)",
};
