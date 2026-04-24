import { Quaternion, Vector3 } from "@babylonjs/core";

/**
 * Icosahedron geometry for a D&D d20.
 *
 * Generates 12 vertices (golden-ratio coordinates) and 20 triangular faces,
 * assigns numerals 1..20 so opposite faces sum to 21 (the classical d20 rule),
 * and precomputes a target quaternion per face so the die can be rotated to
 * present any given numeral toward the camera.
 */

export interface D20Face {
	/** Numeral displayed on this face (1..20). */
	value: number;
	/** Indices into `vertices` (length 3, counter-clockwise, outward-facing). */
	indices: [number, number, number];
	/** Outward unit normal of the face. */
	normal: Vector3;
	/** Centroid of the face (used for visibility / picking heuristics). */
	centroid: Vector3;
	/**
	 * Quaternion that, when applied to the mesh's rotation, makes this face
	 * point toward +Z (camera direction) with its numeral upright.
	 */
	targetQuat: Quaternion;
	/**
	 * UV-atlas mapping for this face. The three texture coordinates align
	 * with `indices[topVertex]`, `indices[leftVertex]`, `indices[rightVertex]`
	 * and they are laid out inside the numeral's atlas cell so the glyph
	 * reads upright when the face is camera-facing.
	 */
	uvs: { top: [number, number]; left: [number, number]; right: [number, number] };
	/** Which slot of `indices` is the upright "top" (0, 1 or 2). */
	topLocal: 0 | 1 | 2;
	/** Which slot is the bottom-left vertex when face is upright. */
	leftLocal: 0 | 1 | 2;
	/** Which slot is the bottom-right vertex when face is upright. */
	rightLocal: 0 | 1 | 2;
}

export interface D20Geometry {
	/** 12 unit-radius icosahedron vertices. */
	vertices: Vector3[];
	/** 20 triangular faces with numerals + target orientation. */
	faces: D20Face[];
	/** Grid of the numeral atlas that `uvs` point into. */
	atlas: { cols: number; rows: number };
}

const PHI = (1 + Math.sqrt(5)) / 2;

function icosahedronVertices(): Vector3[] {
	const raw: [number, number, number][] = [
		[0, 1, PHI], [0, -1, PHI], [0, 1, -PHI], [0, -1, -PHI],
		[1, PHI, 0], [-1, PHI, 0], [1, -PHI, 0], [-1, -PHI, 0],
		[PHI, 0, 1], [-PHI, 0, 1], [PHI, 0, -1], [-PHI, 0, -1],
	];
	return raw.map(([x, y, z]) => new Vector3(x, y, z).normalize());
}

/**
 * Discover the 20 faces by enumerating every triple of vertices whose
 * pairwise distances are (approximately) the icosahedron's edge length.
 * Each face is oriented counter-clockwise when viewed from outside.
 */
function buildFaces(vertices: Vector3[]): [number, number, number][] {
	const edgeLen = Vector3.Distance(vertices[0], vertices[1]);
	const eps = edgeLen * 0.01;
	const isEdge = (a: number, b: number): boolean =>
		Math.abs(Vector3.Distance(vertices[a], vertices[b]) - edgeLen) < eps;

	const faces: [number, number, number][] = [];
	for (let i = 0; i < 12; i++) {
		for (let j = i + 1; j < 12; j++) {
			if (!isEdge(i, j)) continue;
			for (let k = j + 1; k < 12; k++) {
				if (!isEdge(i, k) || !isEdge(j, k)) continue;
				const a = vertices[i];
				const b = vertices[j];
				const c = vertices[k];
				const centroid = a.add(b).add(c).scale(1 / 3);
				const normal = Vector3.Cross(b.subtract(a), c.subtract(a));
				// Ensure counter-clockwise winding outward.
				const tri: [number, number, number] =
					Vector3.Dot(normal, centroid) > 0 ? [i, j, k] : [i, k, j];
				faces.push(tri);
			}
		}
	}
	return faces;
}

/**
 * Assign numbers 1..20 across the faces such that opposite faces sum to 21.
 * We discover antipodal pairs by centroid inversion, then pair them up.
 *
 * The absolute numeral-to-face mapping is deterministic (seeded) but not the
 * real industry d20 layout — for the purpose of a flourish on the home
 * screen that shows a random numeral each roll, this is indistinguishable.
 */
function assignNumbers(faceCentroids: Vector3[]): number[] {
	const n = faceCentroids.length;
	const opposite: number[] = new Array(n).fill(-1);
	for (let i = 0; i < n; i++) {
		if (opposite[i] !== -1) continue;
		let best = -1;
		let bestDot = 1;
		for (let j = i + 1; j < n; j++) {
			if (opposite[j] !== -1) continue;
			const dot = Vector3.Dot(
				faceCentroids[i].normalizeToNew(),
				faceCentroids[j].normalizeToNew(),
			);
			if (dot < bestDot) {
				bestDot = dot;
				best = j;
			}
		}
		opposite[i] = best;
		opposite[best] = i;
	}

	const numbers: number[] = new Array(n).fill(0);
	let low = 1;
	let high = 20;
	const assigned = new Array<boolean>(n).fill(false);
	for (let i = 0; i < n && low < high; i++) {
		if (assigned[i]) continue;
		const j = opposite[i];
		numbers[i] = low;
		numbers[j] = high;
		assigned[i] = true;
		assigned[j] = true;
		low += 1;
		high -= 1;
	}
	return numbers;
}

