import { Component } from "solid-js";

export interface PlayerBubbleProps {
  text: string;
  playerName: string;
  color?: string;
  /** "in" = visible, "out" = fading out */
  phase?: "in" | "out";
}

export const PlayerBubble: Component<PlayerBubbleProps> = (props) => {
  const accent = () => props.color ?? "var(--plum-500)";
  const displayText = () =>
    props.text.length > 80 ? props.text.slice(0, 77) + "…" : props.text;
  const isVisible = () => (props.phase ?? "in") === "in";

  return (
    <div
      class="pointer-events-none select-none flex flex-col items-center"
      style={{
        "min-width": "130px",
        "max-width": "300px",
        transition: "opacity 0.5s cubic-bezier(.4,0,.2,1), transform 0.5s cubic-bezier(.4,0,.2,1), filter 0.5s ease",
        opacity: isVisible() ? "1" : "0",
        transform: isVisible() ? "translateY(0) scale(1)" : "translateY(12px) scale(0.92)",
        filter: isVisible() ? "blur(0)" : "blur(2px)",
      }}
    >
      {/* Outer glow ring */}
      <div
        class="relative rounded-xl"
        style={{
          padding: "1px",
          background: `linear-gradient(135deg, ${accent()}88, ${accent()}22, ${accent()}66)`,
          "background-size": "200% 200%",
          animation: isVisible() ? "bubble-glow 3s ease-in-out infinite" : "none",
          "box-shadow": `0 0 18px ${accent()}33, 0 4px 20px rgba(0,0,0,0.5)`,
        }}
      >
        {/* Inner bubble */}
        <div
          class="relative px-3.5 py-2.5 rounded-xl text-[13px] leading-snug backdrop-blur-md"
          style={{
            background: "linear-gradient(170deg, rgba(20,22,43,0.93) 0%, rgba(7,8,18,0.96) 100%)",
            color: "var(--text-high)",
          }}
        >
          {/* Subtle inner top highlight */}
          <div
            class="absolute top-0 left-3 right-3 h-px rounded-full"
            style={{ background: `linear-gradient(90deg, transparent, ${accent()}55, transparent)` }}
          />

          {/* Player name with icon-dot */}
          <div class="flex items-center gap-1.5 mb-1">
            <div
              class="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{
                background: accent(),
                "box-shadow": `0 0 6px ${accent()}`,
                animation: isVisible() ? "dot-pulse 2s ease-in-out infinite" : "none",
              }}
            />
            <span
              class="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: accent() }}
            >
              {props.playerName}
            </span>
          </div>

          <span class="block whitespace-pre-wrap break-words font-medium">
            {displayText()}
          </span>
        </div>
      </div>

      {/* Arrow pointing down */}
      <div
        style={{
          width: "0",
          height: "0",
          "border-left": "7px solid transparent",
          "border-right": "7px solid transparent",
          "border-top": `8px solid ${accent()}55`,
          "margin-top": "-1px",
          filter: `drop-shadow(0 2px 4px ${accent()}44)`,
        }}
      />

      {/* CSS keyframes — injected once via style tag */}
      <style>{`
        @keyframes bubble-glow {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes dot-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.7); }
        }
      `}</style>
    </div>
  );
};
