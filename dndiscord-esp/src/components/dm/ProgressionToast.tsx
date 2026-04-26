/**
 * ProgressionToast — Recipient and public toasts for DM-driven XP/level-up and gold grants.
 */

import { Component, For, Show, createEffect, createSignal, on, onCleanup } from "solid-js";
import { Sparkles, Coins } from "lucide-solid";
import { dmToolsState } from "../../stores/dmTools.store";
import { getHubUserId } from "../../stores/session.store";
import { playLevelUpSound, playNotificationSound } from "../../game/audio/SoundIntegration";
import type {
  CharacterProgressedPublicPayload,
  GoldGrantedPublicPayload,
} from "../../types/multiplayer";
import { coinLabel } from "../../utils/coinLabel";

type ToastKind = "progress" | "gold";

interface ToastEntry {
  _key: number;
  kind: ToastKind;
  title: string;
  body: string;
  accentClass: string;
}

export const ProgressionToast: Component = () => {
  const [toasts, setToasts] = createSignal<ToastEntry[]>([]);
  let nextKey = 0;
  const pendingTimers = new Set<number>();

  const pushToast = (entry: Omit<ToastEntry, "_key">) => {
    const key = nextKey++;
    setToasts((prev) => [...prev, { ...entry, _key: key }]);
    const timer = window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t._key !== key));
      pendingTimers.delete(timer);
    }, 5200);
    pendingTimers.add(timer);
  };

  createEffect(
    on(
      () => dmToolsState.characterProgressions.length,
      (len, prevLen) => {
        if (prevLen === undefined || len <= prevLen) return;
        const myId = getHubUserId();
        if (!myId) return;
        for (let i = prevLen; i < len; i++) {
          const evt = dmToolsState.characterProgressions[i];
          if (!evt || evt.targetUserId.toLowerCase() !== myId.toLowerCase()) continue;
          if (evt.levelUps > 0) {
            pushToast({
              kind: "progress",
              title: "Niveau supérieur !",
              body: `Niv. ${evt.previousLevel} -> ${evt.newLevel} (+${evt.levelUps})`,
              accentClass: "from-yellow-950/95 to-amber-900/90 border-amber-500/30",
            });
            playLevelUpSound();
          } else {
            pushToast({
              kind: "progress",
              title: "XP reçue",
              body: `+${evt.awardedExperience} XP`,
              accentClass: "from-indigo-950/95 to-violet-900/90 border-violet-500/30",
            });
            playNotificationSound();
          }
        }
      },
    ),
  );

  createEffect(
    on(
      () => dmToolsState.goldGranted.length,
      (len, prevLen) => {
        if (prevLen === undefined || len <= prevLen) return;
        const myId = getHubUserId();
        if (!myId) return;
        for (let i = prevLen; i < len; i++) {
          const evt = dmToolsState.goldGranted[i];
          if (!evt || evt.targetUserId.toLowerCase() !== myId.toLowerCase()) continue;
          const amount = evt.amount;
          const currency = coinLabel(evt.currencyType);
          const sign = amount > 0 ? "+" : "";
          pushToast({
            kind: "gold",
            title: amount >= 0 ? "Bourse modifiée" : "Monnaie retirée",
            body: `${sign}${amount} ${currency} (total ${evt.goldPieces} gp)`,
            accentClass: "from-amber-950/95 to-orange-900/90 border-orange-500/30",
          });
          playNotificationSound();
        }
      },
    ),
  );

  const handlePublicProgression = (event: Event) => {
    const evt = (event as CustomEvent<CharacterProgressedPublicPayload>).detail;
    pushToast({
      kind: "progress",
      title: "Progression",
      body: `${evt.targetCharacterName} atteint le niveau ${evt.newLevel} (+${evt.levelUps})`,
      accentClass: "from-indigo-950/95 to-violet-900/90 border-violet-500/30",
    });
    playNotificationSound();
  };

  const handlePublicGold = (event: Event) => {
    const evt = (event as CustomEvent<GoldGrantedPublicPayload>).detail;
    const sign = evt.amount > 0 ? "+" : "";
    pushToast({
      kind: "gold",
      title: evt.amount >= 0 ? "Monnaie reçue" : "Monnaie retirée",
      body: `${evt.targetCharacterName} : ${sign}${evt.amount} ${coinLabel(evt.currencyType)}`,
      accentClass: "from-amber-950/95 to-orange-900/90 border-orange-500/30",
    });
    playNotificationSound();
  };

  window.addEventListener("dm-character-progressed-public", handlePublicProgression);
  window.addEventListener("dm-gold-granted-public", handlePublicGold);

  onCleanup(() => {
    window.removeEventListener("dm-character-progressed-public", handlePublicProgression);
    window.removeEventListener("dm-gold-granted-public", handlePublicGold);
    pendingTimers.forEach((t) => window.clearTimeout(t));
    pendingTimers.clear();
  });

  return (
    <div class="fixed bottom-36 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <For each={toasts()}>
        {(toast) => (
          <div
            class={`pointer-events-auto backdrop-blur rounded-xl border px-4 py-3 shadow-2xl max-w-xs ${toast.accentClass}`}
            style={{
              animation: "dm-slide-in 0.38s cubic-bezier(.4,0,.2,1)",
            }}
          >
            <div class="flex items-start gap-3">
              <div class="w-8 h-8 rounded-lg bg-black/25 border border-white/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Show when={toast.kind === "progress"} fallback={<Coins class="w-4 h-4 text-orange-200" />}>
                  <Sparkles class="w-4 h-4 text-yellow-200" />
                </Show>
              </div>
              <div>
                <p class="text-xs text-white/75 font-semibold">{toast.title}</p>
                <p class="text-sm text-white font-bold mt-0.5">{toast.body}</p>
              </div>
            </div>
          </div>
        )}
      </For>
    </div>
  );
};
