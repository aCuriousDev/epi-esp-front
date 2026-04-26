import { Component, For } from "solid-js";

interface AmbientParticlesProps {
  /** Number of motes. Default 18. */
  count?: number;
  /** "low" = sparser/slower; "medium" (default) = moderate; "high" = denser. */
  density?: "low" | "medium" | "high";
}

/**
 * Pure CSS ambient particle layer. Floats faint gold/plum motes upward
 * with random delays and durations. Absolutely positioned, pointer-events
 * disabled — drop it inside a relative parent.
 *
 * Honors prefers-reduced-motion via the global block in index.css that
 * sets animation-duration to 0.001ms — particles will appear static, fine.
 */
export const AmbientParticles: Component<AmbientParticlesProps> = (props) => {
  const count = () => props.count ?? 18;

  // Deterministic-but-varied positioning so re-renders don't reshuffle every frame.
  const motes = () =>
    Array.from({ length: count() }, (_, i) => {
      const seed = i * 97;
      const left = (seed * 17) % 100;       // 0..99 %
      const size = 2 + ((seed * 13) % 4);   // 2..5 px
      const delay = (seed % 12) * 0.7;       // 0..7.7 s
      const duration = 14 + ((seed * 11) % 18); // 14..31 s
      const tone = i % 3 === 0 ? "plum" : "gold";
      const opacity = 0.18 + (((seed * 19) % 25) / 100); // 0.18..0.42
      return { left, size, delay, duration, tone, opacity, key: i };
    });

  return (
    <div
      class="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <For each={motes()}>
        {(m) => (
          <span
            class="absolute block rounded-full"
            style={{
              left: `${m.left}%`,
              bottom: "-10px",
              width: `${m.size}px`,
              height: `${m.size}px`,
              background:
                m.tone === "plum"
                  ? "radial-gradient(circle, rgba(169,104,174,1) 0%, rgba(75,30,78,0.4) 60%, transparent 100%)"
                  : "radial-gradient(circle, rgba(244,197,66,1) 0%, rgba(201,154,44,0.4) 60%, transparent 100%)",
              opacity: m.opacity,
              filter: "blur(0.5px)",
              animation: `dnd-mote-rise ${m.duration}s linear ${m.delay}s infinite`,
              "box-shadow":
                m.tone === "plum"
                  ? "0 0 6px rgba(169,104,174,0.6)"
                  : "0 0 6px rgba(244,197,66,0.7)",
            }}
          />
        )}
      </For>
    </div>
  );
};

export default AmbientParticles;
