/**
 * Single source of truth for all legal data (GDPR, ToS, Legal Notice,
 * Cookies). Centralized here to avoid divergence between the 4 pages.
 * Values come from the Project Lead's input (Quentin BERGER, 2026-04-21)
 * and the Notion "Legal Feasibility Study".
 */

export const LEGAL_ORG = {
  name: "Studio I-XX SAS",
  legalForm: "Société par Actions Simplifiée (SAS — French simplified joint-stock company)",
  capital: "€10,000",
  siren: "880 432 190",
  siret: "880 432 190 00010",
  rcs: "RCS Lyon 880 432 190",
  codeApe: "5829C — Publishing of application software",
  // Intra-EU VAT = FR + key (12 + 3 × (SIREN mod 97)) mod 97
  // = FR + ((12 + 3 × 50) mod 97) = FR65. Deterministic, no accounting
  // validation needed.
  tvaIntra: "FR65 880 432 190",
  address: "2 Rue du Professeur Charles Appleton, 69007 Lyon, France",
  website: "https://studio-ixx.fr",
  contactEmail: "contact@studio-ixx.fr",
  privacyEmail: "privacy@studio-ixx.fr",
  dpoEmail: "dpo@studio-ixx.fr",
  abuseEmail: "abuse@studio-ixx.fr",
  // TODO: fill in the name of the SAS President.
  legalRepresentative: "To be completed — President of Studio I-XX SAS",
  publicationDirector: "To be completed — Publication Director",
  publicationDirectorEmail: "contact@studio-ixx.fr",
  // TODO: public phone if applicable.
  phone: "Not disclosed",
  productionDomain: "dndiscord.cadran.app",
  serviceUrl: "https://dndiscord.cadran.app",
  lastUpdated: "April 21, 2026",
  applicableLaw: "French",
  jurisdiction: "Courts within the jurisdiction of Lyon",
} as const;

/** Hosting provider (LCEN art. 6-III obligation). */
export const LEGAL_HOSTING = {
  provider: "Hostinger International Ltd.",
  address: "61 Lordou Vironos Street, 6023 Larnaca, Cyprus",
  serverLocation: "Datacenter in Germany (European Union)",
  contactUrl: "https://www.hostinger.fr/contact",
} as const;

/**
 * Consumer mediator (French Consumer Code art. L611-1).
 * TODO: appoint a CECMC-approved mediator (CMAP, FEVAD e-commerce
 * Mediator, etc.) and fill in their exact contact details.
 */
export const LEGAL_MEDIATOR = {
  name: "To be appointed — consumer mediator (French Consumer Code art. L611-1)",
  url: "https://www.economie.gouv.fr/mediation-conso",
} as const;

/** Autorité de contrôle française (RGPD art. 77 — droit de réclamation). */
export const LEGAL_DPA = {
  name: "CNIL — Commission Nationale de l'Informatique et des Libertés",
  address: "3 place de Fontenoy, TSA 80715",
  city: "75334 Paris Cedex 07",
  complaintsUrl: "https://www.cnil.fr/fr/plaintes",
} as const;

/** Plateformes de signalement / services tiers mentionnés de façon récurrente. */
export const LEGAL_EXTERNAL = {
  pharosUrl: "https://www.internet-signalement.gouv.fr",
  odrUrl: "https://ec.europa.eu/consumers/odr/",
  dpfUrl: "https://www.dataprivacyframework.gov/",
  discordPrivacy: "https://discord.com/privacy",
  discordTerms: "https://discord.com/terms",
  discordDevPolicy:
    "https://support-dev.discord.com/hc/en-us/articles/8563934450327-Discord-Developer-Policy",
  discordAuthorizedAppsDeepLink: "discord://users/@me/settings/authorized-apps",
  discordAuthorizedAppsWeb: "https://discord.com/channels/@me",
} as const;
