import { Component, JSX, splitProps, mergeProps } from "solid-js";
import { A } from "@solidjs/router";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface BaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  leadingIcon?: JSX.Element;
  trailingIcon?: JSX.Element;
  children: JSX.Element;
  class?: string;
}

type ButtonAsButton = BaseProps &
  Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "children" | "class"> & {
    href?: undefined;
  };

type ButtonAsLink = BaseProps & {
  href: string;
  onClick?: never;
  type?: never;
  disabled?: boolean;
};

export type ButtonProps = ButtonAsButton | ButtonAsLink;

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-gradient text-high border border-transparent hover:border-white/20 shadow-soft hover:shadow-lift",
  secondary:
    "bg-ink-700 text-high border border-ink-500 hover:border-plum-500 hover:bg-ink-600",
  ghost:
    "bg-transparent text-mid border border-transparent hover:bg-ink-800 hover:text-high",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-ds-small rounded-ds-md",
  md: "px-5 py-3 text-ds-body rounded-ds-md",
  lg: "px-6 py-3.5 text-ds-lead rounded-ds-md",
};

const baseClasses =
  "inline-flex items-center justify-center gap-2 font-display font-semibold tracking-wide " +
  "transition-all duration-ds-sm ease-grimoire " +
  "focus-ring-gold disabled:opacity-40 disabled:cursor-not-allowed " +
  "select-none whitespace-nowrap";

export const Button: Component<ButtonProps> = (rawProps) => {
  const props = mergeProps(
    { variant: "primary" as ButtonVariant, size: "md" as ButtonSize, fullWidth: false },
    rawProps,
  );

  const [local, rest] = splitProps(props as ButtonAsButton, [
    "variant",
    "size",
    "fullWidth",
    "leadingIcon",
    "trailingIcon",
    "children",
    "class",
    "href",
  ]);

  const className = () =>
    [
      baseClasses,
      variantClasses[local.variant!],
      sizeClasses[local.size!],
      local.fullWidth ? "w-full" : "",
      local.class ?? "",
    ]
      .filter(Boolean)
      .join(" ");

  if (local.href) {
    return (
      <A href={local.href} class={className()}>
        {local.leadingIcon}
        {local.children}
        {local.trailingIcon}
      </A>
    );
  }

  return (
    <button class={className()} {...rest}>
      {local.leadingIcon}
      {local.children}
      {local.trailingIcon}
    </button>
  );
};

export default Button;
