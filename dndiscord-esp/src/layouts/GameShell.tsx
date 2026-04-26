import { Component, Show } from "solid-js";
import type { RouteSectionProps } from "@solidjs/router";
import { ChevronLeft } from "lucide-solid";
import { useNavigate } from "@solidjs/router";
import { ProtectedRoute } from "../components/auth";
import { PageMetaProvider } from "./PageMeta";
import TopBarHelpButton from "../components/common/TopBarHelpButton";
import { useDiscordLayoutMode } from "../hooks/useDiscordLayoutMode";
import { t } from "../i18n";

function safeBack(navigate: ReturnType<typeof useNavigate>) {
  if (typeof window !== "undefined" && window.history.length > 1) {
    navigate(-1);
  } else {
    navigate("/", { replace: true });
  }
}

export const GameShell: Component<RouteSectionProps> = (props) => {
  const navigate = useNavigate();
  const layout = useDiscordLayoutMode();
  const isPip = () => layout() === "pip";

  return (
    <ProtectedRoute fallbackPath="/login">
      <PageMetaProvider>
        <div class="relative w-full h-[100dvh] overflow-hidden bg-ink-950 text-high">
          {props.children}

          <Show when={!isPip()}>
            <button
              type="button"
              onClick={() => safeBack(navigate)}
              aria-label={t("game.exit")}
              class="absolute top-3 left-3 z-50 px-3 py-2 rounded-ds-md
                     bg-ink-800/80 border border-white/10 backdrop-blur
                     text-high hover:bg-ink-700 transition-colors duration-ds-xs focus-ring-gold
                     flex items-center gap-1"
              style={{ "margin-top": "env(safe-area-inset-top, 0px)" }}
            >
              <ChevronLeft size={18} aria-hidden="true" />
              <span class="hidden sm:inline text-ds-small">{t("game.exit")}</span>
            </button>

            <div
              class="absolute top-3 right-3 z-50"
              style={{ "margin-top": "env(safe-area-inset-top, 0px)" }}
            >
              <div class="bg-ink-800/80 border border-white/10 rounded-ds-md backdrop-blur">
                <TopBarHelpButton />
              </div>
            </div>
          </Show>
        </div>
      </PageMetaProvider>
    </ProtectedRoute>
  );
};

export default GameShell;
