import { Show, For } from "solid-js";
import { Portal } from "solid-js/web";
import { Cookie, Shield, Sliders, X } from "lucide-solid";
import { consentStore } from "../stores/consent.store";

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
      "Nécessaires au fonctionnement du service (authentification, session multijoueur, contenu que vous créez). Ils ne peuvent pas être désactivés.",
    essential: true,
    items: [
      {
        name: "token (JWT)",
        purpose:
          "Maintient votre session Discord connectée. Durée : 7 jours.",
      },
      {
        name: "dndiscord_session / dndiscord_game_started",
        purpose:
          "Mémorise la partie multijoueur en cours. Effacé à la fermeture de l'onglet.",
      },
      {
        name: "dndiscord_characters / dndiscord_maps_* / dndiscord_dungeons_*",
        purpose:
          "Cache local des personnages et cartes que vous créez pour accélérer le chargement.",
      },
    ],
  },
  {
    key: "preferences",
    title: "Préférences",
    description:
      "Mémorisent vos réglages d'interface (graphismes, son, tutoriel). Au sens CNIL ils sont exemptés de consentement, mais vous pouvez les effacer à tout moment.",
    essential: false,
    items: [
      {
        name: "dnd-graphics-settings",
        purpose:
          "Qualité 3D, résolution d'ombres, effets visuels, mise à l'échelle.",
      },
      { name: "dnd-sound-settings", purpose: "Volume et état musique / effets." },
      {
        name: "dndiscord_tutorial_completed",
        purpose: "Mémorise que vous avez vu le tutoriel d'onboarding.",
      },
    ],
  },
];

export default function CookieConsent() {
  return (
    <>
      <Show when={consentStore.bannerOpen()}>
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
              Stockage local & confidentialité
            </h2>
            <p
              id="cookie-consent-desc"
              class="text-slate-300/90 text-sm leading-relaxed"
            >
              DnDiscord utilise uniquement le <strong>stockage local</strong> de
              votre navigateur pour vous authentifier via Discord et mémoriser
              vos préférences de jeu. Aucun traceur publicitaire ni outil
              d'analyse tiers.{" "}
              <a
                href="/privacy"
                class="text-purple-300 hover:text-purple-200 underline underline-offset-2"
              >
                En savoir plus
              </a>
              .
            </p>

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
                Paramétrer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreferencesModal() {
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
        aria-label="Paramétrage du stockage local"
        class="relative w-full max-w-2xl bg-game-dark border border-white/10 rounded-2xl shadow-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div class="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-white/10">
          <h2 class="font-display text-lg sm:text-xl text-white flex items-center gap-2">
            <Shield class="w-5 h-5 text-purple-400" />
            Stockage local — détails
          </h2>
          <button
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
            Voici la liste complète des éléments que DnDiscord enregistre dans
            le stockage local de votre navigateur. Tous relèvent de catégories
            que la CNIL considère comme exemptées de consentement. Vous pouvez
            néanmoins vider les <strong>préférences</strong> à tout moment.
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
              <li>Aucune revente de données à des partenaires commerciaux.</li>
            </ul>
          </section>
        </div>

        {/* Footer */}
        <div class="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 px-5 sm:px-6 py-4 border-t border-white/10 bg-black/20">
          <button
            onClick={handleClearPreferences}
            class="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-sm transition-colors"
          >
            Effacer mes préférences locales
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
