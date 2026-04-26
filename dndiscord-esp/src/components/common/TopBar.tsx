import { Component, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { ChevronLeft, Settings as SettingsIcon, BookOpen } from "lucide-solid";
import { A, useLocation, useNavigate } from "@solidjs/router";
import { UserMenu } from "../auth";
import OverflowMenu from "./OverflowMenu";
import TopBarHelpButton from "./TopBarHelpButton";
import { usePageMeta } from "../../layouts/PageMeta";
import { t } from "../../i18n";

function safeBack(navigate: ReturnType<typeof useNavigate>) {
  if (typeof window !== "undefined" && window.history.length > 1) {
    navigate(-1);
  } else {
    navigate("/", { replace: true });
  }
}

function useViewportWidth(): () => number {
  const [w, setW] = createSignal(typeof window !== "undefined" ? window.innerWidth : 1024);
  let raf: number | null = null;
  const handler = () => {
    if (raf !== null) return;
    raf = requestAnimationFrame(() => {
      raf = null;
      setW(window.innerWidth);
    });
  };
  onMount(() => window.addEventListener("resize", handler));
  onCleanup(() => {
    window.removeEventListener("resize", handler);
    if (raf !== null) cancelAnimationFrame(raf);
  });
  return w;
}

export const TopBar: Component = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { meta } = usePageMeta();
  const width = useViewportWidth();

  const showBack = createMemo(() => {
    if (meta().hideBackButton) return false;
    return location.pathname !== "/";
  });
  const showTitle = createMemo(() => width() >= 360);
  const collapseIcons = createMemo(() => width() < 400);

  return (
    <header
      class="sticky top-0 z-40 w-full bg-ink-900/85 backdrop-blur border-b border-white/10"
      style={{ "padding-top": "max(0.5rem, env(safe-area-inset-top))" }}
    >
      <div class="mx-auto max-w-[1280px] flex items-center gap-2 px-3 sm:px-4 lg:px-6 h-12 sm:h-14">
        <Show when={showBack()} fallback={<div class="w-10" aria-hidden="true" />}>
          <button
            type="button"
            onClick={() => safeBack(navigate)}
            aria-label={t("topbar.back")}
            class="p-2 rounded-ds-md text-mid hover:text-high hover:bg-ink-700 transition-colors duration-ds-xs focus-ring-gold"
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
        </Show>

        <Show when={showTitle()} fallback={<div class="flex-1" />}>
          <h1 class="flex-1 text-center font-display text-ds-h3 text-high tracking-wide truncate">
            {meta().title}
          </h1>
        </Show>

        <div class="flex items-center gap-1">
          <Show when={meta().rightSlot}>
            <div class="mr-1">{meta().rightSlot}</div>
          </Show>

          <Show
            when={!collapseIcons()}
            fallback={
              <OverflowMenu
                ariaLabel={t("topbar.help") + " / " + t("topbar.settings")}
                items={[
                  {
                    label: t("topbar.help"),
                    icon: <BookOpen size={16} />,
                    onClick: () => {
                      document.dispatchEvent(new CustomEvent("dnd:open-rules-modal"));
                    },
                  },
                  {
                    label: t("topbar.settings"),
                    icon: <SettingsIcon size={16} />,
                    onClick: () => navigate("/settings"),
                  },
                ]}
              />
            }
          >
            <TopBarHelpButton />
            <A
              href="/settings"
              aria-label={t("topbar.settings")}
              class="p-2 rounded-ds-md text-mid hover:text-high hover:bg-ink-700 transition-colors duration-ds-xs focus-ring-gold"
            >
              <SettingsIcon size={20} aria-hidden="true" />
            </A>
          </Show>

          <UserMenu />
        </div>
      </div>
    </header>
  );
};

export default TopBar;
