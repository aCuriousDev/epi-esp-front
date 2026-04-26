import { A, useNavigate } from "@solidjs/router";
import { ArrowLeft, Scale } from "lucide-solid";
import { onMount, type JSX } from "solid-js";
import {
  LEGAL_ORG as ORG,
  LEGAL_HOSTING as HOSTING,
  LEGAL_MEDIATOR as MEDIATOR,
  LEGAL_EXTERNAL as EXT,
} from "../config/legal";

export default function TermsOfService() {
  const navigate = useNavigate();
  onMount(() => document.getElementById("root")?.scrollTo(0, 0));

  return (
    <div class="terms-page min-h-screen w-full overflow-y-auto">
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
          <Scale class="w-5 h-5 text-purple-400" />
          Terms of service
        </h1>
        <div class="w-24" />
      </header>

      <main class="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-20 space-y-6">
        {/* 1 */}
        <Card title="1. Preamble and identification">
          <p>
            These Terms of Service (hereinafter the{" "}
            <strong>"Terms"</strong>) govern the use of the{" "}
            <strong>DnDiscord</strong> service, a web-based virtual tabletop
            (VTT) role-playing platform integrated as a Discord Activity,
            published by:
          </p>
          <dl class="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-x-4 gap-y-1 text-sm bg-white/5 border border-white/10 rounded-xl p-4">
            <dt class="text-slate-400">Publisher</dt>
            <dd class="text-white">{ORG.name} — {ORG.legalForm}</dd>
            <dt class="text-slate-400">Share capital</dt>
            <dd class="text-white">{ORG.capital}</dd>
            <dt class="text-slate-400">SIREN / SIRET</dt>
            <dd class="text-white">{ORG.siren} / {ORG.siret}</dd>
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
            <dt class="text-slate-400">General contact</dt>
            <dd class="text-white">
              <a
                href={`mailto:${ORG.contactEmail}`}
                class="text-purple-300 underline"
              >
                {ORG.contactEmail}
              </a>
            </dd>
          </dl>
          <p>
            In accordance with art. 6-III de la loi n° 2004-575 du 21 juin
            2004 (LCEN), the hosting provider for the service is{" "}
            <strong>{HOSTING.provider}</strong>, {HOSTING.address}. The
            servers used for DnDiscord are located in a{" "}
            <strong>{HOSTING.serverLocation}</strong>.
          </p>
          <p>
            Use of DnDiscord is also subject to the{" "}
            <ExternalLink href={EXT.discordTerms}>
              Discord Terms of Service
            </ExternalLink>{" "}
            and the{" "}
            <ExternalLink href="https://discord.com/guidelines">
              Discord Community Guidelines
            </ExternalLink>
            , the{" "}
            <ExternalLink href="https://support-dev.discord.com/hc/en-us/articles/8562894815383-Discord-Developer-Terms-of-Service">
              Discord Developer Terms of Service
            </ExternalLink>{" "}
            and the{" "}
            <ExternalLink href={EXT.discordDevPolicy}>
              Discord Developer Policy
            </ExternalLink>
            . In the event of an irreconcilable conflict, Discord's own
            platform rules take precedence for anything falling within that
            platform's scope.
          </p>
        </Card>

        {/* 2 */}
        <Card title="2. Definitions">
          <ul class="list-disc list-inside space-y-1 text-sm">
            <li>
              <strong>Service</strong>: the DnDiscord platform (Discord
              Activity, API, web interfaces, associated bot).
            </li>
            <li>
              <strong>User</strong>: any person accessing the Service,
              whether on the free tier or under a paid subscription.
            </li>
            <li>
              <strong>Account</strong>: personal space opened for the User
              via Discord OAuth 2.0 authentication.
            </li>
            <li>
              <strong>GM (Game Master)</strong>: a User who creates and runs
              a Campaign.
            </li>
            <li>
              <strong>Campaign</strong>: a game space bringing together a GM
              and players around a scenario.
            </li>
            <li>
              <strong>User Content</strong>: any data created or transmitted
              by the User (characters, maps, dialogues, chat messages).
            </li>
            <li>
              <strong>Publisher</strong>: Studio I-XX SAS, responsible for
              the Service.
            </li>
          </ul>
        </Card>

        {/* 3 */}
        <Card title="3. Purpose and scope">
          <p>
            These Terms define the conditions under which the Publisher
            makes the Service available to Users, as well as their
            respective rights and obligations. They apply to any use of the
            Service, whether on the free tier or under a paid subscription.
          </p>
        </Card>

        {/* 4 */}
        <Card title="4. Acceptance and modification of the Terms">
          <p>
            Accessing the Service constitutes full and unreserved acceptance
            of these Terms. The Publisher reserves the right to modify them
            at any time, in particular to comply with regulatory changes or
            to incorporate new features. Material changes are notified
            within the application at least <strong>15 days</strong> before
            they take effect. Continued use after that date constitutes
            acceptance of the updated Terms. Otherwise, the User may
            terminate their Account under the conditions set out in
            Section 14.
          </p>
          <p>
            <strong>Authoritative language</strong> — These Terms of Service
            are drafted in English (translation of the original French
            version). The French version remains the legally binding
            reference; any divergence is interpreted in light of the French
            original.
          </p>
        </Card>

        {/* 5 */}
        <Card title="5. Conditions of access to the service">
          <ul class="list-disc list-inside space-y-1 text-sm">
            <li>
              <strong>Minimum age: 15 years old</strong>, in accordance with
              art. 8 du RGPD and art. 7-1 de la loi Informatique et
              Libertés (digital age of consent in France). Users under 15
              may only access the Service with the consent of their parent
              or legal guardian.
            </li>
            <li>
              Discord independently enforces a minimum age of 13, which
              constitutes a first age barrier.
            </li>
            <li>
              <strong>Legal capacity</strong>: the User declares having the
              legal capacity to enter into a contract or, failing that,
              having obtained the authorization of their legal
              representative.
            </li>
            <li>
              A valid <strong>Discord Account</strong> is required.
              Authentication is delegated exclusively to Discord via OAuth
              2.0; the Publisher neither manages passwords nor any contact
              email other than the one provided by Discord.
            </li>
            <li>
              <strong>Accuracy</strong>: the User undertakes to provide
              accurate information and to keep it up to date.
            </li>
            <li>
              The Service is provided <em>"as is"</em>. The Publisher
              implements reasonable measures to ensure availability but does
              not guarantee uninterrupted uptime.
            </li>
          </ul>
        </Card>

        {/* 6 */}
        <Card title="6. Service description and evolution">
          <p>
            DnDiscord provides its Users with:
          </p>
          <ul class="list-disc list-inside space-y-1 text-sm">
            <li>a 3D game board (BabylonJS rendering, isometric view);</li>
            <li>a character creation and management module;</li>
            <li>a campaign management module for the GM;</li>
            <li>
              real-time multiplayer synchronization via WebSockets
              (SignalR);
            </li>
            <li>
              an integrated chat (speech bubbles above characters, distinct
              visual style for the GM);
            </li>
            <li>Discord OAuth authentication.</li>
          </ul>
          <p>
            The Publisher reserves the right to evolve, modify or remove
            any feature, in particular for technical improvement, functional
            expansion or regulatory compliance purposes.
          </p>
        </Card>

        {/* 7 */}
        <Card title="7. Subscriptions, pricing, payment and right of withdrawal">
          <p>
            The Service is offered on a <strong>freemium</strong> model:
            certain basic features are available for free, while others are
            reserved for paid subscribers. Tiers, included features and
            prices are displayed within the application at the time of
            subscription.
            {/* TODO: list final subscription tiers here. */}
          </p>
          <p>
            <strong>Payment</strong>: subscriptions are billed through a
            PCI-DSS-certified payment provider (e.g. Stripe Payments Europe
            Ltd.). Card data does not pass through the Publisher's servers.
          </p>
          <p>
            <strong>Right of withdrawal (art. L221-18 Code de la
            consommation)</strong> — Consumer Users have{" "}
            <strong>14 days</strong> from subscription to exercise their
            right of withdrawal, without giving any reason. In accordance
            with art. L221-28 13°, the right of withdrawal does not apply
            to digital content delivered on an intangible medium whose
            execution has begun <strong>with the User's prior express
            consent</strong> and their express waiver of that right — this
            waiver is collected explicitly at the moment the paid features
            are activated.
          </p>
          <p>
            <strong>Tacit renewal (art. L215-1 et L215-2 C. conso.)</strong>{" "}
            — Consumer subscriptions renew automatically. The Publisher
            notifies the User no earlier than three months and no later
            than one month before the renewal date of their right not to
            renew. The User may cancel freely and at any time after renewal,
            without penalty.
          </p>
          <p>
            <strong>Cancellation and refunds</strong> — The User may cancel
            their subscription at any time from their account settings.
            Access to paid features is maintained until the end of the
            already-paid period; no pro-rata refund is owed, except in the
            event of a material failure of the Service attributable to the
            Publisher.
          </p>
        </Card>

        {/* 8 */}
        <Card title="8. Intellectual property">
          <p>
            <strong>Publisher's rights</strong> — The Service, its source
            code, design, interfaces, 3D models, original assets, databases
            and trademarks (including <em>Studio I-XX</em> and{" "}
            <em>DnDiscord</em>) are the exclusive property of the Publisher
            or its rights holders and are protected by intellectual property
            law and international conventions. Any reproduction,
            representation, adaptation or modification, in whole or in part,
            is prohibited without prior written authorization.
          </p>
          <p>
            <strong>User Content</strong> — The User retains full ownership
            of the content they create (characters, campaigns, maps, texts,
            dialogues). For the duration of their use of the Service and
            solely for the purpose of operating and displaying the Service,
            the User grants the Publisher a <strong>non-exclusive</strong>,
            worldwide, royalty-free licence, limited strictly to what is
            necessary to host, display, save and synchronize that content
            among players within the same Campaign.
          </p>
          <p>
            <strong>Game rules (SRD 5.2)</strong> — The game rules used by
            DnDiscord are compatible with the{" "}
            <em>System Reference Document 5.2</em> published by{" "}
            <strong>Wizards of the Coast LLC</strong> under the{" "}
            <ExternalLink href="https://creativecommons.org/licenses/by/4.0/">
              Creative Commons Attribution 4.0 International (CC BY 4.0)
            </ExternalLink>{" "}
            licence. In accordance with that licence, the following
            attribution notice appears in the Service credits:{" "}
            <em>
              "Portions of the materials used are property of Wizards of
              the Coast. ©Wizards of the Coast LLC."
            </em>{" "}
            DnDiscord is not affiliated with, sponsored by or endorsed by
            Wizards of the Coast LLC or Hasbro.
          </p>
          <p>
            <strong>Third-party trademarks</strong> — The trademarks{" "}
            <em>Discord</em>, <em>BabylonJS</em> and all other trademarks
            cited remain the property of their respective owners.
          </p>
        </Card>

        {/* 9 */}
        <Card title="9. Personal data">
          <p>
            The processing of your personal data is described in detail in
            our{" "}
            <A href="/privacy" class="text-purple-300 underline hover:text-purple-200">
              Privacy policy
            </A>
            , which sets out in particular the purposes, legal bases,
            recipients, retention periods and your rights (access,
            rectification, erasure, portability, objection, restriction).
            The Publisher has appointed a{" "}
            <strong>Data Protection Officer</strong> (DPO) reachable at{" "}
            <a
              href={`mailto:${ORG.dpoEmail}`}
              class="text-purple-300 underline"
            >
              {ORG.dpoEmail}
            </a>
            .
          </p>
          <p>
            The application infrastructure is hosted{" "}
            <strong>within the European Union</strong> (Hostinger datacenter
            in Germany). No transfer outside the EU takes place in respect
            of hosting.
          </p>
        </Card>

        {/* 10 */}
        <Card title="10. Cookies and local storage">
          <p>
            DnDiscord does not use any HTTP cookies or any third-party
            trackers. The use of browser local storage and the associated
            management options are detailed in our{" "}
            <A href="/cookies" class="text-purple-300 underline hover:text-purple-200">
              Cookies policy
            </A>
            .
          </p>
        </Card>

        {/* 11 */}
        <Card title="11. Code of conduct and prohibited content">
          <p>
            The User undertakes to respect other Users and not to post any
            unlawful content or content contrary to public morals. The
            following are in particular prohibited:
          </p>
          <ul class="list-disc list-inside space-y-1 text-sm">
            <li>
              harassment, insults, threats, discriminatory content or
              content inciting hatred;
            </li>
            <li>
              child sexual abuse material, pornographic content directed at
              a minor, content inciting violence or terrorism;
            </li>
            <li>
              counterfeiting, identity theft, unauthorized distribution of
              protected content;
            </li>
            <li>
              promotion of gambling or illegal substances, distribution of
              third-party personal data;
            </li>
            <li>
              any unauthorized access attempt, mass scraping or
              denial-of-service attack.
            </li>
          </ul>
          <p>
            Heightened vigilance applies in areas where minors may
            interact.
          </p>
          <p>
            <strong>Reporting (Digital Services Act — Règlement UE
            2022/2065)</strong> — Any User may report content they consider
            unlawful by writing to{" "}
            <a
              href={`mailto:${ORG.abuseEmail}`}
              class="text-purple-300 underline"
            >
              {ORG.abuseEmail}
            </a>
            . The report must precisely describe the content in question,
            its location within the Service, and the reasons justifying its
            unlawful nature. The Publisher acknowledges receipt as promptly
            as possible and handles reports in a diligent, non-arbitrary
            and objective manner.
          </p>
          <p>
            For criminally reprehensible content, a report may also be
            filed via the official platform{" "}
            <ExternalLink href={EXT.pharosUrl}>
              PHAROS ({EXT.pharosUrl.replace(/^https?:\/\//, "")})
            </ExternalLink>
            .
          </p>
          <p>
            <strong>Graduated sanctions</strong> — In the event of a
            breach, the Publisher may, depending on severity: warn the
            User, remove the disputed content, temporarily suspend access
            to the Service, or permanently terminate the Account. The User
            is notified of any measure taken and may appeal by writing to{" "}
            <a
              href={`mailto:${ORG.contactEmail}`}
              class="text-purple-300 underline"
            >
              {ORG.contactEmail}
            </a>
            .
          </p>
        </Card>

        {/* 12 */}
        <Card title="12. Liability">
          <p>
            <strong>Best-efforts obligation</strong> — The Publisher is
            subject to a best-efforts obligation in the provision of the
            Service. It implements reasonable diligence to ensure proper
            operation, security and availability.
          </p>
          <p>
            <strong>Availability</strong> — The Service may be temporarily
            unavailable due to scheduled maintenance, a technical incident,
            failure of third-party providers (Hostinger, Discord,
            Cloudflare…) or for reasons beyond the Publisher's control. The
            Publisher is not liable for unavailability caused by such third
            parties.
          </p>
          <p>
            <strong>Limitation of liability</strong> — To the extent
            permitted by art. 1231-1 et suivants du Code civil, the
            Publisher shall not be liable for indirect damages (loss of
            data, loss of profit, reputational harm, indirect moral
            damages). These limitations do not apply in cases of gross
            negligence, wilful misconduct or personal injury, in accordance
            with mandatory French law.
          </p>
          <p>
            <strong>Force majeure</strong> — The Publisher cannot be held
            liable for non-performance of its obligations where such
            non-performance results from a force majeure event within the
            meaning of art. 1218 du Code civil.
          </p>
        </Card>

        {/* 13 */}
        <Card title="13. Statutory warranties">
          <p>
            For consumer Users who have subscribed to a paid plan, the
            following statutory warranties apply:
          </p>
          <ul class="list-disc list-inside space-y-1 text-sm">
            <li>
              <strong>Statutory warranty of conformity</strong> (art.
              L224-25-12 et suivants du Code de la consommation for digital
              services): the Service must match its description and be free
              from defects.
            </li>
            <li>
              <strong>Warranty against hidden defects</strong> (art. 1641
              et suivants du Code civil) for latent defects rendering the
              Service unfit for its intended use.
            </li>
          </ul>
          <p>
            Claims under these warranties may be sent to{" "}
            <a
              href={`mailto:${ORG.contactEmail}`}
              class="text-purple-300 underline"
            >
              {ORG.contactEmail}
            </a>
            .
          </p>
        </Card>

        {/* 14 */}
        <Card title="14. Duration, suspension and account termination">
          <p>
            These Terms apply for the entire duration of use of the
            Service.
          </p>
          <p>
            <strong>At the User's initiative</strong> — The User may
            terminate their Account at any time from the "Privacy &amp; data"
            settings. This action results in the permanent deletion of their
            Account, characters, owned Campaigns and associated content,
            along with a prior data-export offer (RGPD art. 20).
          </p>
          <p>
            <strong>At the Publisher's initiative</strong> — The Publisher
            may suspend or terminate a User's access in the event of a
            serious or repeated breach of these Terms or of applicable law,
            subject to prior notice except in urgent cases (Service
            security, manifestly unlawful content). The User may challenge
            the decision by responding to the notice.
          </p>
        </Card>

        {/* 15 */}
        <Card title="15. Dependencies on third-party platforms">
          <ul class="list-disc list-inside space-y-1 text-sm">
            <li>
              <strong>Discord</strong> — Integration platform, OAuth
              authentication and client distribution. Use of the Service
              implies compliance with Discord's Terms of Service and
              Community Guidelines. The Publisher has no control over
              Discord's availability or future changes.
            </li>
            <li>
              <strong>{HOSTING.provider}</strong> (Hostinger) —
              Hosting provider. SLA and continuity commitments depend on
              Hostinger's contractual terms, accessible from{" "}
              <ExternalLink href={HOSTING.contactUrl}>
                their website
              </ExternalLink>
              .
            </li>
            <li>
              <strong>Cloudflare, Inc.</strong> — CDN and anti-DDoS
              protection.
            </li>
            <li>
              <strong>Wizards of the Coast LLC</strong> — Rights holder for
              the SRD 5.2 used under the CC BY 4.0 licence.
            </li>
          </ul>
        </Card>

        {/* 16 */}
        <Card title="16. Miscellaneous provisions">
          <ul class="list-disc list-inside space-y-1 text-sm">
            <li>
              <strong>Partial invalidity</strong> — If any provision of
              these Terms is declared null and void or unenforceable, the
              remaining provisions remain in full force and effect.
            </li>
            <li>
              <strong>No waiver</strong> — The Publisher's failure to
              enforce any breach does not constitute a waiver of its right
              to enforce it subsequently.
            </li>
            <li>
              <strong>Assignment</strong> — The Publisher may freely assign
              these Terms to any third party succeeding it in the operation
              of the Service, subject to notifying Users.
            </li>
            <li>
              <strong>Entire agreement</strong> — These Terms, together with
              the Privacy policy, the Cookies policy and the Legal notice,
              constitute the entire agreement between the User and the
              Publisher.
            </li>
          </ul>
        </Card>

        {/* 17 */}
        <Card title="17. Applicable law, mediation and jurisdiction">
          <p>
            These Terms are governed by {ORG.applicableLaw} law.
          </p>
          <p>
            <strong>Consumer mediation</strong> (art. L611-1 et suivants du
            Code de la consommation) — In the event of a dispute that could
            not be resolved through a prior complaint to the Publisher, the
            consumer may have free recourse to the following consumer
            mediator:{" "}
            <strong>{MEDIATOR.name}</strong> —{" "}
            <ExternalLink href={MEDIATOR.url}>{MEDIATOR.url}</ExternalLink>
            .{/* TODO: appoint a CECMC-approved mediator and update here. */}
          </p>
          <p>
            For cross-border disputes within the European Union, the
            European Commission's{" "}
            <ExternalLink href={EXT.odrUrl}>
              Online Dispute Resolution (ODR) platform
            </ExternalLink>{" "}
            is also available.
          </p>
          <p>
            <strong>Competent court</strong> — Failing amicable resolution:
            for business-to-business disputes, the{" "}
            {ORG.jurisdiction.toLowerCase()} have exclusive jurisdiction;
            for consumers, the competent court is that of the consumer's
            place of domicile or the place of performance of the contract,
            in accordance with art. R631-3 du Code de la consommation and
            mandatory consumer-protection rules.
          </p>
        </Card>

        <nav class="flex flex-wrap items-center gap-x-3 gap-y-2 pt-6 text-sm text-slate-400">
          <A href="/privacy" class="text-purple-300 hover:text-purple-200 underline underline-offset-2">
            Privacy policy
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
      </main>

      <style jsx>{`
        .terms-page {
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
