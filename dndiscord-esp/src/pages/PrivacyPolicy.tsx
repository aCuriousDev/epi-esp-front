import { A, useNavigate } from "@solidjs/router";
import { For, onMount, type JSX } from "solid-js";
import {
  ArrowLeft,
  ShieldCheck,
  Database,
  Users,
  Globe,
  Clock,
  UserCheck,
  Cookie,
  Lock,
  Mail,
  AlertTriangle,
  BookOpen,
  Sparkles,
} from "lucide-solid";
import { consentStore } from "../stores/consent.store";
import {
  LEGAL_ORG as ORG,
  LEGAL_HOSTING as HOSTING,
  LEGAL_DPA as DPA,
  LEGAL_EXTERNAL as EXT,
} from "../config/legal";

type Section = {
  id: string;
  title: string;
  icon: () => JSX.Element;
};

// Icons are factories to be instantiated at render time (inside a
// createRoot), not at module level — otherwise Solid logs "computations
// created outside a `createRoot` or `render` will never be disposed".
const SECTIONS: Section[] = [
  { id: "tldr", title: "At a glance", icon: () => <Sparkles class="w-4 h-4" /> },
  { id: "intro", title: "Preamble", icon: () => <ShieldCheck class="w-4 h-4" /> },
  { id: "controller", title: "Controller", icon: () => <UserCheck class="w-4 h-4" /> },
  { id: "definitions", title: "Definitions", icon: () => <BookOpen class="w-4 h-4" /> },
  { id: "data", title: "Data we collect", icon: () => <Database class="w-4 h-4" /> },
  { id: "purposes", title: "Purposes & legal bases", icon: () => <ShieldCheck class="w-4 h-4" /> },
  { id: "recipients", title: "Recipients", icon: () => <Users class="w-4 h-4" /> },
  { id: "transfers", title: "Transfers outside the EU", icon: () => <Globe class="w-4 h-4" /> },
  { id: "retention", title: "Retention period", icon: () => <Clock class="w-4 h-4" /> },
  { id: "rights", title: "Your rights", icon: () => <UserCheck class="w-4 h-4" /> },
  { id: "cookies", title: "Local storage / cookies", icon: () => <Cookie class="w-4 h-4" /> },
  { id: "security", title: "Security", icon: () => <Lock class="w-4 h-4" /> },
  { id: "minors", title: "Minors", icon: () => <AlertTriangle class="w-4 h-4" /> },
  { id: "changes", title: "Changes", icon: () => <Clock class="w-4 h-4" /> },
  { id: "contact", title: "Contact & complaints", icon: () => <Mail class="w-4 h-4" /> },
];

