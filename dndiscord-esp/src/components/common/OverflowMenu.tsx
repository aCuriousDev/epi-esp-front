import { Component, JSX, createSignal, For, Show, onCleanup, onMount } from "solid-js";
import { MoreHorizontal } from "lucide-solid";

export interface OverflowMenuItem {
  label: string;
  icon?: JSX.Element;
  onClick: () => void;
}

export const OverflowMenu: Component<{ items: OverflowMenuItem[]; ariaLabel: string }> = (props) => {
  const [open, setOpen] = createSignal(false);
  let containerRef: HTMLDivElement | undefined;

  const onDocClick = (e: MouseEvent) => {
    if (!containerRef) return;
    if (!containerRef.contains(e.target as Node)) setOpen(false);
  };

  onMount(() => document.addEventListener("mousedown", onDocClick));
  onCleanup(() => document.removeEventListener("mousedown", onDocClick));

  return (
    <div class="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open())}
        aria-label={props.ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open()}
        class="p-2 rounded-ds-md text-mid hover:text-high hover:bg-ink-700 transition-colors duration-ds-xs focus-ring-gold"
      >
        <MoreHorizontal size={20} aria-hidden="true" />
      </button>
      <Show when={open()}>
        <div
          role="menu"
          class="absolute right-0 mt-2 min-w-[180px] rounded-ds-lg border border-white/10 bg-ink-800 shadow-modal py-1 z-50"
        >
          <For each={props.items}>
            {(item) => (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                class="w-full flex items-center gap-2 px-3 py-2 text-ds-small text-high hover:bg-ink-700 focus-ring-gold"
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default OverflowMenu;
