import { createEffect, createMemo, createSignal, Show, onMount } from "solid-js";
import { Portal } from "solid-js/web";
import Dice3D from "../common/DiceD20/Dice3D";
import { signalRService } from "../../services/signalr/SignalRService";
import {
  myPendingRequests,
  setDiceRequestsState,
} from "../../stores/diceRequests.store";

type Phase = "prompt" | "rolling" | "result" | "canceled" | "exit";

export default function DiceRollPrompt() {
  const active = createMemo(() => myPendingRequests()[0] ?? null);
  const [phase, setPhase] = createSignal<Phase>("prompt");
  const [lastValue, setLastValue] = createSignal<number | null>(null);
  const [reducedMotion, setReducedMotion] = createSignal(false);

  onMount(() => {
    setReducedMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  });

  // Reset phase whenever the active request changes.
  createEffect(() => {
    const req = active();
    if (req) {
      setPhase("prompt");
      setLastValue(null);
    }
  });

  // React to cancellation mid-flight.
  createEffect(() => {
    const req = active();
    if (req && req.status === "canceled" && phase() !== "exit") {
      setPhase("canceled");
      window.setTimeout(() => closeLocal(), 1000);
    }
  });

  function closeLocal(): void {
    const req = active();
    if (!req) return;
    // Mark local participation as submitted/skipped so the store filter removes
    // this request from myPendingRequests. The store entry itself is not deleted;
    // the server's RollResultBroadcast (or RollCanceled) keeps it in the shared log.
    setDiceRequestsState(req.requestId, "myParticipation", "submitted");
  }

  async function handleRolled(value: number): Promise<void> {
    const req = active();
    if (!req) return;
    setLastValue(value);
    setPhase("result");

    // Fire-and-forget. If the server has already canceled the request, the hub
    // silently ignores our submit. We do NOT flip myParticipation yet — the
    // `myPendingRequests` filter reads "waiting" only, and flipping off early
    // would unmount the modal mid-animation and swallow the result reveal.
    try {
      await signalRService.invoke("SubmitRollResult", { requestId: req.requestId });
    } catch {
      // Non-fatal — either the server dropped or the request was canceled.
    }

    const hold = reducedMotion() ? 900 : 1800;
    window.setTimeout(() => {
      setPhase("exit");
      setDiceRequestsState(req.requestId, "myParticipation", "submitted");
    }, hold);
  }

  const tone = createMemo(() => {
    const v = lastValue();
    if (v === 20)
      return {
        border: "border-amber-400",
        text: "text-amber-300",
        glow: "rgba(244,197,66,0.55)",
      };
    if (v === 1)
      return {
        border: "border-rose-500",
        text: "text-rose-400",
        glow: "rgba(159,18,57,0.55)",
      };
    return {
      border: "border-purple-500/40",
      text: "text-purple-100",
      glow: "transparent",
    };
  });

  return (
    <Show when={active()}>
      {(req) => (
        <Portal>
          <div
            class="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm"
            style={{
              transition: `opacity ${reducedMotion() ? 120 : 280}ms ease-out`,
              opacity: phase() === "exit" ? 0 : 1,
            }}
          >
            <p class="text-[11px] font-bold uppercase tracking-[0.25em] text-purple-300 mb-2">
              [Le MJ demande un jet]
            </p>
            <p
              class={`font-display italic text-2xl mb-6 ${tone().text}`}
              style={{ transition: "color 220ms cubic-bezier(0.22,1,0.36,1)" }}
            >
              {req().label ?? "Jet de dé"}
            </p>

            <div
              class={`relative rounded-2xl border ${tone().border} p-2`}
              style={{
                transition: "box-shadow 600ms cubic-bezier(0.2,0.8,0.2,1)",
                "box-shadow":
                  phase() === "result" &&
                  (lastValue() === 20 || lastValue() === 1)
                    ? `0 0 60px ${tone().glow}`
                    : "none",
              }}
            >
              <Dice3D
                size={280}
                rollOnMount={false}
                forcedValue={req().forcedValue ?? undefined}
                onRolled={handleRolled}
              />
            </div>

            <Show when={phase() === "prompt"}>
              <p class="mt-6 text-purple-200/70 text-sm tracking-wide animate-pulse">
                Appuyez sur le dé pour lancer
              </p>
            </Show>
            <Show when={phase() === "result" && lastValue() != null}>
              <p class={`mt-4 font-display text-6xl font-bold ${tone().text}`}>
                {lastValue()}
              </p>
            </Show>
            <Show when={phase() === "canceled"}>
              <p class="mt-4 text-purple-300/80 italic">Annulé par le MJ</p>
            </Show>
          </div>
        </Portal>
      )}
    </Show>
  );
}
