/**
 * ItemReceivedToast — Shows a notification when a player receives an item from the DM.
 * Visible to the recipient player only.
 */

import { Component, Show, For, createEffect, createSignal, on, onCleanup } from "solid-js";
import { Package } from "lucide-solid";
import { dmToolsState } from "../../stores/dmTools.store";
import { getHubUserId } from "../../stores/session.store";
import type { ItemGrantedPayload } from "../../types/multiplayer";

export const ItemReceivedToast: Component = () => {
  const [toasts, setToasts] = createSignal<
    Array<ItemGrantedPayload & { _key: number }>
  >([]);
  let nextKey = 0;
  const pendingTimers = new Set<number>();

  createEffect(
    on(
      () => dmToolsState.grantedItems.length,
      (len, prevLen) => {
        if (prevLen === undefined || len <= prevLen) return;
        const latest = dmToolsState.grantedItems[len - 1];
        if (!latest) return;

        // Show if we're the recipient
        const myId = getHubUserId();
        if (myId && latest.targetUserId.toLowerCase() === myId.toLowerCase()) {
          const key = nextKey++;
          setToasts((prev) => [...prev, { ...latest, _key: key }]);

          const timer = window.setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t._key !== key));
            pendingTimers.delete(timer);
          }, 5000);
          pendingTimers.add(timer);
        }
      },
    ),
  );

  onCleanup(() => {
    pendingTimers.forEach((t) => window.clearTimeout(t));
    pendingTimers.clear();
  });

  return (
    <div class="fixed bottom-20 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <For each={toasts()}>
        {(toast) => (
          <div
            class="pointer-events-auto animate-slide-in-right bg-gradient-to-r from-amber-950/95 to-amber-900/90 backdrop-blur rounded-xl border border-amber-500/30 px-4 py-3 shadow-2xl max-w-xs"
            style={{
              animation: "dm-slide-in 0.4s cubic-bezier(.4,0,.2,1)",
              "box-shadow": "0 0 30px rgba(217,119,6,0.15), 0 4px 20px rgba(0,0,0,0.4)",
            }}
          >
            <div class="flex items-start gap-3">
              <div class="w-8 h-8 rounded-lg bg-amber-600/30 border border-amber-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Package class="w-4 h-4 text-amber-300" />
              </div>
              <div>
                <p class="text-xs text-amber-400 font-semibold">
                  Item received!
                </p>
                <p class="text-sm text-white font-bold mt-0.5">
                  {toast.itemName}
                  {toast.quantity > 1 && (
                    <span class="text-amber-300 font-normal"> ×{toast.quantity}</span>
                  )}
                </p>
                <Show when={toast.description}>
                  <p class="text-[10px] text-gray-400 mt-0.5">
                    {toast.description}
                  </p>
                </Show>
              </div>
            </div>
          </div>
        )}
      </For>
    </div>
  );
};