export default function PrivacyPolicy() {
  const navigate = useNavigate();
  onMount(() => document.getElementById("root")?.scrollTo(0, 0));

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div class="privacy-page min-h-screen w-full overflow-y-auto">
      {/* Background */}
      <div class="fixed inset-0 overflow-hidden pointer-events-none">
        <div class="absolute top-1/4 -left-32 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-3xl" />
        <div class="absolute bottom-1/4 -right-32 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl" />
      </div>
      <div class="vignette fixed inset-0 pointer-events-none" />

      {/* Header */}
      <header class="sticky top-0 z-30 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-game-dark/80 backdrop-blur-md">
        <button
          onClick={() => navigate(-1)}
          class="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
        >
          <ArrowLeft class="w-5 h-5" />
          <span class="hidden sm:inline">Back</span>
        </button>
        <h1 class="font-display text-xl text-white tracking-wide flex items-center gap-2">
          <ShieldCheck class="w-5 h-5 text-purple-400" />
          Privacy policy
        </h1>
        <div class="w-24" />
      </header>

      <main class="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-8 pb-20 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8">
        {/* Table of contents */}
        <aside class="lg:sticky lg:top-24 lg:self-start">
          <nav
            aria-label="Contents"
            class="bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl p-3"
          >
            <p class="text-xs uppercase tracking-wider text-slate-400 px-2 py-1">
              Contents
            </p>
            <ul class="space-y-0.5">
              <For each={SECTIONS}>
                {(s) => (
                  <li>
                    <button
                      onClick={() => scrollTo(s.id)}
                      class="w-full flex items-center gap-2 text-left px-2 py-1.5 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <span class="text-purple-400 shrink-0">{s.icon()}</span>
                      <span class="truncate">{s.title}</span>
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </nav>
        </aside>

        {/* Content */}
        <article class="space-y-8">
          {/* At a glance — user-friendly summary */}
          <section
            id="tldr"
            class="scroll-mt-24 rounded-2xl border border-purple-500/30 bg-purple-500/5 p-6 space-y-3"
          >
            <h2 class="font-display text-lg sm:text-xl text-white flex items-center gap-2">
              <Sparkles class="w-5 h-5 text-purple-300" />
              At a glance
            </h2>
            <ul class="text-slate-200 text-sm leading-relaxed space-y-1.5 list-disc list-inside">
              <li>
                We use <strong>no advertising cookies</strong>,
                no third-party trackers, and no external analytics tools.
              </li>
              <li>
                Your data is hosted <strong>within the European Union</strong>{" "}
                (Hostinger datacenter in Germany).
              </li>
              <li>
                We only collect what is necessary to run the game: your Discord
                profile (ID, username, avatar, email), characters, campaigns,
                and in-game messages.
              </li>
              <li>
                You can <strong>export</strong> or <strong>delete</strong>{" "}
                all your data in one click from your account settings.
              </li>
              <li>
                You have all GDPR rights (access, rectification, erasure,
                portability, objection) and may file a complaint with the CNIL.
              </li>
            </ul>
          </section>

          <Card id="intro" title="1. Preamble" icon={<ShieldCheck class="w-5 h-5 text-purple-400" />}>
            <p>
              DnDiscord is a role-playing game application (Dungeons & Dragons) that
              runs as a <strong>Discord Activity</strong> (an iframe embedded
              inside the Discord client). It allows players to create characters,
              campaigns, and run real-time multiplayer sessions.
            </p>
            <p>
              This policy describes how we collect, use, share, and protect your
              personal data, in compliance with the{" "}
              <strong>
                Règlement (UE) 2016/679 (RGPD)
              </strong>
              , the French "Informatique et Libertés" law as amended, the{" "}
              <strong>Directive ePrivacy</strong> (as implemented through CNIL
              guidelines), as well as the{" "}
              <ExternalLink href={EXT.discordDevPolicy}>
                Discord Developer Policy
              </ExternalLink>{" "}
              and the{" "}
              <ExternalLink href={EXT.discordPrivacy}>
                Discord Privacy Policy
              </ExternalLink>
              .
            </p>
          </Card>

          <Card id="controller" title="2. Data controller" icon={<UserCheck class="w-5 h-5 text-purple-400" />}>
            <dl class="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-x-4 gap-y-2 text-sm">
              <dt class="text-slate-400">Name</dt>
              <dd class="text-white">{ORG.name}</dd>
              <dt class="text-slate-400">Legal form</dt>
              <dd class="text-white">{ORG.legalForm}</dd>
              <dt class="text-slate-400">Share capital</dt>
              <dd class="text-white">{ORG.capital}</dd>
              <dt class="text-slate-400">SIREN / SIRET</dt>
              <dd class="text-white">
                {ORG.siren} / {ORG.siret}
              </dd>
              <dt class="text-slate-400">RCS</dt>
              <dd class="text-white">{ORG.rcs}</dd>
              <dt class="text-slate-400">APE code</dt>
              <dd class="text-white">{ORG.codeApe}</dd>
              <dt class="text-slate-400">Registered office</dt>
              <dd class="text-white">{ORG.address}</dd>
              <dt class="text-slate-400">Website</dt>
              <dd class="text-white">
                <ExternalLink href={ORG.website}>{ORG.website}</ExternalLink>
              </dd>
              <dt class="text-slate-400">Legal representative</dt>
              <dd class="text-white">{ORG.legalRepresentative}</dd>
              <dt class="text-slate-400">General contact</dt>
              <dd class="text-white">
                <a href={`mailto:${ORG.contactEmail}`} class="text-purple-300 hover:text-purple-200 underline">
                  {ORG.contactEmail}
                </a>
              </dd>
              <dt class="text-slate-400">GDPR contact</dt>
              <dd class="text-white">
                <a href={`mailto:${ORG.privacyEmail}`} class="text-purple-300 hover:text-purple-200 underline">
                  {ORG.privacyEmail}
                </a>
              </dd>
              <dt class="text-slate-400">Data protection officer</dt>
              <dd class="text-white">
                <a href={`mailto:${ORG.dpoEmail}`} class="text-purple-300 hover:text-purple-200 underline">
                  {ORG.dpoEmail}
                </a>
              </dd>
              <dt class="text-slate-400">Hosting provider</dt>
              <dd class="text-white">
                {HOSTING.provider} — {HOSTING.serverLocation}
              </dd>
            </dl>
          </Card>

          <Card id="definitions" title="3. Definitions" icon={<BookOpen class="w-5 h-5 text-purple-400" />}>
            <p>
              Within the meaning of art. 4 of the GDPR and to facilitate reading
              of this policy, the following terms have the meanings set out below.
            </p>
            <dl class="grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-x-4 gap-y-3 text-sm">
              <dt class="text-purple-200 font-medium">Personal data</dt>
              <dd class="text-slate-300">
                Any information relating to an identified or identifiable natural
                person (username, identifier, IP address, character linked to an
                account, etc.).
              </dd>
              <dt class="text-purple-200 font-medium">Processing</dt>
              <dd class="text-slate-300">
                Any operation performed on personal data: collection, storage,
                modification, transmission, erasure, etc.
              </dd>
              <dt class="text-purple-200 font-medium">Data controller</dt>
              <dd class="text-slate-300">
                The entity that determines the purposes and means of processing.
                For DnDiscord, this is{" "}
                <strong>{ORG.name}</strong>.
              </dd>
              <dt class="text-purple-200 font-medium">Processor</dt>
              <dd class="text-slate-300">
                A legal entity that processes data on behalf of the data
                controller (e.g. Hostinger for hosting).
              </dd>
              <dt class="text-purple-200 font-medium">User</dt>
              <dd class="text-slate-300">
                Any natural person using the DnDiscord service,
                authenticated via Discord OAuth.
              </dd>
              <dt class="text-purple-200 font-medium">Consent</dt>
              <dd class="text-slate-300">
                A freely given, specific, informed, and unambiguous indication
                of your agreement to the processing of your data (art. 4.11 RGPD).
              </dd>
              <dt class="text-purple-200 font-medium">DPO</dt>
              <dd class="text-slate-300">
                Data Protection Officer: dedicated point of contact for
                GDPR-related questions ({ORG.dpoEmail}).
              </dd>
              <dt class="text-purple-200 font-medium">Discord Activity</dt>
              <dd class="text-slate-300">
                A web application embedded as an iframe inside the Discord
                client via the Embedded App SDK.
              </dd>
            </dl>
          </Card>

          <Card id="data" title="4. Data we collect" icon={<Database class="w-5 h-5 text-purple-400" />}>
            <h3 class="text-white font-semibold text-base mt-2">4.1 Data received from Discord via OAuth 2.0</h3>
            <p>
              When you sign in via Discord, the application requests your
              authorisation to access the following <em>scopes</em>:{" "}
              <code class="px-1.5 py-0.5 bg-black/40 rounded text-xs">identify</code>,{" "}
              <code class="px-1.5 py-0.5 bg-black/40 rounded text-xs">email</code>,{" "}
              <code class="px-1.5 py-0.5 bg-black/40 rounded text-xs">guilds</code>. Discord
              then transmits to us:
            </p>
            <ul class="list-disc list-inside text-slate-300 space-y-1 text-sm">
              <li>your numeric Discord identifier ("Discord ID");</li>
              <li>your username and discriminator;</li>
              <li>the email address associated with your Discord account;</li>
              <li>your avatar hash (to display your profile picture);</li>
              <li>
                the list of servers (guilds) you are a member of{" "}
                <em>to display campaign invitations</em> — no internal data
                from those servers is read.
              </li>
            </ul>

            <h3 class="text-white font-semibold text-base mt-5">4.2 Data you create in the service</h3>
            <ul class="list-disc list-inside text-slate-300 space-y-1 text-sm">
              <li>
                <strong>Characters</strong>: name, race, class, level,
                ability scores (strength, dexterity, etc.), hit points,
                inventory, biography.
              </li>
              <li>
                <strong>Campaigns</strong>: name, description, narrative tree,
                settings, invitation code, member list.
              </li>
              <li>
                <strong>Maps</strong> you draw in the editor.
              </li>
              <li>
                <strong>Messages and dialogues</strong> in game: campaign chat,
                private game master notes.
              </li>
              <li>
                <strong>Session history</strong>: campaign state snapshots,
                visited nodes, narrative choices.
              </li>
            </ul>

            <h3 class="text-white font-semibold text-base mt-5">4.3 Technical data</h3>
            <ul class="list-disc list-inside text-slate-300 space-y-1 text-sm">
              <li>
                <strong>Authentication token (JWT)</strong> generated by our
                servers, signed, valid for 7 days, stored in your browser's{" "}
                <code class="px-1.5 py-0.5 bg-black/40 rounded text-xs">localStorage</code>.
              </li>
              <li>
                <strong>Technical logs</strong>: user identifier, timestamp,
                action type (create/update/delete), application errors. Stored
                in a structured logging tool (Seq) hosted alongside the
                application.
              </li>
              <li>
                IP address and standard HTTP headers, processed ephemerally by
                our reverse proxy for security and anti-abuse purposes.
              </li>
            </ul>

            <h3 class="text-white font-semibold text-base mt-5">4.4 Payment data (subscriptions)</h3>
            <p>
              DnDiscord is designed as a{" "}
              <strong>freemium</strong> service: a free tier and, eventually,
              paid subscriptions. <strong>No payments are yet
              enabled</strong> as of the date of this policy. When subscriptions
              are activated, payment data (card number, CVV, expiry) will
              <strong> never</strong> pass through our servers: it will be
              entered directly on the infrastructure of a{" "}
              <strong>PCI-DSS</strong>-certified provider (e.g. Stripe). We
              would only receive transaction metadata (payment identifier,
              timestamp, status, last 4 digits, amount, currency) required for
              billing and accounting.
            </p>

            <p class="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3 text-sm text-slate-300 mt-4">
              <strong class="text-purple-200">We do not collect</strong>: bank card numbers, health data, political/religious/trade-union opinions, precise geolocation, or biometric data. No third-party advertising or analytics tools (Google Analytics, Meta Pixel, etc.) are integrated. No marketing profiling is performed, and especially not on minors.
            </p>
          </Card>

          <Card id="purposes" title="5. Purposes and legal bases" icon={<ShieldCheck class="w-5 h-5 text-purple-400" />}>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-left border-b border-white/10 text-slate-400">
                    <th class="py-2 pr-3 font-medium">Purpose</th>
                    <th class="py-2 pr-3 font-medium">Legal basis (art. 6 GDPR)</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                  <LegalRow
                    purpose="Authentication via Discord, creation and maintenance of the user account"
                    basis="Performance of a contract (art. 6.1.b)"
                  />
                  <LegalRow
                    purpose="Provision of the game service: saving and synchronising characters, campaigns, maps, and sessions"
                    basis="Performance of a contract (art. 6.1.b)"
                  />
                  <LegalRow
                    purpose="Real-time communication (multiplayer, chat, dialogues)"
                    basis="Performance of a contract (art. 6.1.b)"
                  />
                  <LegalRow
                    purpose="Management of paid subscriptions, billing, and payment collection"
                    basis="Performance of a contract (art. 6.1.b)"
                  />
                  <LegalRow
                    purpose="Retention of accounting records related to payments (10 years — art. L123-22 Code de commerce)"
                    basis="Legal obligation (art. 6.1.c)"
                  />
                  <LegalRow
                    purpose="Service security, fraud prevention, abuse detection, technical logging"
                    basis="Legitimate interest (art. 6.1.f) — documented balance in favour of the user"
                  />
                  <LegalRow
                    purpose="Responding to your GDPR requests (access, rectification, erasure, etc.) and to judicial orders"
                    basis="Legal obligation (art. 6.1.c)"
                  />
                  <LegalRow
                    purpose="Product improvement based on anonymised aggregated statistics"
                    basis="Legitimate interest (art. 6.1.f) — no personal data"
                  />
                  <LegalRow
                    purpose="Sending functional notifications (campaign invitations, session reminders) via the Discord bot"
                    basis="Performance of a contract (art. 6.1.b)"
                  />
                </tbody>
              </table>
            </div>
          </Card>

          <Card id="recipients" title="6. Data recipients" icon={<Users class="w-5 h-5 text-purple-400" />}>
            <p>
              Your data is processed solely by the DnDiscord team and by the
              <strong> strictly necessary technical processors </strong>
              required to operate the service:
            </p>
            <ul class="list-disc list-inside text-slate-300 space-y-2 text-sm">
              <li>
                <strong>{HOSTING.provider}</strong> — host of the application
                infrastructure (Docker containers, PostgreSQL database,
                RabbitMQ message bus). Registered office:{" "}
                {HOSTING.address}. The servers used for DnDiscord are
                located in a <strong>{HOSTING.serverLocation}</strong>.
                Production domain: <code>{ORG.productionDomain}</code>.{" "}
                <ExternalLink href={HOSTING.contactUrl}>
                  Contact Hostinger
                </ExternalLink>
                .
              </li>
              <li>
                <strong>Discord Inc.</strong> (United States) — OAuth 2.0
                authentication provider, Activity platform, and host of the
                client that embeds DnDiscord. See the{" "}
                <ExternalLink href={EXT.discordPrivacy}>
                  Discord Privacy Policy
                </ExternalLink>
                .
              </li>
              <li>
                <strong>Cloudflare, Inc.</strong> (United States, European
                servers) — content delivery network (CDN) and DDoS protection.
                Processes IP addresses and request metadata transiently.
              </li>
              <li>
                <strong>Payment provider (PCI-DSS)</strong> — for example{" "}
                <em>Stripe Payments Europe, Ltd.</em> (Ireland, EU)
                — processes card data directly on its own infrastructure,
                without exposure to our servers. The exact provider will be
                confirmed in this policy upon integration.{/* TODO RGPD: lock in the payment provider. */}
              </li>
              <li>
                <strong>Datalust Seq</strong> — aggregation and search of
                structured technical logs, deployed on the same European
                infrastructure as the application (no data exported outside
                the EU).
              </li>
              <li>
                <strong>OpenTelemetry</strong> — distributed request tracing
                for diagnostics and performance. Traces are aggregated in the
                application's European infrastructure.
              </li>
              <li>
                <strong>Public authorities</strong> — only upon a duly formed
                judicial or administrative order (judicial authority, CNIL,
                police/gendarmerie services).
              </li>
            </ul>
            <p class="text-sm text-slate-400 mt-3 bg-purple-500/5 border border-purple-500/20 rounded-lg p-3">
              <strong class="text-purple-200">Explicit commitment:</strong>{" "}
              Studio I-XX SAS does not sell, rent, or transfer your data to
              third parties for commercial, advertising, or prospecting purposes.
            </p>
            <p class="text-sm text-slate-400 mt-3">
              <strong>No data</strong> is sold, rented, or shared for commercial
              purposes. Other players and the game master of a campaign see only
              the data you choose to make visible within that campaign (username,
              character, messages).
            </p>
          </Card>

          <Card id="transfers" title="7. Transfers outside the European Union" icon={<Globe class="w-5 h-5 text-purple-400" />}>
            <p>
              <strong>By default, your data stays within the European
              Economic Area (EEA)</strong>. The application infrastructure,
              database, and logs are hosted at Hostinger in a{" "}
              <strong>datacenter in Germany</strong>. The payment provider we
              integrate is established in the European Union (Ireland for
              Stripe Payments Europe Ltd.).
            </p>
            <p>
              Transfers outside the EU occur <strong>only</strong> to two
              US-based processors, in a limited and controlled manner:
            </p>
            <ul class="list-disc list-inside text-slate-300 space-y-1 text-sm">
              <li>
                <strong>Discord Inc.</strong> (United States) — OAuth
                authentication and execution of the Activity in the Discord
                client.
              </li>
              <li>
                <strong>Cloudflare, Inc.</strong> (United States) — CDN and
                DDoS protection, with primary <em>edge servers</em> in Europe.
              </li>
            </ul>
            <p>
              These transfers are governed by these entities' participation in
              the{" "}
              <ExternalLink href={EXT.dpfUrl}>
                EU-US Data Privacy Framework
              </ExternalLink>{" "}
              (European Commission adequacy decision of 10 July 2023) and,
              subsidiarily, by the <em>Standard Contractual Clauses</em> (SCC)
              adopted by the European Commission on 4 June 2021, for any data
              falling outside the scope of the DPF.
            </p>
          </Card>

          <Card id="retention" title="8. Retention periods" icon={<Clock class="w-5 h-5 text-purple-400" />}>
            <p class="text-sm text-slate-400">
              Periods in line with Studio I-XX SAS's internal security plan
              (revision 2026-04). Logs containing user identifiers are purged
              or pseudonymised at the indicated deadline.
            </p>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-left border-b border-white/10 text-slate-400">
                    <th class="py-2 pr-3 font-medium">Data</th>
                    <th class="py-2 pr-3 font-medium">Duration</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                  <RetentionRow label="User account, characters, campaigns you own" duration="Until account deletion or 2 years of inactivity (automatic purge)" />
                  <RetentionRow label="Authentication token (JWT)" duration="7 days" />
                  <RetentionRow label="Multiplayer session (sessionStorage)" duration="Until tab is closed" />
                  <RetentionRow label="Security logs" duration="1 year" />
                  <RetentionRow label="Application logs (Seq)" duration="90 days" />
                  <RetentionRow label="HTTP access logs" duration="90 days" />
                  <RetentionRow label="Audit logs (sensitive operations)" duration="2 years" />
                  <RetentionRow label="Debug logs" duration="7 days" />
                  <RetentionRow label="Database backups (daily)" duration="30 days" />
                  <RetentionRow label="Configuration backups (weekly)" duration="30 days" />
                  <RetentionRow label="Data required for an ongoing legal proceeding" duration="For the strictly necessary duration, then deleted" />
                </tbody>
              </table>
            </div>
          </Card>

          <Card id="rights" title="9. Your rights" icon={<UserCheck class="w-5 h-5 text-purple-400" />}>
            <p>In accordance with the GDPR, you have the following rights:</p>
            <ul class="list-disc list-inside text-slate-300 space-y-1.5 text-sm">
              <li>
                <strong>Access</strong> to your data (art. 15) — via the
                "Export my data" button in account settings.
              </li>
              <li>
                <strong>Rectification</strong> (art. 16) — edit your characters,
                campaigns, and profile from within the application.
              </li>
              <li>
                <strong>Erasure</strong> / right to be forgotten (art. 17) — via
                the "Delete my account" button in settings.
              </li>
              <li>
                <strong>Restriction</strong> of processing (art. 18).
              </li>
              <li>
                <strong>Portability</strong> (art. 20) — export in reusable JSON
                format via the "Export my data" button.
              </li>
              <li>
                <strong>Objection</strong> (art. 21) to processing based on
                legitimate interest.
              </li>
              <li>
                <strong>Withdraw your consent</strong> at any time by revoking
                the application's access in Discord settings
                (User Settings → Authorizations).
              </li>
              <li>
                <strong>Set directives</strong> regarding the fate of your data
                after your death (loi "Informatique et Libertés", art. 85).
              </li>
            </ul>
            <p class="text-sm text-slate-400 mt-4">
              To exercise any of these rights, contact us at{" "}
              <a href={`mailto:${ORG.dpoEmail}`} class="text-purple-300 underline">
                {ORG.dpoEmail}
              </a>
              . We respond within one month (extendable by two months for complex
              requests, in accordance with article 12 of the GDPR).
            </p>
          </Card>

          <Card id="cookies" title="10. Local storage and cookies" icon={<Cookie class="w-5 h-5 text-purple-400" />}>
            <p>
              DnDiscord uses <strong>no HTTP cookies</strong> and no third-party
              trackers. The application relies exclusively on your browser's{" "}
              <code class="px-1.5 py-0.5 bg-black/40 rounded text-xs">localStorage</code>{" "}
              and{" "}
              <code class="px-1.5 py-0.5 bg-black/40 rounded text-xs">sessionStorage</code>{" "}
              for:
            </p>
            <ul class="list-disc list-inside text-slate-300 space-y-1 text-sm">
              <li>
                storing your authentication token (exempt from consent as an
                authentication tracker — CNIL);
              </li>
              <li>
                remembering your interface preferences: graphics quality, audio
                volume, tutorial state (exempt from consent as interface
                personalisation — CNIL);
              </li>
              <li>
                caching your characters and maps to speed up loading (strictly
                necessary functional data).
              </li>
            </ul>
            <p class="text-sm text-slate-400 mt-3">
              You can view the details of these items and clear your local
              preferences at any time using the button below.
            </p>
            <button
              onClick={() => consentStore.openPreferences()}
              class="mt-3 px-4 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-200 text-sm transition-colors"
            >
              Manage my local storage
            </button>
          </Card>

          <Card id="security" title="11. Security" icon={<Lock class="w-5 h-5 text-purple-400" />}>
            <ul class="list-disc list-inside text-slate-300 space-y-1 text-sm">
              <li>
                End-to-end <strong>TLS 1.3</strong> encrypted communications,
                with systematic HTTP→HTTPS redirection.
              </li>
              <li>
                Data encrypted at rest with <strong>AES-256</strong>{" "}
                (PostgreSQL database and backups).
              </li>
              <li>
                Signed authentication token (HMAC-SHA256), secret key stored
                server-side only and injected via configuration, with systematic
                signature verification on every request.
              </li>
              <li>
                No passwords stored: authentication is fully delegated to
                Discord via OAuth 2.0.
              </li>
              <li>
                Database access restricted by network rules and separate service
                accounts, with enforced encrypted connections.
              </li>
              <li>
                Protection against volumetric attacks (DDoS) and application-level
                <em> rate limiting</em> via Cloudflare.
              </li>
              <li>
                Content Security Policy (CSP) restricting{" "}
                <em>iframe</em> embedding to Discord domains only.
              </li>
              <li>
                Vulnerability management: continuous dependency monitoring,
                patches applied as quickly as possible.
              </li>
            </ul>
          </Card>

          <Card id="minors" title="12. Minors" icon={<AlertTriangle class="w-5 h-5 text-purple-400" />}>
            <p>
              <strong>Minimum age to use DnDiscord: 15 years old</strong>,
              in accordance with article 8 of the GDPR and article 7-1 of loi
              n° 78-17 du 6 janvier 1978 ("Informatique et Libertés"). In France,
              15 is the age of autonomous digital consent.
            </p>
            <p>
              For users <strong>under 15 years old</strong>, processing is only
              lawful if consent has been given or authorised by the holder(s) of
              parental responsibility. Additionally, Discord applies its own
              threshold (13 years old, see the{" "}
              <ExternalLink href={EXT.discordTerms}>
                Discord Terms of Service
              </ExternalLink>
              ): DnDiscord relies on Discord authentication as the first age
              barrier.
            </p>
            <p>
              Holders of parental responsibility may exercise all GDPR rights
              (access, rectification, erasure, portability, objection) on behalf
              of the minor by writing to{" "}
              <a href={`mailto:${ORG.dpoEmail}`} class="text-purple-300 underline">
                {ORG.dpoEmail}
              </a>
              . Information provided to minors is written in{" "}
              <strong>plain and accessible language</strong> in accordance with
              article 12.1 of the GDPR. <strong>No marketing profiling</strong>{" "}
              is carried out on minor users.
            </p>
            <p>
              If you believe a child under 15 has used the service without
              parental authorisation, contact us immediately at the above address:
              we will delete the relevant data within <strong>72 hours</strong>,
              unless subsequent parental consent is provided.
            </p>
          </Card>

          <Card id="changes" title="13. Policy changes" icon={<Clock class="w-5 h-5 text-purple-400" />}>
            <p>
              This policy may be updated (new feature, new processor, legal
              change). The date of last update appears at the top of the
              document. In the event of a material change (new purpose, new
              recipient outside the EU), you will be notified via an in-app
              notification before it takes effect.
            </p>
          </Card>

          <Card id="contact" title="14. Contact and complaints" icon={<Mail class="w-5 h-5 text-purple-400" />}>
            <p>
              For any question regarding your personal data or to exercise your
              GDPR rights, write to:
            </p>
            <ul class="text-white space-y-1 text-sm">
              <li>
                <span class="text-slate-400">GDPR contact: </span>
                <a href={`mailto:${ORG.privacyEmail}`} class="text-purple-300 underline">
                  {ORG.privacyEmail}
                </a>
              </li>
              <li>
                <span class="text-slate-400">Data protection officer: </span>
                <a href={`mailto:${ORG.dpoEmail}`} class="text-purple-300 underline">
                  {ORG.dpoEmail}
                </a>
              </li>
              <li>
                <span class="text-slate-400">Postal address: </span>
                {ORG.name}, {ORG.address}
              </li>
            </ul>
            <p class="text-sm mt-4">
              If, after contacting us, you believe your "Informatique et
              Libertés" rights are not being respected, you have the right to
              lodge a complaint with the French supervisory authority:
            </p>
            <div class="bg-white/5 border border-white/10 rounded-xl p-4 text-sm space-y-1">
              <p class="text-white font-semibold">{DPA.name}</p>
              <p class="text-slate-300">{DPA.address}</p>
              <p class="text-slate-300">{DPA.city}</p>
              <p class="text-slate-300">
                <ExternalLink href={DPA.complaintsUrl}>
                  {DPA.complaintsUrl.replace(/^https?:\/\//, "")}
                </ExternalLink>
              </p>
            </div>
          </Card>

          <nav class="flex flex-wrap items-center gap-x-3 gap-y-2 pt-6 text-sm text-slate-400">
            <A href="/terms" class="text-purple-300 hover:text-purple-200 underline underline-offset-2">
              Terms of service
            </A>
            <span class="text-slate-600">·</span>
            <A href="/legal" class="text-purple-300 hover:text-purple-200 underline underline-offset-2">
              Legal notice
            </A>
            <span class="text-slate-600">·</span>
            <A href="/cookies" class="text-purple-300 hover:text-purple-200 underline underline-offset-2">
              Cookies policy
            </A>
          </nav>
          <p class="pt-2 text-xs text-slate-500">
            In effect since {ORG.lastUpdated}.
          </p>
        </article>
      </main>

      <style jsx>{`
        .privacy-page {
          background: linear-gradient(
            135deg,
            var(--ink-700) 0%,
            var(--ink-800) 50%,
            var(--ink-900) 100%
          );
        }
        /* Typography rules are handled directly by the Tailwind
           classes on Card (text-slate-300 leading-relaxed).
           No need for :global() — support is incomplete in
           solid-styled-jsx anyway. */
      `}</style>
    </div>
  );
}

function Card(props: {
  id: string;
  title: string;
  icon: JSX.Element;
  children: JSX.Element;
}) {
  return (
    <section
      id={props.id}
      class="privacy-card bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 scroll-mt-24 space-y-3"
    >
      <h2 class="font-display text-lg sm:text-xl text-white flex items-center gap-2">
        {props.icon}
        {props.title}
      </h2>
      <div class="text-slate-300 text-sm leading-relaxed space-y-3">
        {props.children}
      </div>
    </section>
  );
}

function LegalRow(props: { purpose: string; basis: string }) {
  return (
    <tr class="align-top">
      <td class="py-2 pr-3 text-slate-200">{props.purpose}</td>
      <td class="py-2 pr-3 text-slate-300">{props.basis}</td>
    </tr>
  );
}

function RetentionRow(props: { label: string; duration: string }) {
  return (
    <tr class="align-top">
      <td class="py-2 pr-3 text-slate-200">{props.label}</td>
      <td class="py-2 pr-3 text-slate-300">{props.duration}</td>
    </tr>
  );
}

function ExternalLink(props: { href: string; children: JSX.Element }) {
  return (
    <a
      href={props.href}
      target="_blank"
      rel="noopener noreferrer"
      class="text-purple-300 hover:text-purple-200 underline underline-offset-2"
    >
      {props.children}
    </a>
  );
}
