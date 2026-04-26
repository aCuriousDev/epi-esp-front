import { Component, For, JSX } from "solid-js";

/**
 * Atmospheric particle field — embers, orbs, sigils, sparks, wisp.
 * CSS classes defined in src/index.css. Locked to "balanced" intensity.
 *
 * Drop inside any relative parent. Pointer-events disabled.
 */

const PARTICLE_COUNTS = {
  embers: 32,
  orbs: 6,
  sigils: 4,
  sparks: 2,
  wisp: true,
} as const;

// Deterministic-but-varied — same seeded layout per mount, no per-frame churn.
function seedRand(seed: number): number {
  // Simple LCG for reproducible pseudo-random; values in [0, 1).
  return ((seed * 9301 + 49297) % 233280) / 233280;
}

function pick<T>(arr: readonly T[], seed: number): T {
  return arr[Math.floor(seedRand(seed) * arr.length)];
}

interface Mote {
  i: number;
  left: number;       // %
  dx: number;         // px horizontal drift
  dur: number;        // s rise duration
  delay: number;      // s negative offset
  size: number;       // px
  flickerDur: number; // s
  peak: number;       // 0..1
  tone: "" | "ember-plum" | "ember-indigo";
}

const buildEmbers = (count: number): Mote[] =>
  Array.from({ length: count }, (_, i) => {
    const s = i * 11 + 1;
    return {
      i,
      left: seedRand(s) * 100,
      dx: -80 + seedRand(s + 1) * 160,
      dur: 10 + seedRand(s + 2) * 16,
      delay: -seedRand(s + 3) * 26,
      size: 1 + seedRand(s + 4) * 2.5,
      flickerDur: 1.6 + seedRand(s + 5) * 2.6,
      peak: 0.5 + seedRand(s + 6) * 0.5,
      tone: pick(["", "ember-plum", "ember-indigo", "", ""] as const, s + 7),
    };
  });

interface Orb {
  i: number;
  left: number;
  dx: number;
  dur: number;
  delay: number;
  size: number;
  tone: "" | "orb-plum" | "orb-indigo";
}

const buildOrbs = (count: number): Orb[] =>
  Array.from({ length: count }, (_, i) => {
    const s = i * 19 + 7;
    return {
      i,
      left: -5 + seedRand(s) * 105,
      dx: -60 + seedRand(s + 1) * 120,
      dur: 28 + seedRand(s + 2) * 27,
      delay: -seedRand(s + 3) * 50,
      size: 60 + seedRand(s + 4) * 120,
      tone: pick(["", "orb-plum", "orb-indigo", "orb-plum"] as const, s + 5),
    };
  });

interface Sigil {
  i: number;
  top: number;
  left: number;
  dur: number;
  delay: number;
  peak: number;
  kind: number;
}

const buildSigils = (count: number): Sigil[] =>
  Array.from({ length: count }, (_, i) => {
    const s = i * 23 + 13;
    return {
      i,
      top: 8 + seedRand(s) * 72,
      left: 5 + seedRand(s + 1) * 87,
      dur: 14 + seedRand(s + 2) * 14,
      delay: -seedRand(s + 3) * 24,
      peak: 0.25 + seedRand(s + 4) * 0.3,
      kind: Math.floor(seedRand(s + 5) * 5),
    };
  });

interface Spark {
  i: number;
  top: number;
  left: number;
  dur: number;
  delay: number;
  sx: number;
  sy: number;
  rot: number;
}

const buildSparks = (count: number): Spark[] =>
  Array.from({ length: count }, (_, i) => {
    const s = i * 29 + 19;
    const angle = -30 - seedRand(s) * 30; // shoot up-right
    const distance = 180 + seedRand(s + 1) * 180;
    const sx = Math.cos((angle * Math.PI) / 180) * distance;
    const sy = Math.sin((angle * Math.PI) / 180) * distance;
    return {
      i,
      top: 20 + seedRand(s + 2) * 60,
      left: seedRand(s + 3) * 70,
      dur: 0.9 + seedRand(s + 4) * 0.7,
      delay: -seedRand(s + 5) * 20,
      sx,
      sy,
      rot: angle,
    };
  });

