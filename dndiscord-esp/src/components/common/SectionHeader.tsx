import { Component, Show } from "solid-js";

interface SectionHeaderProps {
  eyebrow: string;
  counter?: string;
  id?: string;
}

export const SectionHeader: Component<SectionHeaderProps> = (props) => {
  return (
    <header class="flex items-center gap-3 mb-4">
      <h2
        id={props.id}
        class="font-display text-ds-micro tracking-[0.2em] uppercase text-gold-300"
      >
        {props.eyebrow}
      </h2>
      <div class="flex-1 h-px bg-gradient-to-r from-gold-400/30 via-gold-400/15 to-transparent" />
      <Show when={props.counter}>
        <span class="font-mono text-[11px] text-low tracking-[0.1em]">
          {props.counter}
        </span>
      </Show>
    </header>
  );
};

export default SectionHeader;
