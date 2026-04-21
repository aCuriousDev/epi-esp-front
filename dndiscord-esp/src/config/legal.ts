/**
 * Source unique pour toutes les données légales (RGPD, CGU, Mentions
 * légales, Cookies). Centralisé ici pour éviter toute divergence entre
 * les 4 pages. Les valeurs proviennent du retour du Project Lead
 * (Quentin BERGER, 2026-04-21) et du Notion « Legal Feasibility Study ».
 */

export const LEGAL_ORG = {
  name: "Studio I-XX SAS",
  legalForm: "Société par Actions Simplifiée (SAS)",
  capital: "10 000 €",
  siren: "880 432 190",
  siret: "880 432 190 00010",
  rcs: "RCS Lyon 880 432 190",
  codeApe: "5829C — Édition de logiciels applicatifs",
  // TODO Mentions légales : numéro TVA intracommunautaire à confirmer
  // par le service comptable (clé algorithmique = FR65).
  tvaIntra: "À compléter — FR•• 880 432 190",
  address: "2 Rue du Professeur Charles Appleton, 69007 Lyon, France",
  website: "https://studio-ixx.fr",
  contactEmail: "contact@studio-ixx.fr",
  privacyEmail: "privacy@studio-ixx.fr",
  dpoEmail: "dpo@studio-ixx.fr",
  abuseEmail: "abuse@studio-ixx.fr",
  // TODO : renseigner le nom du Président de la SAS.
  legalRepresentative: "À compléter — Président·e de Studio I-XX SAS",
  publicationDirector: "À compléter — Directeur·rice de la publication",
  publicationDirectorEmail: "contact@studio-ixx.fr",
  // TODO : téléphone public si applicable.
  phone: "Non communiqué",
  productionDomain: "dndiscord.cadran.app",
  serviceUrl: "https://dndiscord.cadran.app",
  lastUpdated: "21 avril 2026",
  applicableLaw: "française",
  jurisdiction: "Tribunaux du ressort de Lyon",
} as const;

/** Hébergeur (obligation LCEN art. 6-III). */
export const LEGAL_HOSTING = {
  provider: "Hostinger International Ltd.",
  address: "61 Lordou Vironos Street, 6023 Larnaca, Chypre",
  serverLocation: "Datacenter en Allemagne (Union européenne)",
  contactUrl: "https://www.hostinger.fr/contact",
} as const;

/**
 * Médiateur de la consommation (art. L611-1 Code de la consommation).
 * TODO : désigner un médiateur agréé CECMC (CMAP, Médiateur du e-commerce
 * FEVAD, etc.) et renseigner ses coordonnées exactes.
 */
export const LEGAL_MEDIATOR = {
  name: "À désigner — médiateur de la consommation (art. L611-1 C. conso.)",
  url: "https://www.economie.gouv.fr/mediation-conso",
} as const;
