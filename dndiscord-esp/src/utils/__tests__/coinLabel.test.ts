import { describe, it, expect } from "vitest";
import { coinLabel } from "../coinLabel";
import type { CurrencyType } from "../../types/multiplayer";

describe("coinLabel", () => {
  const cases: Array<[CurrencyType, string]> = [
    ["cp", "pièces de cuivre"],
    ["sp", "pièces d'argent"],
    ["ep", "pièces d'électrum"],
    ["gp", "pièces d'or"],
    ["pp", "pièces de platine"],
  ];

  it.each(cases)('"%s" → "%s"', (type, expected) => {
    expect(coinLabel(type)).toBe(expected);
  });
});
