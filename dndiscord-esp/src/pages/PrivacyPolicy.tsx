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

// Les icônes sont des factories pour être instanciées au rendu (dans un
// createRoot), et non au niveau module — sinon Solid logge « computations
// created outside a `createRoot` or `render` will never be disposed ».
const SECTIONS: Section[] = [
  { id: "tldr", title: "En bref", icon: () => <Sparkles class="w-4 h-4" /> },
  { id: "intro", title: "Préambule", icon: () => <ShieldCheck class="w-4 h-4" /> },
  { id: "controller", title: "Responsable", icon: () => <UserCheck class="w-4 h-4" /> },
  { id: "definitions", title: "Définitions", icon: () => <BookOpen class="w-4 h-4" /> },
  { id: "data", title: "Données collectées", icon: () => <Database class="w-4 h-4" /> },
  { id: "purposes", title: "Finalités & bases légales", icon: () => <ShieldCheck class="w-4 h-4" /> },
  { id: "recipients", title: "Destinataires", icon: () => <Users class="w-4 h-4" /> },
  { id: "transfers", title: "Transferts hors UE", icon: () => <Globe class="w-4 h-4" /> },
  { id: "retention", title: "Durée de conservation", icon: () => <Clock class="w-4 h-4" /> },
  { id: "rights", title: "Vos droits", icon: () => <UserCheck class="w-4 h-4" /> },
  { id: "cookies", title: "Stockage local / cookies", icon: () => <Cookie class="w-4 h-4" /> },
  { id: "security", title: "Sécurité", icon: () => <Lock class="w-4 h-4" /> },
  { id: "minors", title: "Mineurs", icon: () => <AlertTriangle class="w-4 h-4" /> },
  { id: "changes", title: "Modifications", icon: () => <Clock class="w-4 h-4" /> },
  { id: "contact", title: "Contact & réclamation", icon: () => <Mail class="w-4 h-4" /> },
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
          <span class="hidden sm:inline">Retour</span>
        </button>
        <h1 class="font-display text-xl text-white tracking-wide flex items-center gap-2">
          <ShieldCheck class="w-5 h-5 text-purple-400" />
          Politique de confidentialité
        </h1>
        <div class="w-24" />
      </header>

      <main class="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-8 pb-20 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8">
        {/* Table of contents */}
        <aside class="lg:sticky lg:top-24 lg:self-start">
          <nav
            aria-label="Sommaire"
            class="bg-game-dark/60 backdrop-blur-xl border border-white/10 rounded-2xl p-3"
          >
            <p class="text-xs uppercase tracking-wider text-slate-400 px-2 py-1">
              Sommaire
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
          {/* En bref — résumé utilisateur-friendly */}
          <section
            id="tldr"
            class="scroll-mt-24 rounded-2xl border border-purple-500/30 bg-purple-500/5 p-6 space-y-3"
          >
            <h2 class="font-display text-lg sm:text-xl text-white flex items-center gap-2">
              <Sparkles class="w-5 h-5 text-purple-300" />
              En bref
            </h2>
            <ul class="text-slate-200 text-sm leading-relaxed space-y-1.5 list-disc list-inside">
              <li>
                Nous n'utilisons <strong>aucun cookie publicitaire</strong>,
                aucun traceur tiers, aucun outil d'analyse externe.
              </li>
              <li>
                Vos données sont hébergées <strong>dans l'Union européenne</strong>{" "}
                (datacenter Hostinger en Allemagne).
              </li>
              <li>
                Nous collectons uniquement ce qui est nécessaire pour faire
                fonctionner le jeu : profil Discord (identifiant, pseudo,
                avatar, email), personnages, campagnes, messages en jeu.
              </li>
              <li>
                Vous pouvez <strong>exporter</strong> ou <strong>supprimer</strong>{" "}
                toutes vos données en un clic depuis les paramètres du compte.
              </li>
              <li>
                Vous avez tous les droits RGPD (accès, rectification,
                effacement, portabilité, opposition) et pouvez saisir la CNIL.
              </li>
            </ul>
          </section>

          <Card id="intro" title="1. Préambule" icon={<ShieldCheck class="w-5 h-5 text-purple-400" />}>
            <p>
              DnDiscord est une application de jeu de rôle (Donjons & Dragons) qui
              s'exécute en tant qu'<strong>Activité Discord</strong> (iframe intégrée
              dans le client Discord). Elle permet à des joueurs de créer des
              personnages, des campagnes et de mener des parties multijoueurs en
              temps réel.
            </p>
            <p>
              La présente politique décrit la manière dont nous collectons,
              utilisons, partageons et protégeons vos données personnelles, en
              conformité avec le{" "}
              <strong>
                Règlement (UE) 2016/679 (RGPD)
              </strong>
              , la loi française « Informatique et Libertés » modifiée, la{" "}
              <strong>Directive ePrivacy</strong> (via les recommandations CNIL),
              ainsi qu'avec la{" "}
              <ExternalLink href={EXT.discordDevPolicy}>
                Discord Developer Policy
              </ExternalLink>{" "}
              et la{" "}
              <ExternalLink href={EXT.discordPrivacy}>
                Politique de confidentialité de Discord
              </ExternalLink>
              .
            </p>
          </Card>

          <Card id="controller" title="2. Responsable du traitement" icon={<UserCheck class="w-5 h-5 text-purple-400" />}>
            <dl class="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-x-4 gap-y-2 text-sm">
              <dt class="text-slate-400">Dénomination</dt>
              <dd class="text-white">{ORG.name}</dd>
              <dt class="text-slate-400">Forme juridique</dt>
              <dd class="text-white">{ORG.legalForm}</dd>
              <dt class="text-slate-400">Capital social</dt>
              <dd class="text-white">{ORG.capital}</dd>
              <dt class="text-slate-400">SIREN / SIRET</dt>
              <dd class="text-white">
                {ORG.siren} / {ORG.siret}
              </dd>
              <dt class="text-slate-400">RCS</dt>
              <dd class="text-white">{ORG.rcs}</dd>
              <dt class="text-slate-400">Code APE</dt>
              <dd class="text-white">{ORG.codeApe}</dd>
              <dt class="text-slate-400">Siège social</dt>
              <dd class="text-white">{ORG.address}</dd>
              <dt class="text-slate-400">Site</dt>
              <dd class="text-white">
                <ExternalLink href={ORG.website}>{ORG.website}</ExternalLink>
              </dd>
              <dt class="text-slate-400">Représentant légal</dt>
              <dd class="text-white">{ORG.legalRepresentative}</dd>
              <dt class="text-slate-400">Contact général</dt>
              <dd class="text-white">
                <a href={`mailto:${ORG.contactEmail}`} class="text-purple-300 hover:text-purple-200 underline">
                  {ORG.contactEmail}
                </a>
              </dd>
              <dt class="text-slate-400">Contact RGPD</dt>
              <dd class="text-white">
                <a href={`mailto:${ORG.privacyEmail}`} class="text-purple-300 hover:text-purple-200 underline">
                  {ORG.privacyEmail}
                </a>
              </dd>
              <dt class="text-slate-400">Délégué à la protection des données</dt>
              <dd class="text-white">
                <a href={`mailto:${ORG.dpoEmail}`} class="text-purple-300 hover:text-purple-200 underline">
                  {ORG.dpoEmail}
                </a>
              </dd>
              <dt class="text-slate-400">Hébergeur</dt>
              <dd class="text-white">
                {HOSTING.provider} — {HOSTING.serverLocation}
              </dd>
            </dl>
          </Card>

          <Card id="definitions" title="3. Définitions" icon={<BookOpen class="w-5 h-5 text-purple-400" />}>
            <p>
              Au sens de l'article 4 du RGPD et pour faciliter la lecture de
              la présente politique, les termes suivants ont la
              signification indiquée ci-dessous.
            </p>
            <dl class="grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-x-4 gap-y-3 text-sm">
              <dt class="text-purple-200 font-medium">Donnée à caractère personnel</dt>
              <dd class="text-slate-300">
                Toute information se rapportant à une personne physique
                identifiée ou identifiable (pseudonyme, identifiant, adresse
                IP, personnage associé à un compte…).
              </dd>
              <dt class="text-purple-200 font-medium">Traitement</dt>
              <dd class="text-slate-300">
                Toute opération effectuée sur des données personnelles :
                collecte, stockage, modification, transmission, effacement,
                etc.
              </dd>
              <dt class="text-purple-200 font-medium">Responsable de traitement</dt>
              <dd class="text-slate-300">
                L'entité qui détermine les finalités et les moyens du
                traitement. Pour DnDiscord, il s'agit de{" "}
                <strong>{ORG.name}</strong>.
              </dd>
              <dt class="text-purple-200 font-medium">Sous-traitant</dt>
              <dd class="text-slate-300">
                Personne morale qui traite des données pour le compte du
                responsable de traitement (ex. Hostinger pour l'hébergement).
              </dd>
              <dt class="text-purple-200 font-medium">Utilisateur</dt>
              <dd class="text-slate-300">
                Toute personne physique utilisant le service DnDiscord,
                authentifiée via Discord OAuth.
              </dd>
              <dt class="text-purple-200 font-medium">Consentement</dt>
              <dd class="text-slate-300">
                Manifestation de volonté libre, spécifique, éclairée et
                univoque par laquelle vous acceptez un traitement de vos
                données (art. 4.11 RGPD).
              </dd>
              <dt class="text-purple-200 font-medium">DPO</dt>
              <dd class="text-slate-300">
                Délégué à la Protection des Données : point de contact
                dédié aux questions RGPD ({ORG.dpoEmail}).
              </dd>
              <dt class="text-purple-200 font-medium">Activité Discord</dt>
              <dd class="text-slate-300">
                Application web intégrée comme iframe dans le client
                Discord via l'Embedded App SDK.
              </dd>
            </dl>
          </Card>

          <Card id="data" title="4. Données que nous collectons" icon={<Database class="w-5 h-5 text-purple-400" />}>
            <h3 class="text-white font-semibold text-base mt-2">4.1 Données reçues de Discord via OAuth 2.0</h3>
            <p>
              Lorsque vous vous connectez via Discord, l'application demande votre
              accord pour accéder aux <em>scopes</em> suivants :{" "}
              <code class="px-1.5 py-0.5 bg-black/40 rounded text-xs">identify</code>,{" "}
              <code class="px-1.5 py-0.5 bg-black/40 rounded text-xs">email</code>,{" "}
              <code class="px-1.5 py-0.5 bg-black/40 rounded text-xs">guilds</code>. Discord
              nous transmet alors :
            </p>
            <ul class="list-disc list-inside text-slate-300 space-y-1 text-sm">
              <li>votre identifiant numérique Discord (« Discord ID ») ;</li>
              <li>votre pseudonyme (username) et discriminant ;</li>
              <li>l'adresse e-mail associée à votre compte Discord ;</li>
              <li>le hash de votre avatar (pour afficher votre image de profil) ;</li>
              <li>
                la liste des serveurs (guilds) dont vous êtes membre{" "}
                <em>pour afficher les invitations de campagnes</em> — aucune donnée
                interne de ces serveurs n'est lue.
              </li>
            </ul>

            <h3 class="text-white font-semibold text-base mt-5">4.2 Données que vous créez dans le service</h3>
            <ul class="list-disc list-inside text-slate-300 space-y-1 text-sm">
              <li>
                <strong>Personnages</strong> : nom, race, classe, niveau,
                caractéristiques (force, dextérité…), points de vie, inventaire,
                biographie.
              </li>
              <li>
                <strong>Campagnes</strong> : nom, description, arbre narratif,
                paramètres, code d'invitation, liste des membres.
              </li>
              <li>
                <strong>Cartes</strong> de jeu que vous dessinez dans l'éditeur.
              </li>
              <li>
                <strong>Messages et dialogues</strong> en jeu : chat de
                campagne, notes privées de maître du jeu.
              </li>
              <li>
                <strong>Historique de partie</strong> : snapshots d'état de
                campagne, nœuds visités, choix narratifs.
              </li>
            </ul>

            <h3 class="text-white font-semibold text-base mt-5">4.3 Données techniques</h3>
            <ul class="list-disc list-inside text-slate-300 space-y-1 text-sm">
              <li>
                <strong>Jeton d'authentification (JWT)</strong> généré par nos
                serveurs, signé, valable 7 jours, stocké dans le{" "}
                <code class="px-1.5 py-0.5 bg-black/40 rounded text-xs">localStorage</code>{" "}
                de votre navigateur.
              </li>
              <li>
                <strong>Journaux techniques</strong> (logs) : identifiant
                utilisateur, horodatage, type d'action (création/modification/suppression),
                erreurs applicatives. Conservés dans un outil de journalisation
                structurée (Seq) hébergé avec l'application.
              </li>
              <li>
                Adresse IP et en-têtes HTTP standards, traités de façon
                éphémère par notre reverse-proxy aux fins de sécurité et
                d'anti-abus.
              </li>
            </ul>

            <h3 class="text-white font-semibold text-base mt-5">4.4 Données de paiement (abonnements)</h3>
            <p>
              DnDiscord est pensé comme un service{" "}
              <strong>freemium</strong> : un socle gratuit et, à terme, des
              abonnements payants. <strong>Aucun paiement n'est encore
              activé</strong> à la date de la présente politique. Lorsque
              les abonnements seront mis en service, les données de
              paiement (numéro de carte, cryptogramme, expiration) ne
              transiteront <strong>jamais</strong> par nos serveurs :
              elles seront saisies directement sur l'infrastructure d'un
              prestataire certifié <strong>PCI-DSS</strong> (par exemple
              Stripe). Nous ne recevrions alors que des métadonnées de
              transaction (identifiant de paiement, horodatage, statut,
              4 derniers chiffres de la carte, montant, devise) nécessaires
              à la facturation et à la comptabilité.
            </p>

            <p class="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3 text-sm text-slate-300 mt-4">
              <strong class="text-purple-200">Nous ne collectons pas</strong> : numéros de carte bancaire, données de santé, opinions politiques/religieuses/syndicales, localisation géographique précise, empreinte biométrique. Aucun outil publicitaire ni analytique tiers (Google Analytics, Meta Pixel, etc.) n'est intégré. Aucun profilage à visée marketing n'est effectué, a fortiori sur les mineurs.
            </p>
          </Card>

          <Card id="purposes" title="5. Finalités et bases légales" icon={<ShieldCheck class="w-5 h-5 text-purple-400" />}>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-left border-b border-white/10 text-slate-400">
                    <th class="py-2 pr-3 font-medium">Finalité</th>
                    <th class="py-2 pr-3 font-medium">Base légale (art. 6 RGPD)</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                  <LegalRow
                    purpose="Authentification via Discord, création et maintien du compte utilisateur"
                    basis="Exécution du contrat (art. 6.1.b)"
                  />
                  <LegalRow
                    purpose="Fourniture du service de jeu : sauvegarde et synchronisation des personnages, campagnes, cartes et parties"
                    basis="Exécution du contrat (art. 6.1.b)"
                  />
                  <LegalRow
                    purpose="Communication temps réel (multijoueur, chat, dialogues)"
                    basis="Exécution du contrat (art. 6.1.b)"
                  />
                  <LegalRow
                    purpose="Gestion des abonnements payants, facturation et encaissement"
                    basis="Exécution du contrat (art. 6.1.b)"
                  />
                  <LegalRow
                    purpose="Conservation des pièces comptables liées aux paiements (10 ans — art. L123-22 Code de commerce)"
                    basis="Obligation légale (art. 6.1.c)"
                  />
                  <LegalRow
                    purpose="Sécurité du service, prévention de la fraude, détection d'abus, journalisation technique"
                    basis="Intérêt légitime (art. 6.1.f) — balance documentée favorable à l'utilisateur"
                  />
                  <LegalRow
                    purpose="Réponse à vos demandes RGPD (accès, rectification, effacement…) et aux réquisitions judiciaires"
                    basis="Obligation légale (art. 6.1.c)"
                  />
                  <LegalRow
                    purpose="Amélioration du produit à partir de statistiques agrégées anonymisées"
                    basis="Intérêt légitime (art. 6.1.f) — aucune donnée nominative"
                  />
                  <LegalRow
                    purpose="Envoi de notifications fonctionnelles (invitations de campagne, rappels de session) via le bot Discord"
                    basis="Exécution du contrat (art. 6.1.b)"
                  />
                </tbody>
              </table>
            </div>
          </Card>

          <Card id="recipients" title="6. Destinataires des données" icon={<Users class="w-5 h-5 text-purple-400" />}>
            <p>
              Vos données sont traitées uniquement par l'équipe DnDiscord et par les
              <strong> sous-traitants techniques strictement nécessaires </strong>
              au fonctionnement du service :
            </p>
            <ul class="list-disc list-inside text-slate-300 space-y-2 text-sm">
              <li>
                <strong>{HOSTING.provider}</strong> — hébergeur de
                l'infrastructure applicative (conteneurs Docker, base
                PostgreSQL, message bus RabbitMQ). Siège social :{" "}
                {HOSTING.address}. Les serveurs utilisés pour DnDiscord sont
                situés dans un <strong>{HOSTING.serverLocation}</strong>.
                Domaine de production : <code>{ORG.productionDomain}</code>.{" "}
                <ExternalLink href={HOSTING.contactUrl}>
                  Contacter Hostinger
                </ExternalLink>
                .
              </li>
              <li>
                <strong>Discord Inc.</strong> (États-Unis) — fournisseur
                d'authentification OAuth 2.0, plateforme Activité et hébergement
                du client qui intègre DnDiscord. Voir la{" "}
                <ExternalLink href={EXT.discordPrivacy}>
                  Politique de confidentialité de Discord
                </ExternalLink>
                .
              </li>
              <li>
                <strong>Cloudflare, Inc.</strong> (États-Unis, serveurs
                européens) — réseau de distribution de contenu (CDN) et
                protection contre les attaques par déni de service (DDoS).
                Traite l'adresse IP et des métadonnées de requête de manière
                transitoire.
              </li>
              <li>
                <strong>Prestataire de paiement (PCI-DSS)</strong> — par
                exemple <em>Stripe Payments Europe, Ltd.</em> (Irlande, UE)
                — traite les données de carte bancaire directement sur son
                infrastructure, sans exposition à nos serveurs. Le prestataire
                exact sera confirmé dans cette politique dès son
                intégration.{/* TODO RGPD : figer le prestataire paiement. */}
              </li>
              <li>
                <strong>Datalust Seq</strong> — agrégation et recherche de
                journaux techniques structurés, déployé sur la même
                infrastructure européenne que l'application (pas
                d'exfiltration hors UE).
              </li>
              <li>
                <strong>OpenTelemetry</strong> — traçage distribué des
                requêtes pour diagnostic et performance. Les traces sont
                agrégées dans l'infrastructure européenne de l'application.
              </li>
              <li>
                <strong>Autorités publiques</strong> — uniquement sur
                réquisition judiciaire ou administrative valablement formée
                (autorité judiciaire, CNIL, services de police/gendarmerie).
              </li>
            </ul>
            <p class="text-sm text-slate-400 mt-3 bg-purple-500/5 border border-purple-500/20 rounded-lg p-3">
              <strong class="text-purple-200">Engagement explicite :</strong>{" "}
              Studio I-XX SAS ne vend, ne loue, ni ne cède vos données à des
              tiers à des fins commerciales, publicitaires ou de prospection.
            </p>
            <p class="text-sm text-slate-400 mt-3">
              <strong>Aucune donnée</strong> n'est vendue, louée ou partagée à
              des fins commerciales. Les autres joueurs et le maître du jeu
              d'une campagne voient uniquement les données que vous choisissez
              de rendre visibles dans cette campagne (pseudonyme, personnage,
              messages).
            </p>
          </Card>

          <Card id="transfers" title="7. Transferts hors Union européenne" icon={<Globe class="w-5 h-5 text-purple-400" />}>
            <p>
              <strong>Par défaut, vos données restent dans l'Espace économique
              européen (EEE)</strong>. L'infrastructure applicative, la base
              de données et les journaux sont hébergés chez Hostinger dans
              un <strong>datacenter en Allemagne</strong>. Le prestataire de
              paiement que nous intégrons est établi dans l'Union européenne
              (Irlande pour Stripe Payments Europe Ltd.).
            </p>
            <p>
              Des transferts hors UE ont lieu <strong>uniquement</strong> vers
              deux sous-traitants américains, de façon limitée et encadrée :
            </p>
            <ul class="list-disc list-inside text-slate-300 space-y-1 text-sm">
              <li>
                <strong>Discord Inc.</strong> (États-Unis) — authentification
                OAuth et exécution de l'Activité dans le client Discord.
              </li>
              <li>
                <strong>Cloudflare, Inc.</strong> (États-Unis) — CDN et
                protection anti-DDoS, avec <em>edge servers</em> principaux
                en Europe.
              </li>
            </ul>
            <p>
              Ces transferts sont encadrés par l'adhésion de ces entités au{" "}
              <ExternalLink href={EXT.dpfUrl}>
                EU-US Data Privacy Framework
              </ExternalLink>{" "}
              (décision d'adéquation de la Commission européenne du 10 juillet
              2023) et, à titre subsidiaire, par les <em>Clauses
              Contractuelles Types</em> (CCT) adoptées par la Commission
              européenne le 4 juin 2021, pour toute donnée qui sortirait du
              cadre du DPF.
            </p>
          </Card>

          <Card id="retention" title="8. Durées de conservation" icon={<Clock class="w-5 h-5 text-purple-400" />}>
            <p class="text-sm text-slate-400">
              Durées conformes au plan de sécurité interne de Studio I-XX SAS
              (révision 2026-04). Les logs contenant des identifiants utilisateur
              sont purgés ou pseudonymisés à l'échéance indiquée.
            </p>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-left border-b border-white/10 text-slate-400">
                    <th class="py-2 pr-3 font-medium">Donnée</th>
                    <th class="py-2 pr-3 font-medium">Durée</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                  <RetentionRow label="Compte utilisateur, personnages, campagnes que vous possédez" duration="Jusqu'à suppression du compte ou inactivité de 2 ans (purge automatique)" />
                  <RetentionRow label="Jeton d'authentification (JWT)" duration="7 jours" />
                  <RetentionRow label="Session multijoueur (sessionStorage)" duration="Jusqu'à fermeture de l'onglet" />
                  <RetentionRow label="Journaux de sécurité" duration="1 an" />
                  <RetentionRow label="Journaux applicatifs (Seq)" duration="90 jours" />
                  <RetentionRow label="Journaux d'accès HTTP" duration="90 jours" />
                  <RetentionRow label="Journaux d'audit (opérations sensibles)" duration="2 ans" />
                  <RetentionRow label="Journaux de debug" duration="7 jours" />
                  <RetentionRow label="Sauvegardes base de données (quotidiennes)" duration="30 jours" />
                  <RetentionRow label="Sauvegardes de configuration (hebdomadaires)" duration="30 jours" />
                  <RetentionRow label="Données nécessaires à une procédure en cours" duration="Le temps strictement nécessaire, puis suppression" />
                </tbody>
              </table>
            </div>
          </Card>

          <Card id="rights" title="9. Vos droits" icon={<UserCheck class="w-5 h-5 text-purple-400" />}>
            <p>Conformément au RGPD, vous disposez des droits suivants :</p>
            <ul class="list-disc list-inside text-slate-300 space-y-1.5 text-sm">
              <li>
                <strong>Accès</strong> à vos données (art. 15) — via le bouton
                « Exporter mes données » dans les paramètres du compte.
              </li>
              <li>
                <strong>Rectification</strong> (art. 16) — modifiez vos
                personnages, campagnes, profil depuis l'application.
              </li>
              <li>
                <strong>Effacement</strong> / droit à l'oubli (art. 17) — via le
                bouton « Supprimer mon compte » dans les paramètres.
              </li>
              <li>
                <strong>Limitation</strong> du traitement (art. 18).
              </li>
              <li>
                <strong>Portabilité</strong> (art. 20) — export au format JSON
                réutilisable via le bouton « Exporter mes données ».
              </li>
              <li>
                <strong>Opposition</strong> (art. 21) à un traitement fondé sur
                l'intérêt légitime.
              </li>
              <li>
                <strong>Retirer votre consentement</strong> à tout moment en
                révoquant l'accès de l'application dans les paramètres Discord
                (Paramètres utilisateur → Autorisations).
              </li>
              <li>
                <strong>Définir des directives</strong> relatives au sort de
                vos données après votre décès (loi « Informatique et Libertés »,
                art. 85).
              </li>
            </ul>
            <p class="text-sm text-slate-400 mt-4">
              Pour exercer l'un de ces droits, contactez-nous à{" "}
              <a href={`mailto:${ORG.dpoEmail}`} class="text-purple-300 underline">
                {ORG.dpoEmail}
              </a>
              . Nous répondons dans un délai d'un mois (prolongeable de deux mois
              en cas de demande complexe, conformément à l'article 12 RGPD).
            </p>
          </Card>

          <Card id="cookies" title="10. Stockage local et cookies" icon={<Cookie class="w-5 h-5 text-purple-400" />}>
            <p>
              DnDiscord n'utilise <strong>aucun cookie HTTP</strong> et aucun
              traceur tiers. L'application s'appuie exclusivement sur le{" "}
              <code class="px-1.5 py-0.5 bg-black/40 rounded text-xs">localStorage</code>{" "}
              et le{" "}
              <code class="px-1.5 py-0.5 bg-black/40 rounded text-xs">sessionStorage</code>{" "}
              de votre navigateur pour :
            </p>
            <ul class="list-disc list-inside text-slate-300 space-y-1 text-sm">
              <li>
                conserver votre jeton d'authentification (exempté de consentement
                en tant que traceur d'authentification — CNIL) ;
              </li>
              <li>
                mémoriser vos préférences d'interface : qualité graphique,
                volume audio, état du tutoriel (exemptés de consentement en tant
                que personnalisation d'interface — CNIL) ;
              </li>
              <li>
                mettre en cache vos personnages et cartes pour accélérer leur
                chargement (donnée fonctionnelle strictement nécessaire).
              </li>
            </ul>
            <p class="text-sm text-slate-400 mt-3">
              Vous pouvez à tout moment consulter le détail de ces éléments et
              effacer vos préférences locales depuis le bouton ci-dessous.
            </p>
            <button
              onClick={() => consentStore.openPreferences()}
              class="mt-3 px-4 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-200 text-sm transition-colors"
            >
              Gérer mon stockage local
            </button>
          </Card>

          <Card id="security" title="11. Sécurité" icon={<Lock class="w-5 h-5 text-purple-400" />}>
            <ul class="list-disc list-inside text-slate-300 space-y-1 text-sm">
              <li>
                Communications chiffrées en <strong>TLS 1.3</strong> de bout en
                bout, redirection HTTP→HTTPS systématique.
              </li>
              <li>
                Chiffrement des données au repos en <strong>AES-256</strong>{" "}
                (base PostgreSQL et sauvegardes).
              </li>
              <li>
                Jeton d'authentification signé (HMAC-SHA256), clé secrète
                stockée uniquement côté serveur et injectée par configuration,
                vérification de signature systématique à chaque requête.
              </li>
              <li>
                Aucun mot de passe stocké : l'authentification est entièrement
                déléguée à Discord via OAuth 2.0.
              </li>
              <li>
                Accès à la base de données restreint par règles réseau et par
                comptes de service distincts, connexions chiffrées imposées.
              </li>
              <li>
                Protection contre les attaques volumétriques (DDoS) et le
                <em> rate limiting </em> applicatif via Cloudflare.
              </li>
              <li>
                Content Security Policy (CSP) restreignant l'intégration en
                <em> iframe</em> aux domaines Discord uniquement.
              </li>
              <li>
                Gestion des vulnérabilités : veille dépendances continue,
                correctifs appliqués dans les meilleurs délais.
              </li>
            </ul>
          </Card>

          <Card id="minors" title="12. Mineurs" icon={<AlertTriangle class="w-5 h-5 text-purple-400" />}>
            <p>
              <strong>Âge minimum d'utilisation de DnDiscord : 15 ans</strong>,
              en application de l'article 8 du RGPD et de l'article 7-1 de la
              loi n° 78-17 du 6 janvier 1978 (« Informatique et Libertés »).
              En France, 15 ans est l'âge du consentement numérique autonome.
            </p>
            <p>
              Pour les utilisateurs âgés de <strong>moins de 15 ans</strong>,
              le traitement n'est licite que si le consentement est donné ou
              autorisé par le(s) titulaire(s) de l'autorité parentale. Par
              ailleurs, Discord applique son propre seuil (13 ans, voir les{" "}
              <ExternalLink href={EXT.discordTerms}>
                Conditions d'utilisation de Discord
              </ExternalLink>
              ) : DnDiscord s'appuie sur l'authentification Discord comme
              première barrière d'âge.
            </p>
            <p>
              Les titulaires de l'autorité parentale peuvent exercer tous les
              droits RGPD (accès, rectification, effacement, portabilité,
              opposition) au nom du mineur en écrivant à{" "}
              <a href={`mailto:${ORG.dpoEmail}`} class="text-purple-300 underline">
                {ORG.dpoEmail}
              </a>
              . Les informations délivrées aux mineurs sont rédigées en{" "}
              <strong>langage simple et accessible</strong> conformément à
              l'article 12.1 du RGPD. <strong>Aucun profilage à visée
              marketing</strong> n'est effectué sur les utilisateurs mineurs.
            </p>
            <p>
              Si vous pensez qu'un enfant de moins de 15 ans a utilisé le
              service sans autorisation parentale, contactez-nous
              immédiatement à l'adresse ci-dessus : nous procéderons à la
              suppression sous <strong>72 heures</strong> des données
              concernées, sauf consentement parental ultérieur.
            </p>
          </Card>

          <Card id="changes" title="13. Modifications de la politique" icon={<Clock class="w-5 h-5 text-purple-400" />}>
            <p>
              Cette politique peut évoluer (nouvelle fonctionnalité, nouveau
              sous-traitant, changement légal). La date de dernière mise à jour
              figure en haut du document. En cas de modification substantielle
              (nouvelle finalité, nouveau destinataire hors UE), vous serez
              informé par une notification dans l'application avant l'entrée en
              vigueur.
            </p>
          </Card>

          <Card id="contact" title="14. Contact et réclamation" icon={<Mail class="w-5 h-5 text-purple-400" />}>
            <p>
              Pour toute question relative à vos données personnelles ou pour
              exercer vos droits RGPD, écrivez à :
            </p>
            <ul class="text-white space-y-1 text-sm">
              <li>
                <span class="text-slate-400">Contact RGPD : </span>
                <a href={`mailto:${ORG.privacyEmail}`} class="text-purple-300 underline">
                  {ORG.privacyEmail}
                </a>
              </li>
              <li>
                <span class="text-slate-400">Délégué à la protection des données : </span>
                <a href={`mailto:${ORG.dpoEmail}`} class="text-purple-300 underline">
                  {ORG.dpoEmail}
                </a>
              </li>
              <li>
                <span class="text-slate-400">Adresse postale : </span>
                {ORG.name}, {ORG.address}
              </li>
            </ul>
            <p class="text-sm mt-4">
              Si vous estimez, après nous avoir contactés, que vos droits
              « Informatique et Libertés » ne sont pas respectés, vous avez le
              droit d'introduire une réclamation auprès de l'autorité de
              contrôle française :
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
              Conditions générales
            </A>
            <span class="text-slate-600">·</span>
            <A href="/legal" class="text-purple-300 hover:text-purple-200 underline underline-offset-2">
              Mentions légales
            </A>
            <span class="text-slate-600">·</span>
            <A href="/cookies" class="text-purple-300 hover:text-purple-200 underline underline-offset-2">
              Politique cookies
            </A>
          </nav>
          <p class="pt-2 text-xs text-slate-500">
            En vigueur depuis le {ORG.lastUpdated}.
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
        /* Les règles typographiques sont portées directement par les
           classes Tailwind des Card (text-slate-300 leading-relaxed).
           Pas besoin de :global() — de toute façon le support est
           incomplet côté solid-styled-jsx. */
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
