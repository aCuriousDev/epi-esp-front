import { addIcon } from "@iconify-icon/solid";
import type { IconifyJSON } from "@iconify/types";
import gameIcons from "@iconify-json/game-icons/icons.json";

/**
 * Pre-register needed game-icons for offline/instant display.
 * Import this module once at app startup (or any component that uses game-icons).
 */
const gi = gameIcons as IconifyJSON;
const neededIcons = [
  "health-potion",
  "potion-ball",
  "torch",
  "bread-slice",
  "rope-coil",
  "plain-dagger",
  "pocket-bow",
  "round-shield",
  "scroll-unfurled",
  "two-coins",
  "gem-pendant",
  "treasure-map",
  "swap-bag",
  "knapsack",
  "crossed-swords",
  // Wallet coin icons
  "coins",
  "coins-pile",
  "two-coins",
  "crown-coin",
  "gold-bar",
  "shiny-purse",
];

for (const name of neededIcons) {
  const data = gi.icons[name];
  if (data) {
    addIcon(`game-icons:${name}`, {
      ...data,
      width: gi.width ?? 512,
      height: gi.height ?? 512,
    });
  }
}
