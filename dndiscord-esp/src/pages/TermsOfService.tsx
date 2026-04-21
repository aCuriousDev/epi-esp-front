import { useNavigate } from "@solidjs/router";
import { ArrowLeft, Scale } from "lucide-solid";
import { onMount, type JSX } from "solid-js";
import {
  LEGAL_ORG as ORG,
  LEGAL_HOSTING as HOSTING,
  LEGAL_MEDIATOR as MEDIATOR,
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
          <span class="hidden sm:inline">Retour</span>
        </button>
        <h1 class="font-display text-xl text-white tracking-wide flex items-center gap-2">
          <Scale class="w-5 h-5 text-purple-400" />
          Conditions générales d'utilisation
        </h1>
        <div class="w-24" />
      </header>

      <main class="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-20 space-y-6">
        {/* 1 */}
        <Card title="1. Préambule et identification">
          <p>
            Les présentes Conditions Générales d'Utilisation (ci-après les
            « <strong>CGU</strong> ») régissent l'utilisation du service{" "}
            <strong>DnDiscord</strong>, plateforme web de jeu de rôle sur
            table virtuelle (VTT) intégrée en tant qu'Activité Discord,
            éditée par :
          </p>
          <dl class="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-x-4 gap-y-1 text-sm bg-white/5 border border-white/10 rounded-xl p-4">
            <dt class="text-slate-400">Éditeur</dt>
            <dd class="text-white">{ORG.name} — {ORG.legalForm}</dd>
            <dt class="text-slate-400">Capital social</dt>
            <dd class="text-white">{ORG.capital}</dd>
            <dt class="text-slate-400">SIREN / SIRET</dt>
            <dd class="text-white">{ORG.siren} / {ORG.siret}</dd>
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
            <dt class="text-slate-400">Contact général</dt>
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
            Conformément à l'article 6-III de la loi n° 2004-575 du 21 juin
            2004 pour la confiance dans l'économie numérique (« LCEN »),
            l'hébergeur du service est{" "}
            <strong>{HOSTING.provider}</strong>, {HOSTING.address}. Les
            serveurs utilisés pour DnDiscord sont situés dans un{" "}
            <strong>{HOSTING.serverLocation}</strong>.
          </p>
          <p>
            L'utilisation de DnDiscord est également soumise aux{" "}
            <ExternalLink href="https://discord.com/terms">
              Conditions d'utilisation de Discord
            </ExternalLink>{" "}
            et aux{" "}
            <ExternalLink href="https://discord.com/guidelines">
              Règles de la communauté Discord
            </ExternalLink>
            , aux{" "}
            <ExternalLink href="https://support-dev.discord.com/hc/en-us/articles/8562894815383-Discord-Developer-Terms-of-Service">
              Discord Developer Terms of Service
            </ExternalLink>{" "}
            et à la{" "}
            <ExternalLink href="https://support-dev.discord.com/hc/en-us/articles/8563934450327-Discord-Developer-Policy">
              Discord Developer Policy
            </ExternalLink>
            . En cas de contradiction irréductible, les règles propres à la
            plateforme Discord prévalent pour tout ce qui relève de ladite
            plateforme.
          </p>
        </Card>

        {/* 2 */}
        <Card title="2. Définitions">
          <ul class="list-disc list-inside space-y-1 text-sm">
            <li>
              <strong>Service</strong> : la plateforme DnDiscord (Activité
              Discord, API, interfaces web, bot associé).
            </li>
            <li>
              <strong>Utilisateur</strong> : toute personne accédant au
              Service, à titre gratuit ou dans le cadre d'un abonnement.
            </li>
            <li>
              <strong>Compte</strong> : espace personnel ouvert à
              l'Utilisateur via l'authentification Discord OAuth 2.0.
            </li>
            <li>
              <strong>MJ (Maître du jeu)</strong> : Utilisateur créant et
              animant une campagne.
            </li>
            <li>
              <strong>Campagne</strong> : espace de jeu regroupant un MJ et
              des joueurs autour d'un scénario.
            </li>
            <li>
              <strong>Contenu Utilisateur</strong> : toute donnée créée ou
              transmise par l'Utilisateur (personnages, cartes, dialogues,
              messages de chat).
            </li>
            <li>
              <strong>Éditeur</strong> : Studio I-XX SAS, responsable du
              Service.
            </li>
          </ul>
        </Card>

        {/* 3 */}
        <Card title="3. Objet et champ d'application">
          <p>
            Les CGU définissent les conditions dans lesquelles l'Éditeur met
            le Service à disposition des Utilisateurs et leurs droits et
            obligations respectifs. Elles s'appliquent à toute utilisation
            du Service, qu'il s'agisse de l'offre gratuite ou d'un
            abonnement payant.
          </p>
        </Card>

        {/* 4 */}
        <Card title="4. Acceptation et modification des CGU">
          <p>
            L'accès au Service vaut acceptation pleine et entière des
            présentes CGU. L'Éditeur se réserve le droit de les modifier à
            tout moment, notamment pour se conformer à l'évolution
            réglementaire ou intégrer de nouvelles fonctionnalités. Les
            modifications substantielles sont notifiées dans l'application
            au moins <strong>15 jours</strong> avant leur entrée en vigueur.
            La poursuite de l'utilisation après cette date vaut acceptation
            des nouvelles CGU. À défaut, l'Utilisateur peut résilier son
            compte dans les conditions de l'article 14.
          </p>
        </Card>

        {/* 5 */}
        <Card title="5. Conditions d'accès au service">
          <ul class="list-disc list-inside space-y-1 text-sm">
            <li>
              <strong>Âge minimum : 15 ans</strong>, conformément à
              l'article 8 du RGPD et à l'article 7-1 de la loi Informatique
              et Libertés (âge du consentement numérique en France). En
              dessous de 15 ans, l'accès n'est licite qu'avec le
              consentement du ou des titulaires de l'autorité parentale.
            </li>
            <li>
              Discord applique par ailleurs un seuil de 13 ans qui constitue
              une première barrière d'âge.
            </li>
            <li>
              <strong>Capacité juridique</strong> : l'Utilisateur déclare
              avoir la capacité juridique pour contracter ou, à défaut,
              avoir obtenu l'autorisation du représentant légal.
            </li>
            <li>
              <strong>Compte Discord</strong> valide requis.
              L'authentification est exclusivement déléguée à Discord via
              OAuth 2.0 ; l'Éditeur ne gère ni mot de passe, ni e-mail de
              contact autre que celui fourni par Discord.
            </li>
            <li>
              <strong>Sincérité et exactitude</strong> : l'Utilisateur
              s'engage à fournir des informations exactes et à les tenir à
              jour.
            </li>
            <li>
              Le Service est fourni <em>« en l'état »</em>. L'Éditeur met en
              œuvre les moyens raisonnables pour assurer sa disponibilité
              mais ne garantit pas une disponibilité ininterrompue.
            </li>
          </ul>
        </Card>

        {/* 6 */}
        <Card title="6. Description du service et évolutions">
          <p>
            DnDiscord met à disposition de ses Utilisateurs :
          </p>
          <ul class="list-disc list-inside space-y-1 text-sm">
            <li>un plateau de jeu 3D (rendu BabylonJS, vue isométrique) ;</li>
            <li>un module de création et gestion de personnages ;</li>
            <li>un module de gestion de campagnes par un MJ ;</li>
            <li>
              une synchronisation multijoueur temps réel via WebSockets
              (SignalR) ;
            </li>
            <li>
              un chat intégré (bulles de dialogue au-dessus des personnages,
              style visuel distinct pour le MJ) ;
            </li>
            <li>l'authentification via OAuth Discord.</li>
          </ul>
          <p>
            L'Éditeur se réserve le droit de faire évoluer, modifier ou
            supprimer tout ou partie des fonctionnalités, notamment dans un
            objectif d'amélioration technique, d'élargissement
            fonctionnel ou de conformité réglementaire.
          </p>
        </Card>

        {/* 7 */}
        <Card title="7. Abonnements, tarifs, paiement et rétractation">
          <p>
            Le Service est proposé selon un modèle <strong>freemium</strong>{" "}
            : certaines fonctionnalités de base sont accessibles
            gratuitement, d'autres sont réservées aux abonnements payants.
            Les paliers, fonctionnalités incluses et prix sont présentés
            dans l'interface de l'application au moment de la souscription.
            {/* TODO RGPD : renseigner ici les paliers d'abonnement définitifs. */}
          </p>
          <p>
            <strong>Paiement</strong> : les abonnements sont prélevés par un
            prestataire de paiement certifié PCI-DSS (ex. Stripe Payments
            Europe Ltd.). Les données de carte bancaire ne transitent pas
            par les serveurs de l'Éditeur.
          </p>
          <p>
            <strong>Droit de rétractation (art. L221-18 Code de la
            consommation)</strong> — L'Utilisateur consommateur dispose d'un
            délai de <strong>14 jours</strong> à compter de la souscription
            pour exercer son droit de rétractation, sans motif.
            Conformément à l'article L221-28 13°, le droit de rétractation
            ne s'applique pas au contenu numérique fourni sur un support
            immatériel dont l'exécution a commencé <strong>avec l'accord
            préalable exprès</strong> de l'Utilisateur et son renoncement
            exprès à ce droit — cette renonciation est recueillie
            explicitement au moment de l'activation des fonctionnalités
            payantes.
          </p>
          <p>
            <strong>Reconduction tacite (art. L215-1 et L215-2 C. conso.)</strong>{" "}
            — Les abonnements souscrits par un consommateur sont reconduits
            tacitement. L'Éditeur informe l'Utilisateur, au plus tôt trois
            mois et au plus tard un mois avant l'échéance, de la faculté
            de ne pas reconduire le contrat. L'Utilisateur peut résilier
            librement et à tout moment après reconduction, sans pénalité.
          </p>
          <p>
            <strong>Résiliation et remboursement</strong> — L'Utilisateur
            peut résilier son abonnement à tout moment depuis les
            paramètres de son compte. L'accès aux fonctionnalités payantes
            est maintenu jusqu'au terme de la période déjà réglée ; aucun
            remboursement au prorata n'est dû, sauf en cas de défaillance
            substantielle du Service imputable à l'Éditeur.
          </p>
        </Card>

        {/* 8 */}
        <Card title="8. Propriété intellectuelle">
          <p>
            <strong>Droits de l'Éditeur</strong> — Le Service, son code
            source, son design, ses interfaces, ses modèles 3D, ses assets
            originaux, ses bases de données et ses marques (notamment{" "}
            <em>Studio I-XX</em> et <em>DnDiscord</em>) sont la propriété
            exclusive de l'Éditeur ou de ses ayants droit et sont protégés
            par le Code de la propriété intellectuelle et les conventions
            internationales. Toute reproduction, représentation,
            adaptation ou modification, totale ou partielle, est interdite
            sans autorisation écrite préalable.
          </p>
          <p>
            <strong>Contenus Utilisateur</strong> — L'Utilisateur conserve
            l'intégralité de ses droits sur les contenus qu'il crée
            (personnages, campagnes, cartes, textes, dialogues). Il accorde
            à l'Éditeur, pour la durée de son utilisation du Service et aux
            seules fins de fonctionnement et d'affichage du Service, une
            licence <strong>non exclusive</strong>, mondiale, à titre
            gratuit, limitée au strict nécessaire pour héberger, afficher,
            sauvegarder et synchroniser ces contenus entre les joueurs
            d'une même campagne.
          </p>
          <p>
            <strong>Règles du jeu (SRD 5.2)</strong> — Les règles de jeu
            employées par DnDiscord sont compatibles avec le{" "}
            <em>System Reference Document 5.2</em> publié par{" "}
            <strong>Wizards of the Coast LLC</strong> sous la licence{" "}
            <ExternalLink href="https://creativecommons.org/licenses/by/4.0/">
              Creative Commons Attribution 4.0 International (CC BY 4.0)
            </ExternalLink>
            . Conformément à cette licence, la mention d'attribution
            suivante est inscrite dans les crédits du Service :{" "}
            <em>
              « Portions of the materials used are property of Wizards of
              the Coast. ©Wizards of the Coast LLC. »
            </em>{" "}
            DnDiscord n'est pas affilié, sponsorisé ou approuvé par Wizards
            of the Coast LLC ou Hasbro.
          </p>
          <p>
            <strong>Marques tierces</strong> — Les marques{" "}
            <em>Discord</em>, <em>BabylonJS</em> et toutes les autres
            marques citées demeurent la propriété de leurs détenteurs
            respectifs.
          </p>
        </Card>

        {/* 9 */}
        <Card title="9. Données personnelles">
          <p>
            Le traitement de vos données personnelles est décrit en détail
            dans notre{" "}
            <a href="/privacy" class="text-purple-300 underline hover:text-purple-200">
              Politique de confidentialité
            </a>
            , qui précise notamment les finalités, les bases légales, les
            destinataires, les durées de conservation et vos droits (accès,
            rectification, effacement, portabilité, opposition,
            limitation). L'Éditeur a désigné un{" "}
            <strong>délégué à la protection des données</strong> (DPO)
            joignable à{" "}
            <a
              href={`mailto:${ORG.dpoEmail}`}
              class="text-purple-300 underline"
            >
              {ORG.dpoEmail}
            </a>
            .
          </p>
          <p>
            L'infrastructure applicative est hébergée{" "}
            <strong>dans l'Union européenne</strong> (datacenter Hostinger
            en Allemagne). Aucun transfert hors UE n'est effectué au titre
            de l'hébergement.
          </p>
        </Card>

        {/* 10 */}
        <Card title="10. Cookies et stockage local">
          <p>
            DnDiscord n'utilise aucun cookie HTTP et aucun traceur tiers.
            L'usage du stockage local du navigateur et ses modalités de
            gestion sont détaillés dans notre{" "}
            <a href="/cookies" class="text-purple-300 underline hover:text-purple-200">
              Politique cookies
            </a>
            .
          </p>
        </Card>

        {/* 11 */}
        <Card title="11. Règles de conduite et contenus interdits">
          <p>
            L'Utilisateur s'engage à respecter les autres Utilisateurs et à
            ne publier aucun contenu illicite ou contraire aux bonnes
            mœurs. Sont notamment interdits :
          </p>
          <ul class="list-disc list-inside space-y-1 text-sm">
            <li>
              le harcèlement, les insultes, menaces, contenus
              discriminatoires ou appelant à la haine ;
            </li>
            <li>
              les contenus à caractère pédopornographique, pornographique
              adressé à un mineur, incitant à la violence ou au terrorisme ;
            </li>
            <li>
              la contrefaçon, l'usurpation d'identité, la diffusion sans
              droit de contenus protégés ;
            </li>
            <li>
              la promotion de jeux d'argent, de substances illicites, la
              diffusion de données personnelles d'autrui ;
            </li>
            <li>
              toute tentative d'accès non autorisé, de scraping massif ou
              de déni de service.
            </li>
          </ul>
          <p>
            Une vigilance renforcée s'applique aux espaces où des mineurs
            sont susceptibles d'interagir.
          </p>
          <p>
            <strong>Signalement (Digital Services Act — Règlement UE
            2022/2065)</strong> — Tout Utilisateur peut signaler un contenu
            qu'il estime illicite via l'adresse{" "}
            <a
              href={`mailto:${ORG.abuseEmail}`}
              class="text-purple-300 underline"
            >
              {ORG.abuseEmail}
            </a>
            . Le signalement doit décrire précisément le contenu visé, sa
            localisation dans le Service et les motifs justifiant son
            caractère illicite. L'Éditeur accuse réception dans les
            meilleurs délais et traite le signalement de façon diligente,
            non arbitraire et objective.
          </p>
          <p>
            Pour les contenus pénalement répréhensibles, un signalement
            peut également être effectué sur la plateforme officielle{" "}
            <ExternalLink href="https://www.internet-signalement.gouv.fr">
              PHAROS (internet-signalement.gouv.fr)
            </ExternalLink>
            .
          </p>
          <p>
            <strong>Sanctions graduées</strong> — En cas de manquement,
            l'Éditeur peut, selon la gravité : avertir l'Utilisateur,
            retirer le contenu litigieux, suspendre temporairement l'accès
            au Service, ou résilier définitivement le compte. L'Utilisateur
            est informé de toute mesure et peut exercer un recours en
            écrivant à{" "}
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
        <Card title="12. Responsabilité">
          <p>
            <strong>Obligation de moyens</strong> — L'Éditeur est soumis à
            une obligation de moyens dans la fourniture du Service. Il met
            en œuvre les diligences raisonnables pour assurer son bon
            fonctionnement, sa sécurité et sa disponibilité.
          </p>
          <p>
            <strong>Disponibilité</strong> — Le Service peut être
            temporairement indisponible pour des raisons de maintenance
            planifiée, d'incident technique, de défaillance de prestataires
            tiers (Hostinger, Discord, Cloudflare…) ou pour des raisons
            indépendantes de la volonté de l'Éditeur. L'Éditeur n'est pas
            responsable des indisponibilités provenant de ces tiers.
          </p>
          <p>
            <strong>Limitation de responsabilité</strong> — Dans les
            limites autorisées par les articles 1231-1 et suivants du Code
            civil, la responsabilité de l'Éditeur ne saurait être engagée
            pour les dommages indirects (perte de données, manque à
            gagner, atteinte à la réputation, dommage moral indirect). Les
            présentes limitations ne s'appliquent pas en cas de faute
            lourde, dolosive ou de dommage corporel, conformément au droit
            impératif français.
          </p>
          <p>
            <strong>Force majeure</strong> — L'Éditeur ne peut être tenu
            responsable de l'inexécution de ses obligations lorsque celle-ci
            résulte d'un cas de force majeure au sens de l'article 1218 du
            Code civil.
          </p>
        </Card>

        {/* 13 */}
        <Card title="13. Garanties légales">
          <p>
            Pour les Utilisateurs consommateurs ayant souscrit à un
            abonnement payant, les garanties légales s'appliquent :
          </p>
          <ul class="list-disc list-inside space-y-1 text-sm">
            <li>
              <strong>Garantie légale de conformité</strong> (art. L224-25-12
              et suivants du Code de la consommation pour les services
              numériques) : le Service doit correspondre à la description
              donnée et être exempt de défauts.
            </li>
            <li>
              <strong>Garantie des vices cachés</strong> (art. 1641 et
              suivants du Code civil) pour les défauts non apparents
              rendant le Service impropre à son usage.
            </li>
          </ul>
          <p>
            Les demandes au titre de ces garanties peuvent être adressées à{" "}
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
        <Card title="14. Durée, suspension et résiliation du compte">
          <p>
            Les CGU s'appliquent pour toute la durée d'utilisation du
            Service.
          </p>
          <p>
            <strong>À l'initiative de l'Utilisateur</strong> — L'Utilisateur
            peut résilier son compte à tout moment depuis les paramètres
            « Confidentialité & données ». Cette action entraîne la
            suppression définitive de son compte, de ses personnages, de
            ses campagnes possédées et contenus associés, ainsi qu'une
            proposition d'export préalable de ses données (RGPD art. 20).
          </p>
          <p>
            <strong>À l'initiative de l'Éditeur</strong> — L'Éditeur peut
            suspendre ou résilier l'accès d'un Utilisateur en cas de
            manquement grave ou répété aux présentes CGU ou à la loi,
            moyennant notification préalable sauf urgence (sécurité du
            Service, contenus manifestement illicites). L'Utilisateur peut
            contester la décision en répondant à la notification.
          </p>
        </Card>

        {/* 15 */}
        <Card title="15. Dépendances à des plateformes tierces">
          <ul class="list-disc list-inside space-y-1 text-sm">
            <li>
              <strong>Discord</strong> — Plateforme d'intégration,
              authentification OAuth et diffusion du client. L'usage du
              Service implique le respect des Conditions d'utilisation et
              des Règles communautaires de Discord. L'Éditeur n'a aucun
              contrôle sur la disponibilité ou les évolutions de Discord.
            </li>
            <li>
              <strong>{HOSTING.provider}</strong> (Hostinger) —
              Fournisseur d'hébergement. SLA et engagements de continuité
              dépendent des conditions contractuelles de Hostinger,
              accessibles depuis{" "}
              <ExternalLink href={HOSTING.contactUrl}>
                leur site
              </ExternalLink>
              .
            </li>
            <li>
              <strong>Cloudflare, Inc.</strong> — CDN et protection
              anti-DDoS.
            </li>
            <li>
              <strong>Wizards of the Coast LLC</strong> — Titulaire des
              droits sur le SRD 5.2 utilisé sous licence CC BY 4.0.
            </li>
          </ul>
        </Card>

        {/* 16 */}
        <Card title="16. Dispositions diverses">
          <ul class="list-disc list-inside space-y-1 text-sm">
            <li>
              <strong>Nullité partielle</strong> — Si l'une des stipulations
              des CGU est déclarée nulle ou inopposable, les autres
              stipulations demeurent pleinement en vigueur.
            </li>
            <li>
              <strong>Non-renonciation</strong> — Le fait pour l'Éditeur de
              ne pas se prévaloir d'un manquement ne vaut pas renonciation à
              s'en prévaloir ultérieurement.
            </li>
            <li>
              <strong>Cession</strong> — L'Éditeur peut librement céder les
              présentes CGU à tout tiers qui lui succéderait dans
              l'exploitation du Service, sous réserve d'en informer les
              Utilisateurs.
            </li>
            <li>
              <strong>Intégralité</strong> — Les présentes CGU, ensemble
              avec la Politique de confidentialité, la Politique cookies et
              les Mentions légales, constituent l'intégralité de l'accord
              entre l'Utilisateur et l'Éditeur.
            </li>
          </ul>
        </Card>

        {/* 17 */}
        <Card title="17. Droit applicable, médiation et juridiction">
          <p>
            Les présentes CGU sont soumises à la loi {ORG.applicableLaw}.
          </p>
          <p>
            <strong>Médiation de la consommation</strong> (art. L611-1 et
            suivants du Code de la consommation) — En cas de litige qui
            n'aurait pu être résolu par une réclamation préalable auprès de
            l'Éditeur, le consommateur peut recourir gratuitement au
            médiateur de la consommation suivant :{" "}
            <strong>{MEDIATOR.name}</strong> —{" "}
            <ExternalLink href={MEDIATOR.url}>{MEDIATOR.url}</ExternalLink>
            .{/* TODO : désigner un médiateur agréé CECMC et mettre à jour ici. */}
          </p>
          <p>
            Pour les litiges transfrontaliers au sein de l'Union
            européenne, la plateforme{" "}
            <ExternalLink href="https://ec.europa.eu/consumers/odr/">
              de règlement en ligne des litiges (RLL)
            </ExternalLink>{" "}
            de la Commission européenne est également disponible.
          </p>
          <p>
            <strong>Juridiction compétente</strong> — À défaut de
            résolution amiable : pour les relations entre professionnels,
            les {ORG.jurisdiction.toLowerCase()} sont seuls compétents ;
            pour les consommateurs, le tribunal compétent est celui du lieu
            de domicile du consommateur ou du lieu d'exécution du contrat,
            conformément à l'article R631-3 du Code de la consommation et
            aux règles d'ordre public protégeant les consommateurs.
          </p>
        </Card>

        <nav class="flex flex-wrap items-center gap-x-3 gap-y-2 pt-6 text-sm text-slate-400">
          <a href="/privacy" class="text-purple-300 hover:text-purple-200 underline underline-offset-2">
            Politique de confidentialité
          </a>
          <span class="text-slate-600">·</span>
          <a href="/legal" class="text-purple-300 hover:text-purple-200 underline underline-offset-2">
            Mentions légales
          </a>
          <span class="text-slate-600">·</span>
          <a href="/cookies" class="text-purple-300 hover:text-purple-200 underline underline-offset-2">
            Politique cookies
          </a>
        </nav>
        <p class="pt-2 text-xs text-slate-500">
          En vigueur depuis le {ORG.lastUpdated}.
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
