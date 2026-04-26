import { Component, JSX, Show } from "solid-js";
import { A } from "@solidjs/router";

interface MenuCardProps {
  href: string;
  icon?: JSX.Element;
  title: string;
  subtitle?: string;
  badge?: string | number;
  tone?: "primary" | "ghost";
}

const toneClasses = {
  primary:
    "bg-ink-800 hover:bg-ink-700 border-white/10 hover:border-plum-500 shadow-soft hover:shadow-lift",
  ghost:
    "bg-transparent hover:bg-ink-800 border-dashed border-white/15 hover:border-plum-300",
};

export const MenuCard: Component<MenuCardProps> = (props) => {
  const tone = () => props.tone ?? "primary";

  return (
    <A
      href={props.href}
      class={
        "group relative flex flex-col items-center justify-center gap-2 " +
        "min-h-[120px] p-4 rounded-ds-lg border " +
        "transition-all duration-ds-sm ease-grimoire " +
        "focus-ring-gold text-center " +
        toneClasses[tone()]
      }
    >
      <Show when={props.badge !== undefined && props.badge !== ""}>
        <span
          class={
            "absolute top-2 right-2 px-2 py-0.5 rounded-full " +
            "text-ds-micro font-display text-high bg-plum-700/80 border border-white/15"
          }
        >
          {props.badge}
        </span>
      </Show>

      <Show when={props.icon}>
        <span class="text-gold-300 transition-transform duration-ds-sm group-hover:-translate-y-0.5">
          {props.icon}
        </span>
      </Show>

      <span class="font-display font-semibold text-ds-h3 text-high tracking-wide">
        {props.title}
      </span>

      <Show when={props.subtitle}>
        <span class="text-ds-small text-mid">{props.subtitle}</span>
      </Show>
    </A>
  );
};

export default MenuCard;
