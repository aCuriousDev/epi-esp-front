import { Component, createSignal, onCleanup, onMount } from "solid-js";
import { BookOpen } from "lucide-solid";
import { useLocation } from "@solidjs/router";
import RulesModal from "./RulesModal";
import { t } from "../../i18n";

export const TopBarHelpButton: Component = () => {
  const [open, setOpen] = createSignal(false);
  const location = useLocation();

  const handle = () => {
    if (location.pathname === "/rules") return;
    setOpen(true);
  };

  onMount(() => {
    const openHandler = () => setOpen(true);
    document.addEventListener("dnd:open-rules-modal", openHandler);
    onCleanup(() => document.removeEventListener("dnd:open-rules-modal", openHandler));
  });

  return (
    <>
      <button
        type="button"
        onClick={handle}
        aria-label={t("topbar.help")}
        class="p-2 rounded-ds-md text-mid hover:text-high hover:bg-ink-700 transition-colors duration-ds-xs focus-ring-gold"
      >
        <BookOpen size={20} aria-hidden="true" />
      </button>
      <RulesModal isOpen={open()} onClose={() => setOpen(false)} />
    </>
  );
};

export default TopBarHelpButton;