const RuneGlyph: Component<{ kind: number }> = (props) => {
  switch (props.kind) {
    case 0:
      return (
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.2">
          <circle cx="16" cy="16" r="13" />
          <polygon points="16,5 18,14 27,16 18,18 16,27 14,18 5,16 14,14" />
        </svg>
      );
    case 1:
      return (
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.2">
          <polygon points="16,3 29,12 24,28 8,28 3,12" />
          <circle cx="16" cy="17" r="4" />
        </svg>
      );
    case 2:
      return (
        <svg width="36" height="36" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.2">
          <circle cx="16" cy="16" r="12" />
          <line x1="16" y1="4" x2="16" y2="28" />
          <line x1="4" y1="16" x2="28" y2="16" />
          <line x1="7.5" y1="7.5" x2="24.5" y2="24.5" />
          <line x1="24.5" y1="7.5" x2="7.5" y2="24.5" />
        </svg>
      );
    case 3:
      return (
        <svg width="30" height="30" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.2">
          <path d="M16 3 L28 16 L16 29 L4 16 Z" />
          <path d="M16 9 L22 16 L16 23 L10 16 Z" />
        </svg>
      );
    default:
      return (
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.2">
          <polygon points="16,3 29,29 3,29" />
          <circle cx="16" cy="20" r="3" />
        </svg>
      );
  }
};

export const AmbientParticles: Component = () => {
  const embers = buildEmbers(PARTICLE_COUNTS.embers);
  const orbs = buildOrbs(PARTICLE_COUNTS.orbs);
  const sigils = buildSigils(PARTICLE_COUNTS.sigils);
  const sparks = buildSparks(PARTICLE_COUNTS.sparks);

  return (
    <>
      {PARTICLE_COUNTS.wisp && <span class="wisp" aria-hidden="true" />}

      <For each={orbs}>
        {(o) => (
          <span
            class={`orb ${o.tone}`}
            aria-hidden="true"
            style={{
              left: `${o.left}%`,
              "--dx": `${o.dx}px`,
              "animation-duration": `${o.dur}s`,
              "animation-delay": `${o.delay}s`,
              width: `${o.size}px`,
              height: `${o.size}px`,
            } as JSX.CSSProperties}
          />
        )}
      </For>

      <For each={sigils}>
        {(s) => (
          <span
            class="sigil"
            aria-hidden="true"
            style={{
              top: `${s.top}%`,
              left: `${s.left}%`,
              "animation-duration": `${s.dur}s`,
              "animation-delay": `${s.delay}s`,
              "--peak": String(s.peak),
            } as JSX.CSSProperties}
          >
            <RuneGlyph kind={s.kind} />
          </span>
        )}
      </For>

      <For each={embers}>
        {(m) => (
          <span
            class={`ember ${m.tone}`}
            aria-hidden="true"
            style={{
              left: `${m.left}%`,
              "--dx": `${m.dx}px`,
              "--peak": String(m.peak),
              "animation-duration": `${m.dur}s, ${m.flickerDur}s`,
              "animation-delay": `${m.delay}s, ${-seedRand(m.i * 7) * 4}s`,
              width: `${m.size}px`,
              height: `${m.size}px`,
            } as JSX.CSSProperties}
          />
        )}
      </For>

      <For each={sparks}>
        {(s) => (
          <span
            class="spark"
            aria-hidden="true"
            style={{
              top: `${s.top}%`,
              left: `${s.left}%`,
              "--sx": `${s.sx}px`,
              "--sy": `${s.sy}px`,
              transform: `rotate(${s.rot}deg)`,
              "animation-duration": `${s.dur}s`,
              "animation-delay": `${s.delay}s`,
            } as JSX.CSSProperties}
          />
        )}
      </For>
    </>
  );
};

export default AmbientParticles;
