import { Component } from "solid-js";

export interface DmOverlayProps {
  text: string;
  /** "in" = visible, "out" = fading out, "hidden" = not rendered */
  phase?: "in" | "out" | "hidden";
}

export const DmOverlay: Component<DmOverlayProps> = (props) => {
  const phase = () => props.phase ?? "in";
  const isVisible = () => phase() === "in";
  const isHidden = () => phase() === "hidden";

  return (
    <div
      class="pointer-events-none select-none fixed top-0 left-0 right-0 z-50 flex justify-center"
      style={{
        "padding-top": "72px",
        transition: "opacity 0.6s cubic-bezier(.4,0,.2,1), transform 0.6s cubic-bezier(.4,0,.2,1), filter 0.6s ease",
        opacity: isHidden() ? "0" : isVisible() ? "1" : "0",
        transform: isVisible() ? "translateY(0) scale(1)" : "translateY(-40px) scale(0.95)",
        filter: isVisible() ? "blur(0)" : "blur(3px)",
        visibility: isHidden() && props.text.length === 0 ? "hidden" : "visible",
      }}
    >
      {/* Outer glow wrapper */}
      <div
        class="relative max-w-2xl w-full mx-4"
        style={{
          animation: isVisible() ? "dm-glow-pulse 4s ease-in-out infinite" : "none",
        }}
      >
        {/* Animated border frame */}
        <div
          class="absolute -inset-px rounded-2xl"
          style={{
            background: "linear-gradient(135deg, rgba(168,130,255,0.4), rgba(120,80,220,0.1), rgba(200,170,255,0.35), rgba(130,90,230,0.1))",
            "background-size": "300% 300%",
            animation: isVisible() ? "dm-border-shimmer 6s ease infinite" : "none",
          }}
        />

        {/* Main card */}
        <div
          class="relative px-8 py-6 rounded-2xl text-center overflow-hidden"
          style={{
            background: "linear-gradient(180deg, rgba(22, 10, 45, 0.95) 0%, rgba(14, 8, 30, 0.97) 100%)",
            "box-shadow": "0 0 40px rgba(139, 92, 246, 0.15), 0 0 80px rgba(139, 92, 246, 0.06), 0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          {/* Animated shimmer line across top */}
          <div
            class="absolute top-0 left-0 right-0 h-[1px]"
            style={{
              background: "linear-gradient(90deg, transparent 0%, transparent 30%, rgba(200,170,255,0.7) 50%, transparent 70%, transparent 100%)",
              "background-size": "200% 100%",
              animation: isVisible() ? "dm-shimmer-line 3s ease-in-out infinite" : "none",
            }}
          />

          {/* Corner accents */}
          <div class="absolute top-2 left-3 w-4 h-4 border-t border-l rounded-tl" style={{ "border-color": "rgba(168,130,255,0.25)" }} />
          <div class="absolute top-2 right-3 w-4 h-4 border-t border-r rounded-tr" style={{ "border-color": "rgba(168,130,255,0.25)" }} />
          <div class="absolute bottom-2 left-3 w-4 h-4 border-b border-l rounded-bl" style={{ "border-color": "rgba(168,130,255,0.15)" }} />
          <div class="absolute bottom-2 right-3 w-4 h-4 border-b border-r rounded-br" style={{ "border-color": "rgba(168,130,255,0.15)" }} />

          {/* DM icon / label */}
          <div class="flex items-center justify-center gap-2 mb-3">
            <div
              class="w-5 h-px"
              style={{ background: "linear-gradient(90deg, transparent, rgba(168,130,255,0.5))" }}
            />
            <span
              class="text-[11px] font-bold uppercase tracking-[0.25em]"
              style={{ color: "rgba(180, 150, 255, 0.8)" }}
            >
              ✦ Maître du Jeu ✦
            </span>
            <div
              class="w-5 h-px"
              style={{ background: "linear-gradient(90deg, rgba(168,130,255,0.5), transparent)" }}
            />
          </div>

          {/* Message text */}
          <p
            class="text-lg leading-relaxed whitespace-pre-wrap break-words"
            style={{
              color: "rgba(235, 225, 255, 0.95)",
              "font-family": "'Georgia', 'Times New Roman', serif",
              "font-style": "italic",
              "text-shadow": "0 0 24px rgba(139, 92, 246, 0.35), 0 0 8px rgba(168, 130, 255, 0.15)",
              "letter-spacing": "0.02em",
            }}
          >
            « {props.text} »
          </p>

          {/* Bottom decorative divider */}
          <div
            class="mx-auto mt-4 h-px rounded-full"
            style={{
              width: "40%",
              background: "linear-gradient(90deg, transparent, rgba(168,130,255,0.3), transparent)",
            }}
          />
        </div>
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes dm-glow-pulse {
          0%, 100% { filter: drop-shadow(0 0 12px rgba(139,92,246,0.15)); }
          50% { filter: drop-shadow(0 0 24px rgba(139,92,246,0.3)); }
        }
        @keyframes dm-border-shimmer {
          0%, 100% { background-position: 0% 0%; }
          50% { background-position: 100% 100%; }
        }
        @keyframes dm-shimmer-line {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
};
