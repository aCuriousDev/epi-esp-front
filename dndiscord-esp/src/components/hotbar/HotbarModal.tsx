import { Component, JSX, Show, onCleanup, onMount } from "solid-js";
import { X } from "lucide-solid";

interface HotbarModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: JSX.Element;
  /** Tailwind max-width override for the card. Defaults to max-w-3xl. */
  widthClass?: string;
}

/**
 * Minimal modal shell used by the hotbar to float the Inventory / Wallet
 * panels on demand. CSP-safe: no inline scripts, no backdrop-filter CDN,
 * transitions via Tailwind classes, animations via standard CSS opacity.
 *
 * Escape closes. Click on the backdrop closes. Clicks inside the card don't.
 */
export const HotbarModal: Component<HotbarModalProps> = (props) => {
  const handleKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") props.onClose();
  };

  onMount(() => {
    window.addEventListener("keydown", handleKey);
  });
  onCleanup(() => {
    window.removeEventListener("keydown", handleKey);
  });

  return (
    <Show when={props.open}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={props.onClose}
      >
        {/* Backdrop */}
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" />

        {/* Card */}
        <div
          class={`relative w-full ${props.widthClass ?? "max-w-3xl"} max-h-[85vh] overflow-y-auto bg-game-darker/95 border border-white/10 rounded-2xl shadow-2xl`}
          onClick={(e) => e.stopPropagation()}
        >
          <div class="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b border-white/10 bg-game-darker/95 backdrop-blur">
            <h2 class="font-display text-lg text-white tracking-wide">
              {props.title}
            </h2>
            <button
              onClick={props.onClose}
              class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Fermer"
            >
              <X class="w-4 h-4" />
            </button>
          </div>
          <div class="p-4">{props.children}</div>
        </div>
      </div>
    </Show>
  );
};