/**
 * Shortest rotation that maps unit vector `from` onto unit vector `to`.
 */
function rotationBetween(from: Vector3, to: Vector3): Quaternion {
	const dot = Vector3.Dot(from, to);
	if (dot > 0.9999999) return Quaternion.Identity();
	if (dot < -0.9999999) {
		// Opposite vectors — rotate 180° around any perpendicular axis.
		const fallback = Math.abs(from.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
		const axis = Vector3.Cross(from, fallback).normalize();
		return Quaternion.RotationAxis(axis, Math.PI);
	}
	const axis = Vector3.Cross(from, to).normalize();
	const angle = Math.acos(dot);
	return Quaternion.RotationAxis(axis, angle);
}

function rotateVec(v: Vector3, q: Quaternion): Vector3 {
	const out = new Vector3();
	v.rotateByQuaternionToRef(q, out);
	return out;
}

/**
 * For each face, precompute the quaternion that rotates its outward normal
 * onto +Z (camera forward). Adds a twist so one chosen "top" vertex aligns
 * with +Y, which makes the numeral read upright.
 */
function buildFaceOrientation(
	face: [number, number, number],
	vertices: Vector3[],
	normal: Vector3,
): {
	quat: Quaternion;
	topLocal: 0 | 1 | 2;
	leftLocal: 0 | 1 | 2;
	rightLocal: 0 | 1 | 2;
} {
	const forward = new Vector3(0, 0, 1);
	const alignNormal = rotationBetween(normal, forward);

	const verts = face.map((idx) => rotateVec(vertices[idx], alignNormal));
	let topLocal: 0 | 1 | 2 = 0;
	for (let i = 1 as 0 | 1 | 2; i <= 2; i = (i + 1) as 0 | 1 | 2) {
		if (verts[i].y > verts[topLocal].y) topLocal = i;
		if (i === 2) break;
	}

	const topPos = verts[topLocal];
	const targetAngle = Math.PI / 2;
	const currentAngle = Math.atan2(topPos.y, topPos.x);
	const twist = Quaternion.RotationAxis(forward, targetAngle - currentAngle);
	const quat = twist.multiply(alignNormal);

	const others: (0 | 1 | 2)[] = ([0, 1, 2] as (0 | 1 | 2)[]).filter(
		(i) => i !== topLocal,
	);
	const rotatedAfterTwist = face.map((idx) => rotateVec(vertices[idx], quat));
	// Babylon uses a left-handed coordinate system: with the camera looking
	// toward -Z, world +X is drawn on the LEFT of the screen. So the vertex
	// that should receive the atlas's "left" UV is the one with the LARGER
	// world-X (not smaller — that would land on screen-right and mirror the
	// numeral horizontally).
	const leftLocal = rotatedAfterTwist[others[0]].x > rotatedAfterTwist[others[1]].x
		? others[0]
		: others[1];
	const rightLocal = leftLocal === others[0] ? others[1] : others[0];

	return { quat, topLocal, leftLocal, rightLocal };
}

export const ATLAS_COLS = 5;
export const ATLAS_ROWS = 4;

function uvForNumber(value: number): { top: [number, number]; left: [number, number]; right: [number, number] } {
	const idx = value - 1;
	const col = idx % ATLAS_COLS;
	const row = Math.floor(idx / ATLAS_COLS);
	const cellW = 1 / ATLAS_COLS;
	const cellH = 1 / ATLAS_ROWS;
	const cx = (col + 0.5) * cellW;
	const cy = (row + 0.5) * cellH;
	// Equilateral triangle inscribed in the cell with apex pointing up.
	const r = Math.min(cellW, cellH) * 0.44;
	const sqrt3over2 = Math.sqrt(3) / 2;
	return {
		top: [cx, cy - r],
		left: [cx - r * sqrt3over2, cy + r * 0.5],
		right: [cx + r * sqrt3over2, cy + r * 0.5],
	};
}

export function buildD20Geometry(): D20Geometry {
	const vertices = icosahedronVertices();
	const rawFaces = buildFaces(vertices);

	const centroids = rawFaces.map(([a, b, c]) =>
		vertices[a].add(vertices[b]).add(vertices[c]).scale(1 / 3),
	);
	const normals = centroids.map((c) => c.normalizeToNew());
	const numbers = assignNumbers(centroids);

	const faces: D20Face[] = rawFaces.map((indices, i) => {
		const orient = buildFaceOrientation(indices, vertices, normals[i]);
		const value = numbers[i];
		return {
			value,
			indices,
			normal: normals[i],
			centroid: centroids[i],
			targetQuat: orient.quat,
			topLocal: orient.topLocal,
			leftLocal: orient.leftLocal,
			rightLocal: orient.rightLocal,
			uvs: uvForNumber(value),
		};
	});

	return { vertices, faces, atlas: { cols: ATLAS_COLS, rows: ATLAS_ROWS } };
}

/**
 * Find the face whose numeral is currently most camera-facing (normal closest
 * to +Z after applying the given mesh rotation). Used to sync the displayed
 * "current value" during tumbling.
 */
export function topFaceIndex(geometry: D20Geometry, rotation: Quaternion): number {
	let bestIdx = 0;
	let bestDot = -Infinity;
	for (let i = 0; i < geometry.faces.length; i++) {
		const rotated = rotateVec(geometry.faces[i].normal, rotation);
		const dot = rotated.z;
		if (dot > bestDot) {
			bestDot = dot;
			bestIdx = i;
		}
	}
	return bestIdx;
}
