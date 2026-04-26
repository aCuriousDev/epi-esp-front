import { Show, For, createMemo } from "solid-js";
import { Portal } from "solid-js/web";
import { A, useLocation } from "@solidjs/router";
import { Cookie, Shield, Sliders, X } from "lucide-solid";
import { consentStore } from "../stores/consent.store";
import { useEscapeToClose } from "../hooks/useModalAccessibility";

// Routes sur lesquelles la bannière n'a pas lieu d'être (l'utilisateur
// est par définition déjà en train de consulter la divulgation complète).
const LEGAL_PATHS = ["/privacy", "/terms", "/legal", "/cookies"];

/**
 * Bannière d'information RGPD.
 *
 * DnDiscord n'utilise que du stockage local exempté de consentement
 * (authentification + préférences d'interface, au sens CNIL). La bannière
 * est donc informative : on liste ce qui est stocké, l'utilisateur peut
 * consulter la politique de confidentialité, vider ses préférences locales,
 * et acquitter avec « J'ai compris ».
 */

type StorageCategory = {
  key: string;
  title: string;
  description: string;
  essential: boolean;
  items: { name: string; purpose: string }[];
};

const CATEGORIES: StorageCategory[] = [
  {
    key: "essential",
    title: "Essentiels",
    description:
      "Required for the service to work (authentication, multiplayer session, content you create). They cannot be disabled.",
    essential: true,
    items: [
      {
        name: "token (JWT)",
        purpose:
          "Keeps your Discord session connected. Duration: 7 days.",
      },
      {
        name: "dndiscord_session / dndiscord_game_started",
        purpose:
          "Stores the current multiplayer game. Cleared when the tab is closed.",
      },
      {
        name: "dndiscord_characters / dndiscord_maps_* / dndiscord_dungeons_*",
        purpose:
          "Local cache of characters and maps you create to speed up loading.",
      },
    ],
  },
  {
    key: "preferences",
    title: "Preferences",
    description:
      "Store your interface settings (graphics, sound, tutorial). They are exempt from consent under GDPR, but you can clear them at any time.",
    essential: false,
    items: [
      {
        name: "dnd-graphics-settings",
        purpose:
          "3D quality, shadow resolution, visual effects, scaling.",
      },
      { name: "dnd-sound-settings", purpose: "Volume and music/effects state." },
      {
        name: "dndiscord_tutorial_completed",
        purpose: "Stores that you have seen the onboarding tutorial.",
      },
    ],
  },
];

export default function CookieConsent() {
  const location = useLocation();
  // On masque la bannière sur les pages légales : l'utilisateur est
  // manifestement déjà informé puisqu'il y navigue, et l'overlay bottom
  // occulte une partie de la page de divulgation sur mobile.
  const shouldShowBanner = createMemo(
    () =>
      consentStore.bannerOpen() &&
      !LEGAL_PATHS.some((p) => location.pathname.startsWith(p)),
  );

  return (
    <>
      <Show when={shouldShowBanner()}>
        <Portal>
          <ConsentBanner />
        </Portal>
      </Show>
      <Show when={consentStore.preferencesOpen()}>
        <Portal>
          <PreferencesModal />
        </Portal>
      </Show>
    </>
  );
}

