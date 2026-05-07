/**
 * Shop catalog — single source of truth for everything the support shop sells.
 *
 * All prices are stored in **cents** (integer math, no float drift). The cart
 * store and checkout page resolve items by `id`, which means once an item is
 * added to the cart its data stays consistent even across catalog updates.
 *
 * Frontend-only mock — not wired to any payment processor.
 */

export type ShopCategoryKey = "tip" | "dice" | "title" | "aura";

export interface DicePreview {
  kind: "dice";
  bg: string;
  diceColor: string;
}

export interface TitlePreview {
  kind: "title";
  color: string;
  label: string;
}

export interface AuraPreview {
  kind: "aura";
  glow: string;
}

export interface TipPreview {
  kind: "tip";
  icon: "coffee" | "beer" | "heart" | "crown";
  highlighted?: boolean;
}

export type ShopPreview = DicePreview | TitlePreview | AuraPreview | TipPreview;

export interface ShopItem {
  id: string;
  category: ShopCategoryKey;
  title: string;
  description: string;
  priceCents: number;
  /** Optional pill displayed on the card (e.g. "New", "Bundle", "Limited"). */
  tag?: string;
  /** Tip items can be repurchased; cosmetics cap quantity at 1 in the cart. */
  maxQuantity: number;
  preview: ShopPreview;
  /** Optional illustration shown in the card (public path, e.g. "/assets/shop/dice/frost.png"). */
  image?: string;
}

/* ───────────────────────── Tip jar ───────────────────────── */

export const SHOP_TIPS: ShopItem[] = [
  {
    id: "tip-coffee",
    category: "tip",
    title: "Buy us a coffee",
    description: "A little caffeine goes a long way.",
    priceCents: 300,
    maxQuantity: 20,
    preview: { kind: "tip", icon: "coffee" },
  },
  {
    id: "tip-tavern",
    category: "tip",
    title: "Tavern round",
    description: "Round of drinks for the dev party. Highly motivating.",
    priceCents: 500,
    maxQuantity: 20,
    preview: { kind: "tip", icon: "beer", highlighted: true },
  },
  {
    id: "tip-patron",
    category: "tip",
    title: "Patron",
    description: "Generous backer — covers a chunk of monthly hosting.",
    priceCents: 1000,
    maxQuantity: 20,
    preview: { kind: "tip", icon: "heart" },
  },
  {
    id: "tip-mythic",
    category: "tip",
    title: "Mythic supporter",
    description: "You are clearly a hero. We tip our hat.",
    priceCents: 2500,
    maxQuantity: 20,
    preview: { kind: "tip", icon: "crown" },
  },
];

/* ───────────────────────── Dice skins ───────────────────────── */

export const SHOP_DICE_SKINS: ShopItem[] = [
  {
    id: "dice-onyx-gold",
    category: "dice",
    title: "Onyx & Gold",
    description: "Deep black dice rimmed in soft gold — for the seasoned tactician.",
    priceCents: 299,
    maxQuantity: 1,
    image: "/assets/shop/dice/void.png",
    preview: {
      kind: "dice",
      bg: "linear-gradient(135deg, #0F0F1A 0%, #1A1A2E 100%)",
      diceColor: "#F4C542",
    },
  },
  {
    id: "dice-arcane-crimson",
    category: "dice",
    title: "Arcane Crimson",
    description: "Crimson resin shot through with violet sparks. Ideal for sorcerers.",
    priceCents: 299,
    maxQuantity: 1,
    image: "/assets/shop/dice/crimson.png",
    preview: {
      kind: "dice",
      bg: "linear-gradient(135deg, #4B1E4E 0%, #9F1239 100%)",
      diceColor: "#FFE08A",
    },
  },
  {
    id: "dice-verdant-grove",
    category: "dice",
    title: "Verdant Grove",
    description: "Mossy greens and warm parchment — a ranger's favorite.",
    priceCents: 299,
    maxQuantity: 1,
    image: "/assets/shop/dice/emerald.png",
    preview: {
      kind: "dice",
      bg: "linear-gradient(135deg, #14302B 0%, #3F7A4E 100%)",
      diceColor: "#E3B23C",
    },
  },
  {
    id: "dice-frostforged",
    category: "dice",
    title: "Frostforged",
    description: "Glacier-blue dice with a faint inner glow. Cold to the touch.",
    priceCents: 349,
    tag: "New",
    maxQuantity: 1,
    image: "/assets/shop/dice/frost.png",
    preview: {
      kind: "dice",
      bg: "linear-gradient(135deg, #0B1A2C 0%, #2A4E78 100%)",
      diceColor: "#A968AE",
    },
  },
  {
    id: "dice-royal-saffron",
    category: "dice",
    title: "Royal Saffron",
    description: "Polished gold dice fit for a king's throne room.",
    priceCents: 349,
    maxQuantity: 1,
    image: "/assets/shop/dice/saffron.png",
    preview: {
      kind: "dice",
      bg: "linear-gradient(135deg, #8A6A1C 0%, #F4C542 100%)",
      diceColor: "#2B0F2E",
    },
  },
  {
    id: "dice-mythic-pack",
    category: "dice",
    title: "Mythic Pack",
    description: "All five themes above bundled together — best value.",
    priceCents: 999,
    tag: "Bundle",
    maxQuantity: 1,
    image: "/assets/shop/dice/mythic.png",
    preview: {
      kind: "dice",
      bg: "conic-gradient(from 180deg at 50% 50%, #4B1E4E, #2A4E78, #3F7A4E, #F4C542, #4B1E4E)",
      diceColor: "#F5F1E4",
    },
  },
];

