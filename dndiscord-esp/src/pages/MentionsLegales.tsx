import { A, useNavigate } from "@solidjs/router";
import { ArrowLeft, FileText } from "lucide-solid";
import { onMount, type JSX } from "solid-js";
import {
  LEGAL_ORG as ORG,
  LEGAL_HOSTING as HOSTING,
  LEGAL_MEDIATOR as MEDIATOR,
  LEGAL_EXTERNAL as EXT,
} from "../config/legal";

export default function MentionsLegales() {
  const navigate = useNavigate();
  onMount(() => document.getElementById("root")?.scrollTo(0, 0));

  return (
    <div class="legal-page min-h-screen w-full overflow-y-auto">
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
          <FileText class="w-5 h-5 text-purple-400" />
          Legal notice
        </h1>
        <div class="w-24" />
      </header>

      <main class="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-20 space-y-6">
        <p class="text-slate-300 text-sm leading-relaxed">
          These legal notices are published in accordance with article 6-III of
          Law No. 2004-575 of 21 June 2004 on confidence in the digital economy
          ("LCEN") and article 93-2 of Law No. 82-652 of 29 July 1982 on
          audiovisual communication.
        </p>

        {/* 1 */}
        <Card title="1. Service publisher">
          <dl class="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-x-4 gap-y-1 text-sm">
            <dt class="text-slate-400">Company name</dt>
            <dd class="text-white">{ORG.name}</dd>
            <dt class="text-slate-400">Legal form</dt>
            <dd class="text-white">{ORG.legalForm}</dd>
            <dt class="text-slate-400">Share capital</dt>
            <dd class="text-white">{ORG.capital}</dd>
            <dt class="text-slate-400">SIREN</dt>
            <dd class="text-white">{ORG.siren}</dd>
            <dt class="text-slate-400">SIRET (registered office)</dt>
            <dd class="text-white">{ORG.siret}</dd>
            <dt class="text-slate-400">RCS</dt>
            <dd class="text-white">{ORG.rcs}</dd>
            <dt class="text-slate-400">TVA intracommunautaire</dt>
            <dd class="text-white">{ORG.tvaIntra}</dd>
            <dt class="text-slate-400">APE / NAF code</dt>
            <dd class="text-white">{ORG.codeApe}</dd>
            <dt class="text-slate-400">Registered office</dt>
            <dd class="text-white">{ORG.address}</dd>
            <dt class="text-slate-400">Phone</dt>
            <dd class="text-white">{ORG.phone}</dd>
            <dt class="text-slate-400">General contact email</dt>
            <dd class="text-white">
              <a
                href={`mailto:${ORG.contactEmail}`}
                class="text-purple-300 underline"
              >
                {ORG.contactEmail}
              </a>
            </dd>
            <dt class="text-slate-400">Main website</dt>
            <dd class="text-white">
              <ExternalLink href={ORG.website}>{ORG.website}</ExternalLink>
            </dd>
          </dl>
        </Card>

        {/* 2 */}
        <Card title="2. Publication director">
          <p>
            The publication director, within the meaning of article 93-2 of the
            Law of 29 July 1982, is <strong>{ORG.publicationDirector}</strong>.
          </p>
          <p>
            Contact:{" "}
            <a
              href={`mailto:${ORG.publicationDirectorEmail}`}
              class="text-purple-300 underline"
            >
              {ORG.publicationDirectorEmail}
            </a>
          </p>
        </Card>

        {/* 3 */}
        <Card title="3. Hosting provider">
          <dl class="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-x-4 gap-y-1 text-sm">
            <dt class="text-slate-400">Company name</dt>
            <dd class="text-white">{HOSTING.provider}</dd>
            <dt class="text-slate-400">Address</dt>
            <dd class="text-white">{HOSTING.address}</dd>
            <dt class="text-slate-400">Server location</dt>
            <dd class="text-white">{HOSTING.serverLocation}</dd>
            <dt class="text-slate-400">Contact</dt>
            <dd class="text-white">
              <ExternalLink href={HOSTING.contactUrl}>
                {HOSTING.contactUrl}
              </ExternalLink>
            </dd>
          </dl>
        </Card>

        {/* 4 */}
        <Card title="4. Published service">
          <dl class="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-x-4 gap-y-1 text-sm">
            <dt class="text-slate-400">Service name</dt>
            <dd class="text-white">DnDiscord</dd>
            <dt class="text-slate-400">URL</dt>
            <dd class="text-white">
              <ExternalLink href={ORG.serviceUrl}>
                {ORG.serviceUrl}
              </ExternalLink>
            </dd>
            <dt class="text-slate-400">Nature</dt>
            <dd class="text-white">
              Web-based virtual tabletop (VTT) role-playing platform,
              integrated as a Discord Activity.
            </dd>
            <dt class="text-slate-400">Access</dt>
            <dd class="text-white">Via Discord (Activity) and web browser.</dd>
            <dt class="text-slate-400">Business model</dt>
            <dd class="text-white">Freemium with paid subscriptions.</dd>
          </dl>
          <p class="pt-2">
            Service terms of use:{" "}
            <A href="/terms" class="text-purple-300 underline">
              Terms of service
            </A>{" "}
            ·{" "}
            <A href="/privacy" class="text-purple-300 underline">
              Privacy policy
            </A>{" "}
            ·{" "}
            <A href="/cookies" class="text-purple-300 underline">
              Cookies policy
            </A>
            .
          </p>
        </Card>

        {/* 5 */}
        <Card title="5. Intellectual property">
          <p>
            All elements of the DnDiscord service — source code, interfaces,
            design, logos, texts, graphics, 3D models, original assets,
            databases, and the <em>Studio I-XX</em> and <em>DnDiscord</em>{" "}
            {/* TODO: specify the INPI/EUIPO filing status once completed. */}
            trademarks — are the exclusive property of {ORG.name} or its
            rights holders, and are protected under articles L111-1 et seq.
            of the French Intellectual Property Code.
          </p>
          <p>
            Any reproduction, representation, adaptation, modification or
            distribution, in whole or in part, by any means whatsoever, is
            prohibited without the prior written authorisation of the
            Publisher, under penalty of prosecution.
          </p>
          <p>
            <strong>SRD 5.2 licence (Creative Commons)</strong> — The game
            rules used by DnDiscord are compatible with the{" "}
            <em>System Reference Document 5.2</em> published by{" "}
            <strong>Wizards of the Coast LLC</strong> under the{" "}
            <ExternalLink href="https://creativecommons.org/licenses/by/4.0/">
              Creative Commons Attribution 4.0 International (CC BY 4.0)
            </ExternalLink>{" "}
            licence. Required attribution:{" "}
            <em>
              "Portions of the materials used are property of Wizards of
              the Coast. ©Wizards of the Coast LLC."
            </em>{" "}
            DnDiscord is not affiliated with, sponsored by, or endorsed by
            Wizards of the Coast LLC or Hasbro.
          </p>
          <p>
            The <em>Discord</em>, <em>BabylonJS</em>, <em>Hostinger</em>,{" "}
            <em>Cloudflare</em> trademarks and all other trademarks mentioned
            are the property of their respective owners.
          </p>
        </Card>

        {/* 6 */}
        <Card title="6. Technical credits">
          <p>The service relies on the following technologies and libraries:</p>
          <ul class="list-disc list-inside space-y-1 text-sm">
            <li>
              <strong>Frontend</strong>: SolidJS, Vite, TypeScript,
              TailwindCSS, BabylonJS, draw2d, SignalR client.
            </li>
            <li>
              <strong>Backend</strong>: .NET 9, ASP.NET Core, Entity
              Framework Core, SignalR, PostgreSQL, RabbitMQ.
            </li>
            <li>
              <strong>Infrastructure</strong>: Docker, Hostinger (hosting),
              Cloudflare (CDN + anti-DDoS).
            </li>
            <li>
              <strong>Observability</strong>: Datalust Seq,
              OpenTelemetry.
            </li>
            <li>
              <strong>Fonts</strong>: Cinzel, Inter, JetBrains Mono,
              IM Fell English SC — distributed via{" "}
              <ExternalLink href="https://fontsource.org/">
                Fontsource
              </ExternalLink>{" "}
              under their respective licences (SIL Open Font License 1.1).
            </li>
            <li>
              <strong>Icons</strong>: lucide-icons (ISC License),
              game-icons.net (CC BY 3.0).
            </li>
          </ul>
          <p>
            These components remain the property of their respective authors
            and are used in accordance with their licences.
          </p>
        </Card>

        {/* 7 */}
        <Card title="7. Reporting illegal content">
          <p>
            In accordance with article 6-I-5 of the LCEN and règlement (UE)
            2022/2065 (the "Digital Services Act"), the Publisher provides a
            reporting mechanism allowing any visitor to notify content they
            consider illegal.
          </p>
          <p>
            <strong>Procedure</strong> — Send an email to{" "}
            <a
              href={`mailto:${ORG.abuseEmail}`}
              class="text-purple-300 underline"
            >
              {ORG.abuseEmail}
            </a>{" "}
            specifying:
          </p>
          <ul class="list-disc list-inside space-y-1 text-sm">
            <li>your contact details (last name, first name, email);</li>
            <li>
              a precise description of the content in question and its
              location within the service (URL, campaign ID, character name
              or message);
            </li>
            <li>the grounds justifying its illegal nature;</li>
            <li>
              a statement on honour attesting to the good faith of the
              report.
            </li>
          </ul>
          <p>
            The Publisher will acknowledge receipt as soon as possible and
            handle the report in a diligent, non-arbitrary, and objective
            manner. Manifestly abusive reports may be rejected.
          </p>
          <p>
            <strong>PHAROS</strong> — For criminally punishable content, a
            report can also be made on the official platform{" "}
            <ExternalLink href={EXT.pharosUrl}>
              {EXT.pharosUrl.replace(/^https?:\/\//, "")}
            </ExternalLink>
            .
          </p>
          <p>
            The Publisher cooperates with the competent authorities under the
            conditions provided for by law.
          </p>
        </Card>

        {/* 8 */}
        <Card title="8. Personal data">
          <p>
            The processing of your personal data is described in the{" "}
            <A href="/privacy" class="text-purple-300 underline">
              Privacy policy
            </A>
            . GDPR contact:{" "}
            <a
              href={`mailto:${ORG.privacyEmail}`}
              class="text-purple-300 underline"
            >
              {ORG.privacyEmail}
            </a>{" "}
            — DPO:{" "}
            <a
              href={`mailto:${ORG.dpoEmail}`}
              class="text-purple-300 underline"
            >
              {ORG.dpoEmail}
            </a>
            .
          </p>
        </Card>

        {/* 9 */}
        <Card title="9. Consumer mediation">
          <p>
            In accordance with articles L611-1 et seq. of the French Consumer
            Code, any consumer user may have free recourse to a consumer
            mediator in the event of a dispute not resolved by a prior
            complaint to the Publisher.
          </p>
          <p>
            <strong>Designated mediator: </strong>
            {MEDIATOR.name} —{" "}
            <ExternalLink href={MEDIATOR.url}>{MEDIATOR.url}</ExternalLink>
            .{/* TODO: designate a CECMC-approved mediator. */}
          </p>
          <p>
            European online dispute resolution platform:{" "}
            <ExternalLink href={EXT.odrUrl}>
              {EXT.odrUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </ExternalLink>
            .
          </p>
        </Card>

        {/* 10 */}
        <Card title="10. Applicable law and jurisdiction">
          <p>
            These legal notices are governed by French law. For disputes
            between professionals, the courts of Lyon have sole jurisdiction.
            For consumers, the competent court is that of the consumer's place
            of domicile or the place of performance of the contract
            (art. R631-3 du Code de la consommation).
          </p>
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
          <A href="/cookies" class="text-purple-300 hover:text-purple-200 underline underline-offset-2">
            Cookies policy
          </A>
        </nav>
        <p class="pt-2 text-xs text-slate-500">
          In effect since {ORG.lastUpdated}.
        </p>
      </main>

      <style jsx>{`
        .legal-page {
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
