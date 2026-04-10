import { Show, createEffect, createSignal, onMount, onCleanup } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { Sparkles, ChevronRight, ChevronLeft, X } from "lucide-solid";
import { TUTORIAL_STEPS } from "../tutorial/steps";
import {
  tutorialState,
  startTutorial,
  stopTutorial,
  nextTutorialStep,
  prevTutorialStep,
} from "../stores/tutorial.store";
import { authStore } from "../stores/auth.store";

const CARD_W = 420;
const CARD_GAP = 16;
const VIEW_PAD = 12;

function computeCardStyle(
  rect: DOMRect | null,
  vw: number,
  vh: number,
): Record<string, string> {
  const w = Math.min(CARD_W, vw - VIEW_PAD * 2);
  if (!rect) {
    return {
      left: "50%",
      bottom: "max(1rem, env(safe-area-inset-bottom))",
      width: `${w}px`,
      "max-width": "calc(100vw - 2rem)",
      transform: "translateX(-50%)",
      top: "auto",
    };
  }

  const estH = 280;
  const cx = rect.left + rect.width / 2;
  let top = rect.bottom + CARD_GAP;
  if (top + estH > vh - VIEW_PAD && rect.top > estH + VIEW_PAD) {
    top = rect.top - estH - CARD_GAP;
  }
  top = Math.max(VIEW_PAD, Math.min(top, vh - estH - VIEW_PAD));

  let left = cx - w / 2;
  left = Math.max(VIEW_PAD, Math.min(left, vw - w - VIEW_PAD));

  return {
    top: `${top}px`,
    left: `${left}px`,
    width: `${w}px`,
    "max-width": `${w}px`,
    transform: "none",
    bottom: "auto",
  };
}