function ConsentBanner() {
  return (
    <div
      role="dialog"
      aria-label="Information sur le stockage local"
      aria-describedby="cookie-consent-desc"
      class="cookie-banner fixed inset-x-0 bottom-0 z-[60] p-3 sm:p-4"
    >
      <div class="mx-auto max-w-4xl bg-game-dark/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/40 p-5 sm:p-6">
        <div class="flex items-start gap-4">
          <div class="hidden sm:flex w-12 h-12 rounded-xl bg-purple-500/15 text-purple-300 items-center justify-center shrink-0">
            <Cookie class="w-6 h-6" />
          </div>

          <div class="flex-1 min-w-0">
            <h2 class="font-display text-lg text-white mb-1 flex items-center gap-2">
              <Cookie class="w-5 h-5 text-purple-300 sm:hidden" />
              Local storage & privacy
            </h2>
            <p
              id="cookie-consent-desc"
              class="text-slate-300/90 text-sm leading-relaxed"
            >
              DnDiscord utilise uniquement le <strong>stockage local</strong> de
              your browser to authenticate via Discord and store
              your game preferences. No advertising tracker or analytics tool
              d'analyse tiers.{" "}
              <A
                href="/privacy"
                class="text-purple-300 hover:text-purple-200 underline underline-offset-2"
              >
                En savoir plus
              </A>
              .
            </p>

            <Show when={consentStore.storageUnavailable()}>
              <p class="mt-3 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                ⚠ Your browser's local storage is unavailable
                (private Safari browsing or restricted iframe quota). Your
                acknowledgement will not be stored and the banner may
                reappear on each visit.
              </p>
            </Show>

            <div class="mt-4 flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={() => consentStore.acknowledge()}
                class="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm transition-colors"
              >
                J'ai compris
              </button>
              <button
                onClick={() => consentStore.openPreferences()}
                class="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-sm transition-colors flex items-center justify-center gap-2"
              >
                <Sliders class="w-4 h-4" />
                Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreferencesModal() {
  useEscapeToClose(consentStore.preferencesOpen, consentStore.closePreferences);
  let closeBtn: HTMLButtonElement | undefined;
  // Autofocus sur le bouton de fermeture au montage pour que Tab / Enter
  // / ESC fonctionnent directement sans click préalable.
  queueMicrotask(() => closeBtn?.focus());

  function handleClearPreferences() {
    consentStore.clearPreferenceStorage();
  }

  return (
    <div
      class="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm"
      onClick={() => consentStore.closePreferences()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Local storage settings"
        class="relative w-full max-w-2xl bg-game-dark border border-white/10 rounded-2xl shadow-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div class="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-white/10">
          <h2 class="font-display text-lg sm:text-xl text-white flex items-center gap-2">
            <Shield class="w-5 h-5 text-purple-400" />
            Local storage — details
          </h2>
          <button
            ref={closeBtn}
            onClick={() => consentStore.closePreferences()}
            class="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            aria-label="Fermer"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div class="overflow-y-auto px-5 sm:px-6 py-5 space-y-5 text-sm">
          <p class="text-slate-300/90 leading-relaxed">
            Here is the complete list of items that DnDiscord stores in
            your browser's local storage. All fall under categories
            that the GDPR considers exempt from consent. You can
            nevertheless clear the <strong>preferences</strong> at any time.
          </p>

          <For each={CATEGORIES}>
            {(cat) => (
              <section class="bg-white/5 border border-white/10 rounded-xl p-4">
                <header class="flex items-center justify-between gap-3 mb-2">
                  <h3 class="font-display text-white text-base">{cat.title}</h3>
                  <Show
                    when={cat.essential}
                    fallback={
                      <span class="px-2 py-0.5 rounded-full text-[11px] bg-slate-500/20 text-slate-300">
                        Optionnels
                      </span>
                    }
                  >
                    <span class="px-2 py-0.5 rounded-full text-[11px] bg-purple-500/20 text-purple-200">
                      Toujours actifs
                    </span>
                  </Show>
                </header>
                <p class="text-slate-400 text-xs mb-3 leading-relaxed">
                  {cat.description}
                </p>
                <ul class="space-y-2">
                  <For each={cat.items}>
                    {(item) => (
                      <li class="flex flex-col sm:flex-row gap-1 sm:gap-3 text-xs">
                        <code class="sm:min-w-[200px] text-purple-200 bg-black/30 px-2 py-0.5 rounded font-mono">
                          {item.name}
                        </code>
                        <span class="text-slate-300">{item.purpose}</span>
                      </li>
                    )}
                  </For>
                </ul>
              </section>
            )}
          </For>

          <section class="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
            <h3 class="text-amber-200 font-medium text-sm mb-1">
              Ce que nous ne faisons pas
            </h3>
            <ul class="list-disc list-inside text-slate-300 text-xs space-y-1">
              <li>Aucun cookie publicitaire, aucun traceur cross-site.</li>
              <li>
                Aucun outil d'analyse tiers (Google Analytics, Meta Pixel, etc.).
              </li>
              <li>No resale of data to commercial partners.</li>
            </ul>
          </section>
        </div>

        {/* Footer */}
        <div class="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 px-5 sm:px-6 py-4 border-t border-white/10 bg-black/20">
          <button
            onClick={handleClearPreferences}
            class="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-sm transition-colors"
          >
            Clear my local preferences
          </button>
          <button
            onClick={() => consentStore.acknowledge()}
            class="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm transition-colors"
          >
            J'ai compris
          </button>
        </div>
      </div>
    </div>
  );
}
