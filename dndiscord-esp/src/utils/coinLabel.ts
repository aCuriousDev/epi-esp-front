/**
 * Pure coin label helper extracted for testability.
 */

import type { CurrencyType } from "../types/multiplayer";

export function coinLabel(type: CurrencyType): string {
  switch (type) {
    case "cp": return "copper pieces";
    case "sp": return "silver pieces";
    case "ep": return "electrum pieces";
    case "gp": return "gold pieces";
    case "pp": return "platinum pieces";
    default: {
      console.warn("[coinLabel] unknown currency:", type);
      return String(type);
    }
  }
}
