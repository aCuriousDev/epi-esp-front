import { Component, For, JSX } from "solid-js";

/**
 * Atmospheric particle field — soft round embers + diffuse orbs only.
 * CSS classes defined in src/index.css. Pointer-events disabled.
 */

const PARTICLE_COUNTS = {
  embers: 16,
  orbs: 4,
} as const;

// Deterministic-but-varied — same seeded layout per mount, no per-frame churn.
function seedRand(seed: number): number {
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
      size: 3 + seedRand(s + 4) * 3,           // 3px–6px (softer, larger)
      flickerDur: 1.6 + seedRand(s + 5) * 2.6,
      peak: 0.25 + seedRand(s + 6) * 0.3,      // 0.25–0.55 max (subtler)
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

export const AmbientParticles: Component = () => {
  const embers = buildEmbers(PARTICLE_COUNTS.embers);
  const orbs = buildOrbs(PARTICLE_COUNTS.orbs);

  return (
    <>
      {/* Orbs first — slow background depth */}
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

      {/* Embers — foreground soft glows */}
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
    </>
  );
};

export default AmbientParticles;
