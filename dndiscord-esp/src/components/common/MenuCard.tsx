import { Component, JSX, Show } from "solid-js";
import { A } from "@solidjs/router";

interface MenuCardProps {
  href: string;
  icon?: JSX.Element;
  title: string;
  subtitle?: string;
  badge?: string | number;
  tone?: "primary" | "ghost";
  class?: string;
}

export const MenuCard: Component<MenuCardProps> = (props) => {
  const tone = () => props.tone ?? "primary";

  return (
    <A
      href={props.href}
      class={
        "menu-card " +
        (tone() === "ghost" ? "menu-card-ghost " : "") +
        "!min-h-[120px] !p-4 flex flex-col items-stretch text-left focus-ring-gold " +
        (props.class ?? "")
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
        <span class="bg-plum-700/20 border border-gold-400/15 rounded-ds-md w-10 h-10 flex items-center justify-center text-gold-300">
          {props.icon}
        </span>
      </Show>

      <span class="mt-3 font-display text-ds-h3 text-high tracking-wide">
        {props.title}
      </span>

      <Show when={props.subtitle}>
        <span class="mt-1 text-ds-micro text-gold-300/70 tracking-wide">{props.subtitle}</span>
      </Show>
    </A>
  );
};

export default MenuCard;
