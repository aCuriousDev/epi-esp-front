import type { ItemCategory } from "../types/inventory";

/**
 * Mapping visuel des objets d'inventaire.
 * - `ICON_NAME` : nom d'icône game-icons (via @iconify-icon/solid).
 * - `CATEGORY_STYLE` : gradient + glow par catégorie (coloration des cartes).
 */

export const ICON_NAME: Record<string, string> = {
  "potion-red": "game-icons:health-potion",
  "potion-blue": "game-icons:potion-ball",
  torch: "game-icons:torch",
  bread: "game-icons:bread-slice",
  rope: "game-icons:rope-coil",
  dagger: "game-icons:plain-dagger",
  bow: "game-icons:pocket-bow",
  shield: "game-icons:round-shield",
  scroll: "game-icons:scroll-unfurled",
  "coin-gold": "game-icons:two-coins",
  amulet: "game-icons:gem-pendant",
  map: "game-icons:treasure-map",
};

export function getItemIcon(iconKey: string): string {
  return ICON_NAME[iconKey] ?? "game-icons:swap-bag";
}

export interface CategoryStyle {
  label: string;
  gradient: string;
  ring: string;
  glow: string;
  text: string;
  badge: string;
}

export const CATEGORY_STYLE: Record<ItemCategory, CategoryStyle> = {
  Consumable: {
    label: "Consommable",
    gradient: "from-rose-500/30 via-pink-500/20 to-red-600/30",
    ring: "ring-rose-400/30",
    glow: "shadow-rose-500/20",
    text: "text-rose-300",
    badge: "bg-rose-500/20 text-rose-200 border-rose-400/30",
  },
  Weapon: {
    label: "Arme",
    gradient: "from-orange-500/30 via-amber-500/20 to-red-600/30",
    ring: "ring-amber-400/30",
    glow: "shadow-amber-500/20",
    text: "text-amber-300",
    badge: "bg-amber-500/20 text-amber-200 border-amber-400/30",
  },
  Armor: {
    label: "Armure",
    gradient: "from-sky-500/30 via-blue-500/20 to-indigo-600/30",
    ring: "ring-sky-400/30",
    glow: "shadow-sky-500/20",
    text: "text-sky-300",
    badge: "bg-sky-500/20 text-sky-200 border-sky-400/30",
  },
  Tool: {
    label: "Outil",
    gradient: "from-emerald-500/30 via-teal-500/20 to-green-600/30",
    ring: "ring-emerald-400/30",
    glow: "shadow-emerald-500/20",
    text: "text-emerald-300",
    badge: "bg-emerald-500/20 text-emerald-200 border-emerald-400/30",
  },
  Magic: {
    label: "Magique",
    gradient: "from-purple-500/30 via-fuchsia-500/20 to-indigo-600/30",
    ring: "ring-fuchsia-400/30",
    glow: "shadow-fuchsia-500/20",
    text: "text-fuchsia-300",
    badge: "bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-400/30",
  },
  Treasure: {
    label: "Trésor",
    gradient: "from-yellow-500/30 via-amber-400/20 to-orange-500/30",
    ring: "ring-yellow-400/30",
    glow: "shadow-yellow-500/20",
    text: "text-yellow-300",
    badge: "bg-yellow-500/20 text-yellow-200 border-yellow-400/30",
  },
};

export function getCategoryStyle(category: ItemCategory): CategoryStyle {
  return CATEGORY_STYLE[category] ?? CATEGORY_STYLE.Tool;
}
