import { Show, createEffect, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { TUTORIAL_STEPS } from "../tutorial/steps";
import {
  tutorialState,
  startTutorial,
  stopTutorial,
  nextTutorialStep,
  prevTutorialStep,
} from "../stores/tutorial.store";
import { authStore } from "../stores/auth.store";

export default function TutorialOverlay() {
  const navigate = useNavigate();

  // Auto-start for first-time users (only when authenticated).
  onMount(() => {
    if (!authStore.isAuthenticated()) return;
    if (tutorialState.completed) return;
    if (tutorialState.active) return;
    startTutorial(false);
  });

  const step = () => TUTORIAL_STEPS[tutorialState.stepIndex];
  const isLast = () => tutorialState.stepIndex >= TUTORIAL_STEPS.length - 1;
  const isFirst = () => tutorialState.stepIndex <= 0;

  // Navigate to the step route when step changes.
  createEffect(() => {
    if (!tutorialState.active) return;
    const r = step()?.route;
    if (r) navigate(r);
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
      <div class="fixed inset-0 z-[100]">
        <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" />

        <div class="absolute inset-0 flex items-center justify-center p-4">
          <div class="w-full max-w-lg bg-game-dark/90 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            <div class="p-5 border-b border-white/10">
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-xs text-slate-400">
                    Étape {tutorialState.stepIndex + 1}/{TUTORIAL_STEPS.length}
                  </p>
                  <h3 class="font-display text-lg text-white truncate">
                    {step()?.title}
                  </h3>
                </div>
                <button
                  class="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10 transition text-sm"
                  onClick={() => stopTutorial(false)}
                  title="Fermer"
                >
                  Passer
                </button>
              </div>
            </div>

            <div class="p-5">
              <p class="text-slate-200/90 leading-relaxed whitespace-pre-wrap">
                {step()?.body}
              </p>
            </div>

            <div class="p-5 border-t border-white/10 flex items-center justify-between gap-3">
              <button
                class="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition disabled:opacity-50"
                disabled={isFirst()}
                onClick={goPrev}
              >
                Retour
              </button>

              <div class="flex items-center gap-2">
                <button
                  class="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition"
                  onClick={() => stopTutorial(false)}
                >
                  Plus tard
                </button>
                <button
                  class="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white transition font-semibold"
                  onClick={goNext}
                >
                  {step()?.cta ?? (isLast() ? "Terminer" : "Suivant")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}

