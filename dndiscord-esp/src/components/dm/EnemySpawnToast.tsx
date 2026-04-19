/**
 * EnemySpawnToast — Shows a notification to all players when the DM spawns an enemy.
 */

import { Component, For, createEffect, createSignal, on, onCleanup } from "solid-js";
import { Skull } from "lucide-solid";
import { dmToolsState } from "../../stores/dmTools.store";

interface ToastEntry {
  name: string;
  x: number;
  z: number;
  _key: number;
}

export const EnemySpawnToast: Component = () => {
  const [toasts, setToasts] = createSignal<ToastEntry[]>([]);
  let nextKey = 0;
  const pendingTimers = new Set<number>();

  createEffect(
    on(
      () => dmToolsState.spawnedEnemies.length,
      (len, prevLen) => {
        if (prevLen === undefined || len <= prevLen) return;
        const latest = dmToolsState.spawnedEnemies[len - 1];
        if (!latest) return;

        const key = nextKey++;
        setToasts((prev) => [...prev, { ...latest, _key: key }]);

        const timer = window.setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t._key !== key));
          pendingTimers.delete(timer);
        }, 4000);
        pendingTimers.add(timer);
      },
    ),
  );

  onCleanup(() => {
    pendingTimers.forEach((t) => window.clearTimeout(t));
    pendingTimers.clear();
  });

  return (
    <div class="fixed top-24 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none">
      <For each={toasts()}>
        {(toast) => (
          <div
            class="pointer-events-auto bg-gradient-to-r from-red-950/95 to-red-900/90 backdrop-blur rounded-xl border border-red-500/30 px-5 py-3 shadow-2xl"
            style={{
              animation: "dm-slide-in 0.4s cubic-bezier(.4,0,.2,1)",
              "box-shadow": "0 0 30px rgba(220,38,38,0.2), 0 4px 20px rgba(0,0,0,0.4)",
            }}
          >
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-red-600/30 border border-red-500/40 flex items-center justify-center flex-shrink-0">
                <Skull class="w-4 h-4 text-red-300" />
              </div>
              <div>
                <p class="text-xs text-red-400 font-semibold uppercase tracking-wide">
                  Ennemi apparu !
                </p>
                <p class="text-sm text-white font-bold mt-0.5">
                  {toast.name}
                  <span class="text-red-300 font-normal text-xs ml-2">
                    ({toast.x}, {toast.z})
                  </span>
                </p>
              </div>
            </div>
          </div>
        )}
      </For>
    </div>
  );
};
