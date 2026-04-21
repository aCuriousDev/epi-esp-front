import { useNavigate } from "@solidjs/router";
import { ArrowLeft, Check, Cookie, Sliders } from "lucide-solid";
import { createSignal, For, onMount, Show, type JSX } from "solid-js";
import { consentStore } from "../stores/consent.store";
import { LEGAL_ORG as ORG } from "../config/legal";

type StorageItem = { name: string; purpose: string; duration: string };

type StorageSection = {
  key: string;
  title: string;
  summary: string;
  status: "essentiel" | "preference";
  items: StorageItem[];
};

const SECTIONS: StorageSection[] = [
  {
    key: "auth",
    title: "Authentification",
    summary:
      "Indispensable pour vous garder connecté·e après votre authentification Discord. Exempté de consentement (CNIL — traceurs d'authentification).",
    status: "essentiel",
    items: [
      {
        name: "token",
        purpose: "Jeton JWT signé par nos serveurs pour maintenir votre session.",
        duration: "7 jours (renouvelé à chaque connexion).",
      },
    ],
  },
  {
    key: "session",
    title: "Session multijoueur",
    summary:
      "Permet de retrouver une partie en cours après un rafraîchissement. Effacé à la fermeture de l'onglet.",
    status: "essentiel",
    items: [
      {
        name: "dndiscord_session",
        purpose:
          "Identifiant de la session multijoueur active et de l'utilisateur du hub.",
        duration: "Jusqu'à fermeture de l'onglet (sessionStorage).",
      },
      {
        name: "dndiscord_game_started",
        purpose: "Payload de la partie en cours, survit au refresh.",
        duration: "Jusqu'à fermeture de l'onglet (sessionStorage).",
      },
    ],
  },
  {
    key: "content",
    title: "Contenu utilisateur mis en cache",
    summary:
      "Cache local des personnages et cartes que vous créez, pour accélérer leur affichage. Donnée strictement fonctionnelle.",
    status: "essentiel",
    items: [
      {
        name: "dndiscord_characters",
        purpose: "Liste de vos personnages mise en cache.",
        duration: "Jusqu'à suppression manuelle ou du compte.",
      },
      {
        name: "dndiscord_maps_*",
        purpose: "Cartes de jeu que vous avez créées.",
        duration: "Jusqu'à suppression manuelle.",
      },
      {
        name: "dndiscord_dungeons_*",
        purpose: "Donjons que vous avez dessinés dans l'éditeur.",
        duration: "Jusqu'à suppression manuelle.",
      },
    ],
  },
  {
    key: "preferences",
    title: "Préférences d'interface",
    summary:
      "Mémorisent vos réglages (graphismes, son, tutoriel). Exemptés de consentement au titre de la personnalisation d'interface (CNIL), vous pouvez les effacer à tout moment depuis « Paramétrer ».",
    status: "preference",
    items: [
      {
        name: "dnd-graphics-settings",
        purpose:
          "Qualité 3D, résolution d'ombres, effets visuels, mise à l'échelle.",
        duration: "Jusqu'à effacement manuel.",
      },
      {
        name: "dnd-sound-settings",
        purpose: "Volume et état musique / effets.",
        duration: "Jusqu'à effacement manuel.",
      },
      {
        name: "dndiscord_tutorial_completed",
        purpose: "Mémorise que vous avez vu le tutoriel d'onboarding.",
        duration: "Jusqu'à effacement manuel.",
      },
      {
        name: "dndiscord_consent_v1",
        purpose: "Indique que vous avez pris connaissance de la présente politique.",
        duration: "Jusqu'à effacement manuel.",
      },
    ],
  },
];