export default function TutorialOverlay() {
  const navigate = useNavigate();
  const [targetRect, setTargetRect] = createSignal<DOMRect | null>(null);
  const [cardStyle, setCardStyle] = createSignal<Record<string, string>>({});
  const [pulseKey, setPulseKey] = createSignal(0);
  let rafId: number | null = null;
  let cardRef: HTMLDivElement | undefined;

  onMount(() => {
    if (!authStore.isAuthenticated()) return;
    if (tutorialState.completed) return;
    if (tutorialState.active) return;
    startTutorial(false);
  });

  const step = () => TUTORIAL_STEPS[tutorialState.stepIndex];
  const isLast = () => tutorialState.stepIndex >= TUTORIAL_STEPS.length - 1;
  const isFirst = () => tutorialState.stepIndex <= 0;

  createEffect(() => {
    if (!tutorialState.active) return;
    const r = step()?.route;
    if (r) navigate(r);
  });

  // One-time scroll + pulse when step / target changes
  createEffect(() => {
    if (!tutorialState.active) return;
    const target = step()?.target;
    const idx = tutorialState.stepIndex;
    setPulseKey((k) => k + 1);

    queueMicrotask(() => {
      if (!target) return;
      const el = document.querySelector(
        `[data-tutorial="${target}"]`,
      ) as HTMLElement | null;
      el?.scrollIntoView({
        block: "center",
        inline: "center",
        behavior: "smooth",
      });
    });
    void idx;
  });

  // Track target rect (no scroll every frame)
  createEffect(() => {
    if (!tutorialState.active) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      return;
    }

    const target = step()?.target;

    const tick = () => {
      if (!tutorialState.active) return;
      const t = step()?.target;
      if (!t) {
        setTargetRect(null);
        setCardStyle(
          computeCardStyle(null, window.innerWidth, window.innerHeight),
        );
      } else {
        const el = document.querySelector(
          `[data-tutorial="${t}"]`,
        ) as HTMLElement | null;
        if (el) {
          setTargetRect(el.getBoundingClientRect());
          setCardStyle(
            computeCardStyle(
              el.getBoundingClientRect(),
              window.innerWidth,
              window.innerHeight,
            ),
          );
        } else {
          setTargetRect(null);
          setCardStyle(
            computeCardStyle(null, window.innerWidth, window.innerHeight),
          );
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);

    const onResize = () => {
      const t = step()?.target;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (!t) {
        setTargetRect(null);
        setCardStyle(computeCardStyle(null, vw, vh));
        return;
      }
      const el = document.querySelector(
        `[data-tutorial="${t}"]`,
      ) as HTMLElement | null;
      if (el) {
        const r = el.getBoundingClientRect();
        setTargetRect(r);
        setCardStyle(computeCardStyle(r, vw, vh));
      } else {
        setTargetRect(null);
        setCardStyle(computeCardStyle(null, vw, vh));
      }
    };
    window.addEventListener("resize", onResize);
    onCleanup(() => {
      window.removeEventListener("resize", onResize);
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    });
  });

  // Replay enter animation on step change
  createEffect(() => {
    const idx = tutorialState.stepIndex;
    const el = cardRef;
    if (!el || !tutorialState.active) return;
    void idx;
    el.classList.remove("tutorial-card-pop");
    void el.offsetWidth;
    el.classList.add("tutorial-card-pop");
  });

  onCleanup(() => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  });

  const goNext = () => {
    if (isLast()) {
      stopTutorial(true);
      return;
    }
    nextTutorialStep(TUTORIAL_STEPS.length);
  };

  const goPrev = () => {
    if (isFirst()) return;
    prevTutorialStep();
  };

  return (
    <Show when={tutorialState.active}>
      <div class="fixed inset-0 z-[100] pointer-events-none">
        {/* Dim + spotlight — pointer-events-none pour laisser cliquer la cible */}
        <div class="absolute inset-0 pointer-events-none">
          <Show
            when={targetRect()}
            fallback={
              <div class="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px] transition-opacity duration-500" />
            }
          >
            {(r) => {
              const pad = 12;
              const box = r();
              const left = Math.max(0, box.left - pad);
              const top = Math.max(0, box.top - pad);
              const right = Math.min(window.innerWidth, box.right + pad);
              const bottom = Math.min(window.innerHeight, box.bottom + pad);
              const w = Math.max(0, right - left);
              const h = Math.max(0, bottom - top);

              return (
                <>
                  <div class="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px] transition-opacity duration-500" />
                  <div
                    class="absolute rounded-2xl tutorial-spotlight-ring"
                    style={{
                      left: `${left}px`,
                      top: `${top}px`,
                      width: `${w}px`,
                      height: `${h}px`,
                      "box-shadow": "0 0 0 9999px rgba(15, 23, 42, 0.55)",
                      border: "2px solid rgba(167, 139, 250, 0.55)",
                      "pointer-events": "none",
                    }}
                    data-pulse={pulseKey()}
                  />
                </>
              );
            }}
          </Show>
        </div>

        {/* Floating card — pointer-events-auto so buttons work */}
        <div
          ref={(el) => {
            cardRef = el;
          }}
          class="tutorial-floating-card pointer-events-auto fixed z-[101] rounded-2xl overflow-hidden border border-purple-500/30 bg-gradient-to-br from-[var(--ink-800)]/95 via-[var(--ink-900)]/98 to-[var(--ink-950)]/95 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_25px_50px_-12px_rgba(0,0,0,0.65),0_0_80px_-20px_rgba(139,92,246,0.35)]"
          style={cardStyle()}
        >
          {/* Top glow */}
          <div class="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-400/60 to-transparent" />
          <div class="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-purple-600/20 blur-3xl pointer-events-none tutorial-shimmer" />

          <div class="relative p-4 sm:p-5">
            <div class="flex items-start justify-between gap-3 mb-3">
              <div class="flex items-center gap-2 min-w-0">
                <div class="flex-shrink-0 w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center tutorial-icon-bounce">
                  <Sparkles class="w-4 h-4 text-purple-300" />
                </div>
                <div class="min-w-0">
                  <p class="text-[10px] uppercase tracking-widest text-purple-300/80 font-semibold">
                    Étape {tutorialState.stepIndex + 1} /{" "}
                    {TUTORIAL_STEPS.length}
                  </p>
                  <h3 class="font-display text-base sm:text-lg text-white leading-tight mt-0.5">
                    {step()?.title}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                class="flex-shrink-0 p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all hover:scale-105 active:scale-95"
                onClick={() => stopTutorial(false)}
                aria-label="Fermer le tutoriel"
              >
                <X class="w-4 h-4" />
              </button>
            </div>

            {/* Progress dots */}
            <div class="flex gap-1.5 mb-4">
              {TUTORIAL_STEPS.map((_, i) => (
                <div
                  class={`h-1.5 rounded-full transition-all duration-300 ${
                    i === tutorialState.stepIndex
                      ? "w-8 bg-gradient-to-r from-purple-400 to-violet-500 tutorial-dot-active"
                      : i < tutorialState.stepIndex
                        ? "w-2 bg-purple-500/50"
                        : "w-2 bg-white/15"
                  }`}
                />
              ))}
            </div>

            <p class="text-sm sm:text-[15px] text-slate-200/95 leading-relaxed whitespace-pre-wrap mb-5">
              {step()?.body}
            </p>

            <div class="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition disabled:opacity-30 disabled:pointer-events-none"
                disabled={isFirst()}
                onClick={goPrev}
              >
                <ChevronLeft class="w-4 h-4" />
                Retour
              </button>

              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="px-3 py-2 rounded-xl text-sm text-slate-400 hover:text-white border border-transparent hover:border-white/10 transition"
                  onClick={() => stopTutorial(false)}
                >
                  Plus tard
                </button>
                <button
                  type="button"
                  class="group inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 shadow-lg shadow-purple-900/40 transition-all hover:scale-[1.02] active:scale-[0.98] hover:shadow-purple-500/25"
                  onClick={goNext}
                >
                  {step()?.cta ?? (isLast() ? "Terminer" : "Suivant")}
                  <ChevronRight class="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes tutorialCardPop {
            0% {
              opacity: 0;
              transform: translateY(12px) scale(0.96);
              filter: blur(4px);
            }
            60% {
              opacity: 1;
              filter: blur(0);
            }
            100% {
              opacity: 1;
              transform: translateY(0) scale(1);
              filter: blur(0);
            }
          }
          .tutorial-card-pop {
            animation: tutorialCardPop 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          }
          @keyframes tutorialSpotPulse {
            0%, 100% {
              box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.55), 0 0 0 0 rgba(167, 139, 250, 0.35);
            }
            50% {
              box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.52), 0 0 24px 2px rgba(167, 139, 250, 0.25);
            }
          }
          .tutorial-spotlight-ring {
            animation: tutorialSpotPulse 2.2s ease-in-out infinite;
          }
          @keyframes tutorialIconBounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-2px); }
          }
          .tutorial-icon-bounce {
            animation: tutorialIconBounce 2s ease-in-out infinite;
          }
          @keyframes tutorialShimmer {
            0% { opacity: 0.4; transform: translate(0,0); }
            100% { opacity: 0.7; transform: translate(-8px, 8px); }
          }
          .tutorial-shimmer {
            animation: tutorialShimmer 4s ease-in-out infinite alternate;
          }
          @keyframes tutorialDotPulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.75; }
          }
          .tutorial-dot-active {
            animation: tutorialDotPulse 1.5s ease-in-out infinite;
          }
        `}</style>
      </div>
    </Show>
  );
}
