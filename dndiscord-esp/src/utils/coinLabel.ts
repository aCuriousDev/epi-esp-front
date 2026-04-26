/**
 * Pure coin label helper extracted for testability.
 */

import type { CurrencyType } from "../types/multiplayer";

export function coinLabel(type: CurrencyType): string {
  switch (type) {
    case "cp": return "pièces de cuivre";
    case "sp": return "pièces d'argent";
    case "ep": return "pièces d'électrum";
    case "gp": return "pièces d'or";
    case "pp": return "pièces de platine";
    default: {
      console.warn("[coinLabel] unknown currency:", type);
      return String(type);
    }
  }
}
