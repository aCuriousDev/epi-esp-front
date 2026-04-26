import { Component, Show } from "solid-js";
import type { RouteSectionProps } from "@solidjs/router";
import { A } from "@solidjs/router";
import { ProtectedRoute } from "../components/auth";
import { PageMetaProvider } from "./PageMeta";
import TopBar from "../components/common/TopBar";
import CookieConsent from "../components/CookieConsent";
import SessionInviteListener from "../components/SessionInviteListener";
import TutorialOverlay from "../components/TutorialOverlay";
import { useDiscordLayoutMode } from "../hooks/useDiscordLayoutMode";

export const MenuShell: Component<RouteSectionProps> = (props) => {
  const layout = useDiscordLayoutMode();
  const isPip = () => layout() === "pip";

  return (
    <ProtectedRoute fallbackPath="/login">
      <PageMetaProvider>
        <SessionInviteListener />
        <TutorialOverlay />
        <CookieConsent />
        <div class="min-h-[100dvh] flex flex-col bg-ink-900 text-high">
          <Show when={!isPip()}>
            <TopBar />
          </Show>

          <main
            class="flex-1 w-full mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8 py-6"
            style={{
              "padding-left": "max(1rem, env(safe-area-inset-left))",
              "padding-right": "max(1rem, env(safe-area-inset-right))",
              "padding-bottom": "max(1.5rem, env(safe-area-inset-bottom))",
            }}
          >
            {props.children}
          </main>

          <Show when={!isPip()}>
            <Footer />
          </Show>
        </div>
      </PageMetaProvider>
    </ProtectedRoute>
  );
};

const Footer: Component = () => (
  <footer class="border-t border-white/10 py-3 px-4 text-center text-ds-micro text-low">
    <nav class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
      <A href="/privacy" class="hover:text-mid focus-ring-gold rounded">Privacy</A>
      <A href="/terms" class="hover:text-mid focus-ring-gold rounded">Terms</A>
      <A href="/legal" class="hover:text-mid focus-ring-gold rounded">Legal</A>
      <A href="/cookies" class="hover:text-mid focus-ring-gold rounded">Cookies</A>
      <span aria-hidden="true">·</span>
      <span>v{__APP_VERSION__}</span>
    </nav>
  </footer>
);

export default MenuShell;