/* ───────────────────────── Titles ───────────────────────── */

export const SHOP_TITLES: ShopItem[] = [
  {
    id: "title-loremaster",
    category: "title",
    title: "Loremaster",
    description: "For the player who reads every tooltip.",
    priceCents: 199,
    maxQuantity: 1,
    preview: { kind: "title", color: "#F4C542", label: "Loremaster" },
  },
  {
    id: "title-trickster",
    category: "title",
    title: "Trickster",
    description: "Whispers, daggers, and impossible escapes.",
    priceCents: 199,
    maxQuantity: 1,
    preview: { kind: "title", color: "#A968AE", label: "Trickster" },
  },
  {
    id: "title-wandering-bard",
    category: "title",
    title: "Wandering Bard",
    description: "A poet, a rogue, a bad influence.",
    priceCents: 199,
    maxQuantity: 1,
    preview: { kind: "title", color: "#6A90C0", label: "Wandering Bard" },
  },
  {
    id: "title-founder",
    category: "title",
    title: "Founder",
    description: "Reserved for early supporters of the project.",
    priceCents: 499,
    tag: "Limited",
    maxQuantity: 1,
    preview: { kind: "title", color: "#FFE08A", label: "Founder" },
  },
];

/* ───────────────────────── Auras ───────────────────────── */

export const SHOP_AURAS: ShopItem[] = [
  {
    id: "aura-ember",
    category: "aura",
    title: "Ember Aura",
    description: "A subtle warm glow around your portrait.",
    priceCents: 249,
    maxQuantity: 1,
    preview: {
      kind: "aura",
      glow: "0 0 0 2px rgba(244,197,66,0.6), 0 0 20px rgba(244,197,66,0.45)",
    },
  },
  {
    id: "aura-mystic",
    category: "aura",
    title: "Mystic Glow",
    description: "Deep violet halo for the arcane-minded.",
    priceCents: 249,
    maxQuantity: 1,
    preview: {
      kind: "aura",
      glow: "0 0 0 2px rgba(169,104,174,0.6), 0 0 22px rgba(107,44,111,0.55)",
    },
  },
  {
    id: "aura-frostbite",
    category: "aura",
    title: "Frostbite",
    description: "Icy blue ring with a faint shimmer.",
    priceCents: 249,
    tag: "New",
    maxQuantity: 1,
    preview: {
      kind: "aura",
      glow: "0 0 0 2px rgba(106,144,192,0.6), 0 0 22px rgba(42,78,120,0.55)",
    },
  },
];

/* ───────────────────────── Aggregate + lookup ───────────────────────── */

export const SHOP_CATALOG: ShopItem[] = [
  ...SHOP_TIPS,
  ...SHOP_DICE_SKINS,
  ...SHOP_TITLES,
  ...SHOP_AURAS,
];

const BY_ID: Map<string, ShopItem> = new Map(SHOP_CATALOG.map((i) => [i.id, i]));

export function findShopItem(id: string): ShopItem | undefined {
  return BY_ID.get(id);
}

/* ───────────────────────── Money helpers ───────────────────────── */

const PRICE_FMT = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

export function formatPrice(cents: number): string {
  return PRICE_FMT.format(cents / 100);
}

/** Country list shown on checkout. EU countries are flagged for VAT. */
export interface CountryInfo {
  code: string;
  name: string;
  isEU: boolean;
}

export const COUNTRIES: CountryInfo[] = [
  { code: "FR", name: "France", isEU: true },
  { code: "BE", name: "Belgium", isEU: true },
  { code: "LU", name: "Luxembourg", isEU: true },
  { code: "DE", name: "Germany", isEU: true },
  { code: "ES", name: "Spain", isEU: true },
  { code: "IT", name: "Italy", isEU: true },
  { code: "NL", name: "Netherlands", isEU: true },
  { code: "PT", name: "Portugal", isEU: true },
  { code: "IE", name: "Ireland", isEU: true },
  { code: "AT", name: "Austria", isEU: true },
  { code: "CH", name: "Switzerland", isEU: false },
  { code: "GB", name: "United Kingdom", isEU: false },
  { code: "CA", name: "Canada", isEU: false },
  { code: "US", name: "United States", isEU: false },
  { code: "AU", name: "Australia", isEU: false },
  { code: "JP", name: "Japan", isEU: false },
];

const COUNTRY_BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

export function getCountry(code: string): CountryInfo | undefined {
  return COUNTRY_BY_CODE.get(code);
}

/** Mock VAT rule: 20% for EU countries (illustrative, not legally accurate). */
export function vatRateFor(countryCode: string): number {
  const c = getCountry(countryCode);
  return c?.isEU ? 0.2 : 0;
}