export default function CookiesPolicy() {
  const navigate = useNavigate();
  onMount(() => document.getElementById("root")?.scrollTo(0, 0));

  const [cleared, setCleared] = createSignal(false);
  function handleClear() {
    consentStore.clearPreferenceStorage();
    setCleared(true);
    setTimeout(() => setCleared(false), 3000);
  }

  return (
    <div class="cookies-page min-h-screen w-full overflow-y-auto">
      <div class="fixed inset-0 overflow-hidden pointer-events-none">
        <div class="absolute top-1/4 -left-32 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-3xl" />
        <div class="absolute bottom-1/4 -right-32 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl" />
      </div>
      <div class="vignette fixed inset-0 pointer-events-none" />

      <header class="sticky top-0 z-30 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-game-dark/80 backdrop-blur-md">
        <button
          onClick={() => navigate(-1)}
          class="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
        >
          <ArrowLeft class="w-5 h-5" />
          <span class="hidden sm:inline">Retour</span>
        </button>
        <h1 class="font-display text-xl text-white tracking-wide flex items-center gap-2">
          <Cookie class="w-5 h-5 text-purple-400" />
          Politique cookies
        </h1>
        <div class="w-24" />
      </header>

      <main class="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-20 space-y-6">
        <Card title="En bref">
          <p>
            DnDiscord <strong>n'utilise aucun cookie HTTP</strong> et{" "}
            <strong>aucun traceur tiers</strong> (pas de Google Analytics,
            pas de Meta Pixel, pas de marketing, pas de publicité, pas de
            <em> fingerprinting</em>). Le service s'appuie exclusivement
            sur le <strong>stockage local</strong> de votre navigateur
            (<code class="px-1 py-0.5 bg-black/30 rounded text-xs">localStorage</code>{" "}
            et{" "}
            <code class="px-1 py-0.5 bg-black/30 rounded text-xs">sessionStorage</code>
            ) pour vous authentifier, sauvegarder vos préférences et
            mémoriser votre session multijoueur.
          </p>
          <p>
            Toutes les catégories utilisées relèvent de cas{" "}
            <strong>exemptés de consentement</strong> au sens de la CNIL
            (authentification, personnalisation d'interface, contenu
            fonctionnel). Vous pouvez néanmoins consulter le détail
            ci-dessous et vider à tout moment vos préférences locales.
          </p>
          <div class="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => consentStore.openPreferences()}
              class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm transition-colors"
            >
              <Sliders class="w-4 h-4" />
              Paramétrer mon stockage local
            </button>
            <button
              onClick={handleClear}
              disabled={cleared()}
              class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-sm transition-colors disabled:opacity-60"
            >
              <Show when={cleared()} fallback={<>Effacer mes préférences locales</>}>
                <Check class="w-4 h-4 text-green-400" />
                <span class="text-green-300">Préférences effacées</span>
              </Show>
            </button>
          </div>
        </Card>

        <Card title="1. Cadre légal">
          <p>
            Cette politique est établie conformément à :
          </p>
          <ul class="list-disc list-inside space-y-1 text-sm">
            <li>
              la <strong>Directive ePrivacy</strong> 2002/58/CE modifiée ;
            </li>
            <li>
              l'article <strong>82 de la loi n° 78-17</strong> « Informatique
              et Libertés » (stockage et accès à des informations sur
              l'équipement terminal de l'utilisateur) ;
            </li>
            <li>
              la <strong>Recommandation cookies</strong> de la CNIL
              (délibération n° 2020-092 mise à jour) ;
            </li>
            <li>
              le <strong>RGPD</strong> (règlement UE 2016/679) pour le
              traitement des données personnelles éventuellement associées.
            </li>
          </ul>
        </Card>

        <Card title="2. Traceurs exemptés de consentement">
          <p>
            La CNIL considère exemptés de consentement les traceurs dont la
            finalité exclusive est strictement nécessaire au service
            demandé par l'utilisateur, notamment :
          </p>
          <ul class="list-disc list-inside space-y-1 text-sm">
            <li>authentification auprès du service ;</li>
            <li>
              personnalisation d'interface (langue, thème, préférences
              graphiques) ;
            </li>
            <li>
              équilibrage de charge et sécurité (protection contre les
              abus).
            </li>
          </ul>
          <p>
            Tous les éléments de stockage utilisés par DnDiscord relèvent
            de ces catégories. Aucun consentement préalable n'est donc
            juridiquement requis.
          </p>
        </Card>

        <For each={SECTIONS}>
          {(section, idx) => (
            <Card title={`${idx() + 3}. ${section.title}`}>
              <p class="text-sm">{section.summary}</p>
              <StorageTable items={section.items} />
            </Card>
          )}
        </For>

        <Card title={`${SECTIONS.length + 3}. Ce que nous ne faisons pas`}>
          <ul class="list-disc list-inside space-y-1 text-sm">
            <li>Aucun cookie HTTP n'est déposé par le service.</li>
            <li>
              Aucun traceur publicitaire, aucun traceur cross-site, aucune
              empreinte numérique (fingerprinting).
            </li>
            <li>
              Aucun outil d'analyse tiers (Google Analytics, Meta Pixel,
              Hotjar, TikTok Pixel, etc.).
            </li>
            <li>Aucune revente ou location de données à un tiers.</li>
          </ul>
        </Card>

        <Card title={`${SECTIONS.length + 4}. Gestion et exercice des droits`}>
          <p>
            Vous pouvez à tout moment :
          </p>
          <ul class="list-disc list-inside space-y-1 text-sm">
            <li>
              <strong>consulter</strong> la liste complète des éléments de
              stockage via le bouton « Paramétrer mon stockage local » en
              haut de cette page ;
            </li>
            <li>
              <strong>effacer vos préférences locales</strong> via le
              bouton dédié ou depuis l'onglet « Confidentialité & données »
              des paramètres ;
            </li>
            <li>
              <strong>supprimer l'ensemble de vos données</strong> (compte,
              personnages, campagnes…) en demandant l'effacement de votre
              compte (RGPD art. 17) depuis les paramètres.
            </li>
          </ul>
          <p>
            Vous conservez par ailleurs la maîtrise complète du stockage
            local depuis les paramètres de votre navigateur (section
            « Cookies et données de site »).
          </p>
        </Card>

        <Card title={`${SECTIONS.length + 5}. Évolution de la politique`}>
          <p>
            Si DnDiscord venait à intégrer à l'avenir un traceur soumis à
            consentement (par exemple un outil d'analyse tiers), la
            présente politique serait mise à jour et un{" "}
            <strong>mécanisme de consentement explicite</strong> conforme à
            la Recommandation CNIL serait mis en place avant toute
            activation (bannière avec boutons « Accepter » et « Refuser »
            d'égale simplicité).
          </p>
        </Card>

        <Card title={`${SECTIONS.length + 6}. Contact`}>
          <p>
            Toute question relative à la présente politique peut être
            adressée à {ORG.name} :
          </p>
          <ul class="text-sm space-y-1">
            <li>
              Contact RGPD :{" "}
              <a
                href={`mailto:${ORG.privacyEmail}`}
                class="text-purple-300 underline"
              >
                {ORG.privacyEmail}
              </a>
            </li>
            <li>
              Délégué à la protection des données :{" "}
              <a
                href={`mailto:${ORG.dpoEmail}`}
                class="text-purple-300 underline"
              >
                {ORG.dpoEmail}
              </a>
            </li>
          </ul>
        </Card>

        <nav class="flex flex-wrap items-center gap-x-3 gap-y-2 pt-6 text-sm text-slate-400">
          <a href="/privacy" class="text-purple-300 hover:text-purple-200 underline underline-offset-2">
            Politique de confidentialité
          </a>
          <span class="text-slate-600">·</span>
          <a href="/terms" class="text-purple-300 hover:text-purple-200 underline underline-offset-2">
            Conditions générales
          </a>
          <span class="text-slate-600">·</span>
          <a href="/legal" class="text-purple-300 hover:text-purple-200 underline underline-offset-2">
            Mentions légales
          </a>
        </nav>
        <p class="pt-2 text-xs text-slate-500">
          En vigueur depuis le {ORG.lastUpdated}.
        </p>
      </main>

      <style jsx>{`
        .cookies-page {
          background: linear-gradient(
            135deg,
            var(--ink-700) 0%,
            var(--ink-800) 50%,
            var(--ink-900) 100%
          );
        }
      `}</style>
    </div>
  );
}

function Card(props: { title: string; children: JSX.Element }) {
  return (
    <section class="bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-3">
      <h2 class="font-display text-lg text-white">{props.title}</h2>
      <div class="text-slate-300 text-sm leading-relaxed space-y-3">
        {props.children}
      </div>
    </section>
  );
}

function StorageTable(props: { items: StorageItem[] }) {
  return (
    <div class="overflow-x-auto">
      <table class="w-full text-xs sm:text-sm">
        <thead>
          <tr class="text-left border-b border-white/10 text-slate-400">
            <th class="py-2 pr-3 font-medium">Clé</th>
            <th class="py-2 pr-3 font-medium">Finalité</th>
            <th class="py-2 pr-3 font-medium">Durée</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-white/5">
          <For each={props.items}>
            {(item) => (
              <tr class="align-top">
                <td class="py-2 pr-3">
                  <code class="text-purple-200 bg-black/30 px-2 py-0.5 rounded font-mono">
                    {item.name}
                  </code>
                </td>
                <td class="py-2 pr-3 text-slate-300">{item.purpose}</td>
                <td class="py-2 pr-3 text-slate-300">{item.duration}</td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}
