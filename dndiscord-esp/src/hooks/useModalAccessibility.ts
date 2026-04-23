import { createEffect, onCleanup } from "solid-js";

/**
 * A11y helper pour les modals : ajoute la fermeture par ESC tant que
 * le modal est ouvert. Pas de focus trap complet (lib tierce si besoin),
 * mais couvre le cas le plus fréquent d'accessibilité clavier.
 */
export function useEscapeToClose(isOpen: () => boolean, onClose: () => void) {
  createEffect(() => {
    if (!isOpen()) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    onCleanup(() => document.removeEventListener("keydown", handler));
  });
}
