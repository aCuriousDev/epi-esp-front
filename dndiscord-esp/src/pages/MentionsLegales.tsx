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
          <span class="hidden sm:inline">Retour</span>
        </button>
        <h1 class="font-display text-xl text-white tracking-wide flex items-center gap-2">
          <FileText class="w-5 h-5 text-purple-400" />
          Mentions légales
        </h1>
        <div class="w-24" />
      </header>

      <main class="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-20 space-y-6">
        <p class="text-slate-300 text-sm leading-relaxed">
          Les présentes mentions légales sont publiées conformément à
          l'article 6-III de la loi n° 2004-575 du 21 juin 2004 pour la
          confiance dans l'économie numérique (« LCEN ») et à l'article 93-2
          de la loi n° 82-652 du 29 juillet 1982 sur la communication
          audiovisuelle.
        </p>

        {/* 1 */}
        <Card title="1. Éditeur du service">
          <dl class="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-x-4 gap-y-1 text-sm">
            <dt class="text-slate-400">Dénomination sociale</dt>
            <dd class="text-white">{ORG.name}</dd>
            <dt class="text-slate-400">Forme juridique</dt>
            <dd class="text-white">{ORG.legalForm}</dd>
            <dt class="text-slate-400">Capital social</dt>
            <dd class="text-white">{ORG.capital}</dd>
            <dt class="text-slate-400">SIREN</dt>
            <dd class="text-white">{ORG.siren}</dd>
            <dt class="text-slate-400">SIRET (siège)</dt>
            <dd class="text-white">{ORG.siret}</dd>
            <dt class="text-slate-400">RCS</dt>
            <dd class="text-white">{ORG.rcs}</dd>
            <dt class="text-slate-400">TVA intracommunautaire</dt>
            <dd class="text-white">{ORG.tvaIntra}</dd>
            <dt class="text-slate-400">Code APE / NAF</dt>
            <dd class="text-white">{ORG.codeApe}</dd>
            <dt class="text-slate-400">Siège social</dt>
            <dd class="text-white">{ORG.address}</dd>
            <dt class="text-slate-400">Téléphone</dt>
            <dd class="text-white">{ORG.phone}</dd>
            <dt class="text-slate-400">Email de contact général</dt>
            <dd class="text-white">
              <a
                href={`mailto:${ORG.contactEmail}`}
                class="text-purple-300 underline"
              >
                {ORG.contactEmail}
              </a>
            </dd>
            <dt class="text-slate-400">Site principal</dt>
            <dd class="text-white">
              <ExternalLink href={ORG.website}>{ORG.website}</ExternalLink>
            </dd>
          </dl>
        </Card>

        {/* 2 */}
        <Card title="2. Directeur de la publication">
          <p>
            Le directeur de la publication, au sens de l'article 93-2 de la
            loi du 29 juillet 1982, est <strong>{ORG.publicationDirector}</strong>.
          </p>
          <p>
            Contact :{" "}
            <a
              href={`mailto:${ORG.publicationDirectorEmail}`}
              class="text-purple-300 underline"
            >
              {ORG.publicationDirectorEmail}
            </a>
          </p>
        </Card>

        {/* 3 */}
        <Card title="3. Hébergeur">
          <dl class="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-x-4 gap-y-1 text-sm">
            <dt class="text-slate-400">Dénomination sociale</dt>
            <dd class="text-white">{HOSTING.provider}</dd>
            <dt class="text-slate-400">Adresse</dt>
            <dd class="text-white">{HOSTING.address}</dd>
            <dt class="text-slate-400">Localisation des serveurs</dt>
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
        <Card title="4. Service édité">
          <dl class="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-x-4 gap-y-1 text-sm">
            <dt class="text-slate-400">Nom du service</dt>
            <dd class="text-white">DnDiscord</dd>
            <dt class="text-slate-400">URL</dt>
            <dd class="text-white">
              <ExternalLink href={ORG.serviceUrl}>
                {ORG.serviceUrl}
              </ExternalLink>
            </dd>
            <dt class="text-slate-400">Nature</dt>
            <dd class="text-white">
              Plateforme web de jeu de rôle sur table virtuelle (VTT),
              intégrée comme Discord Activity.
            </dd>
            <dt class="text-slate-400">Accès</dt>
            <dd class="text-white">Via Discord (Activité) et navigateur web.</dd>
            <dt class="text-slate-400">Modèle économique</dt>
            <dd class="text-white">Freemium avec abonnements payants.</dd>
          </dl>
          <p class="pt-2">
            Conditions d'utilisation du service :{" "}
            <A href="/terms" class="text-purple-300 underline">
              Conditions générales d'utilisation
            </A>{" "}
            ·{" "}
            <A href="/privacy" class="text-purple-300 underline">
              Politique de confidentialité
            </A>{" "}
            ·{" "}
            <A href="/cookies" class="text-purple-300 underline">
              Politique cookies
            </A>
            .
          </p>
        </Card>

        {/* 5 */}
        <Card title="5. Propriété intellectuelle">
          <p>
            L'ensemble des éléments du service DnDiscord — code source,
            interfaces, design, logos, textes, graphismes, modèles 3D,
            assets originaux, bases de données, et marques{" "}
            <em>Studio I-XX</em> et <em>DnDiscord</em>{/* TODO : préciser
            le statut du dépôt INPI/EUIPO une fois effectué. */} — est la
            propriété exclusive de {ORG.name} ou de ses ayants droit, et
            protégé au titre des articles L111-1 et suivants du Code de la
            propriété intellectuelle.
          </p>
          <p>
            Toute reproduction, représentation, adaptation, modification ou
            diffusion, totale ou partielle, par quelque procédé que ce
            soit, est interdite sans autorisation écrite préalable de
            l'Éditeur, sous peine de poursuites.
          </p>
          <p>
            <strong>Licence SRD 5.2 (Creative Commons)</strong> — Les règles
            de jeu mobilisées par DnDiscord sont compatibles avec le{" "}
            <em>System Reference Document 5.2</em> publié par{" "}
            <strong>Wizards of the Coast LLC</strong> sous la licence{" "}
            <ExternalLink href="https://creativecommons.org/licenses/by/4.0/">
              Creative Commons Attribution 4.0 International (CC BY 4.0)
            </ExternalLink>
            . Attribution obligatoire :{" "}
            <em>
              « Portions of the materials used are property of Wizards of
              the Coast. ©Wizards of the Coast LLC. »
            </em>{" "}
            DnDiscord n'est pas affilié, sponsorisé ou approuvé par
            Wizards of the Coast LLC ou Hasbro.
          </p>
          <p>
            Les marques <em>Discord</em>, <em>BabylonJS</em>,{" "}
            <em>Hostinger</em>, <em>Cloudflare</em> et toutes les autres
            marques citées sont la propriété de leurs détenteurs
            respectifs.
          </p>
        </Card>

        {/* 6 */}
        <Card title="6. Crédits techniques">
          <p>Le service s'appuie sur les technologies et bibliothèques suivantes :</p>
          <ul class="list-disc list-inside space-y-1 text-sm">
            <li>
              <strong>Frontend</strong> : SolidJS, Vite, TypeScript,
              TailwindCSS, BabylonJS, draw2d, SignalR client.
            </li>
            <li>
              <strong>Backend</strong> : .NET 9, ASP.NET Core, Entity
              Framework Core, SignalR, PostgreSQL, RabbitMQ.
            </li>
            <li>
              <strong>Infrastructure</strong> : Docker, Hostinger (hébergement),
              Cloudflare (CDN + anti-DDoS).
            </li>
            <li>
              <strong>Observabilité</strong> : Seq (Datalust Ltd.),
              OpenTelemetry.
            </li>
            <li>
              <strong>Typographies</strong> : Cinzel, Inter, JetBrains Mono,
              IM Fell English SC — distribuées via{" "}
              <ExternalLink href="https://fontsource.org/">
                Fontsource
              </ExternalLink>{" "}
              sous licences respectives (SIL Open Font License 1.1).
            </li>
            <li>
              <strong>Iconographie</strong> : lucide-icons (ISC License),
              game-icons.net (CC BY 3.0).
            </li>
          </ul>
          <p>
            Ces composants restent la propriété de leurs auteurs respectifs
            et sont utilisés conformément à leurs licences.
          </p>
        </Card>

        {/* 7 */}
        <Card title="7. Signalement de contenu illicite">
          <p>
            Conformément à l'article 6-I-5 de la LCEN et au règlement (UE)
            2022/2065 (« Digital Services Act »), l'Éditeur met à
            disposition un dispositif de signalement permettant à tout
            visiteur de notifier un contenu qu'il estime illicite.
          </p>
          <p>
            <strong>Procédure</strong> — Envoyez un courriel à{" "}
            <a
              href={`mailto:${ORG.abuseEmail}`}
              class="text-purple-300 underline"
            >
              {ORG.abuseEmail}
            </a>{" "}
            en précisant :
          </p>
          <ul class="list-disc list-inside space-y-1 text-sm">
            <li>vos coordonnées (nom, prénom, e-mail) ;</li>
            <li>
              la description précise du contenu visé et sa localisation
              dans le service (URL, identifiant de campagne, nom du
              personnage ou du message) ;
            </li>
            <li>les motifs justifiant son caractère illicite ;</li>
            <li>
              une déclaration sur l'honneur attestant de la bonne foi du
              signalement.
            </li>
          </ul>
          <p>
            L'Éditeur accuse réception dans les meilleurs délais et traite
            le signalement de façon diligente, non arbitraire et objective.
            Les signalements manifestement abusifs pourront être rejetés.
          </p>
          <p>
            <strong>PHAROS</strong> — Pour les contenus pénalement
            répréhensibles, un signalement peut également être effectué sur
            la plateforme officielle{" "}
            <ExternalLink href={EXT.pharosUrl}>
              {EXT.pharosUrl.replace(/^https?:\/\//, "")}
            </ExternalLink>
            .
          </p>
          <p>
            L'Éditeur coopère avec les autorités compétentes dans les
            conditions prévues par la loi.
          </p>
        </Card>

        {/* 8 */}
        <Card title="8. Données personnelles">
          <p>
            Le traitement de vos données personnelles est décrit dans la{" "}
            <A href="/privacy" class="text-purple-300 underline">
              Politique de confidentialité
            </A>
            . Contact RGPD :{" "}
            <a
              href={`mailto:${ORG.privacyEmail}`}
              class="text-purple-300 underline"
            >
              {ORG.privacyEmail}
            </a>{" "}
            — DPO :{" "}
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
        <Card title="9. Médiation de la consommation">
          <p>
            Conformément aux articles L611-1 et suivants du Code de la
            consommation, l'Utilisateur consommateur peut recourir
            gratuitement à un médiateur de la consommation en cas de litige
            non résolu par une réclamation préalable auprès de l'Éditeur.
          </p>
          <p>
            <strong>Médiateur désigné : </strong>
            {MEDIATOR.name} —{" "}
            <ExternalLink href={MEDIATOR.url}>{MEDIATOR.url}</ExternalLink>
            .{/* TODO : désigner un médiateur agréé CECMC. */}
          </p>
          <p>
            Plateforme européenne de règlement en ligne des litiges :{" "}
            <ExternalLink href={EXT.odrUrl}>
              {EXT.odrUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </ExternalLink>
            .
          </p>
        </Card>

        {/* 10 */}
        <Card title="10. Droit applicable et juridiction">
          <p>
            Les présentes mentions légales sont régies par le droit
            français. Pour les relations entre professionnels, les
            tribunaux de Lyon sont seuls compétents. Pour les consommateurs,
            le tribunal compétent est celui du lieu de domicile du
            consommateur ou du lieu d'exécution du contrat (art. R631-3 du
            Code de la consommation).
          </p>
        </Card>

        <nav class="flex flex-wrap items-center gap-x-3 gap-y-2 pt-6 text-sm text-slate-400">
          <A href="/privacy" class="text-purple-300 hover:text-purple-200 underline underline-offset-2">
            Politique de confidentialité
          </A>
          <span class="text-slate-600">·</span>
          <A href="/terms" class="text-purple-300 hover:text-purple-200 underline underline-offset-2">
            Conditions générales
          </A>
          <span class="text-slate-600">·</span>
          <A href="/cookies" class="text-purple-300 hover:text-purple-200 underline underline-offset-2">
            Politique cookies
          </A>
        </nav>
        <p class="pt-2 text-xs text-slate-500">
          En vigueur depuis le {ORG.lastUpdated}.
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
