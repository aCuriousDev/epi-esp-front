import { createEffect, createSignal, For, on, onCleanup } from "solid-js";
import { diceRequestsState } from "../../stores/diceRequests.store";
import { sessionState } from "../../stores/session.store";
import {
  playDiceCritSuccessSound,
  playDiceCritFailSound,
  playNotificationSound,
} from "../../game/audio/SoundIntegration";

interface ToastEntry {
  id: number;
  requestId: string;
  userId: string;
  userName: string;
  value: number;
  label: string | null;
  expiresAt: number;
}

let nextId = 1;

export default function DiceResultToast() {
  const [toasts, setToasts] = createSignal<ToastEntry[]>([]);
  const seen = new Set<string>();

  createEffect(
    on(
      // Flatten results across all requests so new entries are easy to spot.
      () =>
        Object.values(diceRequestsState).flatMap((r) =>
          Object.entries(r.results).map(([uid, res]) => ({
            requestId: r.requestId,
            userId: uid,
            result: res,
            label: r.label,
          }))
        ),
      (entries) => {
        const me = sessionState.hubUserId;
        for (const e of entries) {
          const key = `${e.requestId}:${e.userId}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const crit20 = e.result.value === 20;
          const crit1 = e.result.value === 1;
          const duration = crit20 || crit1 ? 7000 : 5000;

          setToasts((prev) => [
            ...prev,
            {
              id: nextId++,
              requestId: e.requestId,
              userId: e.userId,
              userName: e.result.userName,
              value: e.result.value,
              label: e.label,
              expiresAt: Date.now() + duration,
            },
          ]);

          playNotificationSound();
          if (e.userId !== me) {
            // Spectator hears the crit at half volume.
            if (crit20) playDiceCritSuccessSound({ volume: 0.5 });
            if (crit1) playDiceCritFailSound({ volume: 0.5 });
          }
        }
      }
    )
  );

  // Expire toasts every 250ms.
  const timerId = window.setInterval(() => {
    const now = Date.now();
    setToasts((prev) => prev.filter((t) => t.expiresAt > now));
  }, 250);

  onCleanup(() => {
    window.clearInterval(timerId);
  });

  return (
    <div class="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none">
      <For each={toasts()}>
        {(t) => {
          const tone =
            t.value === 20
              ? "bg-gradient-to-r from-yellow-900/95 to-slate-950/90 border-amber-400/60 text-amber-300"
              : t.value === 1
                ? "bg-gradient-to-r from-rose-950/95 to-slate-950/90 border-rose-500/60 text-rose-400"
                : "bg-gradient-to-r from-purple-900/95 to-slate-950/90 border-purple-500/30 text-purple-100";
          return (
            <div
              class={`backdrop-blur rounded-xl border px-4 py-2.5 shadow-2xl flex items-center gap-3 ${tone}`}
              style={{ animation: "roll-result-in 0.4s cubic-bezier(.4,0,.2,1)" }}
            >
              <span class="font-semibold text-sm">{t.userName}</span>
              <span class="font-display text-2xl font-bold tabular-nums">
                {t.value}
              </span>
              <span class="text-xs opacity-80">{t.label ?? "jet"}</span>
            </div>
          );
        }}
      </For>
    </div>
  );
}
