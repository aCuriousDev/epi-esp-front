import { A, useNavigate } from "@solidjs/router";
import { ArrowLeft, Check, Cookie, Sliders } from "lucide-solid";
import { createSignal, For, onMount, Show, type JSX } from "solid-js";
import { consentStore } from "../stores/consent.store";
import { LEGAL_ORG as ORG } from "../config/legal";

type StorageItem = { name: string; purpose: string; duration: string };

type StorageSection = {
  key: string;
  title: string;
  summary: string;
  status: "essential" | "preference";
  items: StorageItem[];
};

const SECTIONS: StorageSection[] = [
  {
    key: "auth",
    title: "Authentication",
    summary:
      "Required to keep you signed in after your Discord authentication. Exempt from consent (CNIL — authentication trackers).",
    status: "essential",
    items: [
      {
        name: "token",
        purpose: "JWT token signed by our servers to maintain your session.",
        duration: "7 days (renewed on each sign-in).",
      },
    ],
  },
  {
    key: "session",
    title: "Multiplayer session",
    summary:
      "Lets you resume an in-progress game after a refresh. Cleared when the tab is closed.",
    status: "essential",
    items: [
      {
        name: "dndiscord_session",
        purpose:
          "Identifier of the active multiplayer session and hub user.",
        duration: "Until tab close (sessionStorage).",
      },
      {
        name: "dndiscord_game_started",
        purpose: "Payload of the current game, survives refresh.",
        duration: "Until tab close (sessionStorage).",
      },
    ],
  },
  {
    key: "content",
    title: "Cached user content",
    summary:
      "Local cache of the characters and maps you create, to speed up display. Strictly functional data.",
    status: "essential",
    items: [
      {
        name: "dndiscord_characters",
        purpose: "Cached list of your characters.",
        duration: "Until manual deletion or account removal.",
      },
      {
        name: "dndiscord_maps_*",
        purpose: "Game maps you have created.",
        duration: "Until manual deletion.",
      },
      {
        name: "dndiscord_dungeons_*",
        purpose: "Dungeons you have drawn in the editor.",
        duration: "Until manual deletion.",
      },
    ],
  },
  {
    key: "preferences",
    title: "Interface preferences",
    summary:
      'Stores your settings (graphics, sound, tutorial). Exempt from consent under interface personalization (CNIL); you can clear them at any time from "Manage".',
    status: "preference",
    items: [
      {
        name: "dnd-graphics-settings",
        purpose:
          "3D quality, shadow resolution, visual effects, scaling.",
        duration: "Until manual deletion.",
      },
      {
        name: "dnd-sound-settings",
        purpose: "Volume and music/effects state.",
        duration: "Until manual deletion.",
      },
      {
        name: "dndiscord_tutorial_completed",
        purpose: "Remembers that you have seen the onboarding tutorial.",
        duration: "Until manual deletion.",
      },
      {
        name: "dndiscord_consent_v1",
        purpose: "Indicates that you have acknowledged this policy.",
        duration: "Until manual deletion.",
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
          <span class="hidden sm:inline">Back</span>
        </button>
        <h1 class="font-display text-xl text-white tracking-wide flex items-center gap-2">
          <Cookie class="w-5 h-5 text-purple-400" />
          Cookies policy
        </h1>
        <div class="w-24" />
      </header>

      <main class="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-20 space-y-6">
        <Card title="At a glance">
          <p>
            DnDiscord <strong>uses no HTTP cookies</strong> and{" "}
            <strong>no third-party trackers</strong> (no Google Analytics,
            no Meta Pixel, no marketing, no advertising, no
            <em> fingerprinting</em>). The service relies exclusively
            on your browser's <strong>local storage</strong>
            (<code class="px-1 py-0.5 bg-black/30 rounded text-xs">localStorage</code>{" "}
            and{" "}
            <code class="px-1 py-0.5 bg-black/30 rounded text-xs">sessionStorage</code>
            ) to authenticate you, save your preferences, and
            remember your multiplayer session.
          </p>
          <p>
            All categories used fall under cases{" "}
            <strong>exempt from consent</strong> as defined by the CNIL
            (authentication, interface personalization, functional
            content). You can nonetheless review the details
            below and clear your local preferences at any time.
          </p>
          <div class="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => consentStore.openPreferences()}
              class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm transition-colors"
            >
              <Sliders class="w-4 h-4" />
              Manage my local storage
            </button>
            <button
              onClick={handleClear}
              disabled={cleared()}
              class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-sm transition-colors disabled:opacity-60"
            >
              <Show when={cleared()} fallback={<>Clear my local preferences</>}>
                <Check class="w-4 h-4 text-green-400" />
                <span class="text-green-300">Preferences cleared</span>
              </Show>
            </button>
          </div>
        </Card>

        <Card title="1. Legal framework">
          <p>
            This policy is established in accordance with:
          </p>
          <ul class="list-disc list-inside space-y-1 text-sm">
            <li>
              the <strong>Directive ePrivacy</strong> 2002/58/CE as amended;
            </li>
            <li>
              <strong>art. 82 de la loi n° 78-17 « Informatique et Libertés »</strong>{" "}
              (storage and access to information on the user's terminal
              equipment);
            </li>
            <li>
              the <strong>Recommandation cookies de la CNIL (délibération n° 2020-092 mise à jour)</strong>;
            </li>
            <li>
              the <strong>RGPD</strong> (règlement UE 2016/679) for the
              processing of any associated personal data.
            </li>
          </ul>
        </Card>

        <Card title="2. Trackers exempt from consent">
          <p>
            The CNIL considers trackers exempt from consent when their
            sole purpose is strictly necessary for the service
            requested by the user, in particular:
          </p>
          <ul class="list-disc list-inside space-y-1 text-sm">
            <li>authentication with the service;</li>
            <li>
              interface personalization (language, theme, graphics
              preferences);
            </li>
            <li>
              load balancing and security (protection against
              abuse).
            </li>
          </ul>
          <p>
            All storage items used by DnDiscord fall under
            these categories. No prior consent is therefore
            legally required.
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

        <Card title={`${SECTIONS.length + 3}. What we don't do`}>
          <ul class="list-disc list-inside space-y-1 text-sm">
            <li>No HTTP cookies are set by the service.</li>
            <li>
              No advertising trackers, no cross-site trackers, no
              digital fingerprinting.
            </li>
            <li>
              No third-party analytics tools (Google Analytics, Meta Pixel,
              Hotjar, TikTok Pixel, etc.).
            </li>
            <li>No resale or rental of data to any third party.</li>
          </ul>
        </Card>

        <Card title={`${SECTIONS.length + 4}. Management and exercise of rights`}>
          <p>
            You can at any time:
          </p>
          <ul class="list-disc list-inside space-y-1 text-sm">
            <li>
              <strong>view</strong> the full list of storage items
              via the "Manage my local storage" button at the top of this page;
            </li>
            <li>
              <strong>clear your local preferences</strong> via the
              dedicated button or from the "Privacy &amp; data" tab
              in settings;
            </li>
            <li>
              <strong>delete all your data</strong> (account,
              characters, campaigns…) by requesting deletion of your
              account (RGPD art. 17) from settings.
            </li>
          </ul>
          <p>
            You also retain full control over local storage
            from your browser settings (under "Cookies and site data").
          </p>
        </Card>

        <Card title={`${SECTIONS.length + 5}. Policy evolution`}>
          <p>
            Should DnDiscord integrate a consent-required tracker in the
            future (for example a third-party analytics tool), this
            policy would be updated and an{" "}
            <strong>explicit consent mechanism</strong> compliant with
            the CNIL Recommendation would be put in place before any
            activation (banner with equally prominent "Accept" and "Decline"
            buttons).
          </p>
        </Card>

        <Card title={`${SECTIONS.length + 6}. Contact`}>
          <p>
            Any question regarding this policy may be addressed to {ORG.name}:
          </p>
          <ul class="text-sm space-y-1">
            <li>
              GDPR contact:{" "}
              <a
                href={`mailto:${ORG.privacyEmail}`}
                class="text-purple-300 underline"
              >
                {ORG.privacyEmail}
              </a>
            </li>
            <li>
              Data protection officer:{" "}
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
          <A href="/privacy" class="text-purple-300 hover:text-purple-200 underline underline-offset-2">
            Privacy policy
          </A>
          <span class="text-slate-600">·</span>
          <A href="/terms" class="text-purple-300 hover:text-purple-200 underline underline-offset-2">
            Terms of service
          </A>
          <span class="text-slate-600">·</span>
          <A href="/legal" class="text-purple-300 hover:text-purple-200 underline underline-offset-2">
            Legal notice
          </A>
        </nav>
        <p class="pt-2 text-xs text-slate-500">
          In effect since {ORG.lastUpdated}.
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
            <th class="py-2 pr-3 font-medium">Key</th>
            <th class="py-2 pr-3 font-medium">Purpose</th>
            <th class="py-2 pr-3 font-medium">Duration</th>
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
