import { describe, it, expect } from "vitest";
import { coinLabel } from "../coinLabel";
import type { CurrencyType } from "../../types/multiplayer";

describe("coinLabel", () => {
  const cases: Array<[CurrencyType, string]> = [
    ["cp", "copper pieces"],
    ["sp", "silver pieces"],
    ["ep", "electrum pieces"],
    ["gp", "gold pieces"],
    ["pp", "platinum pieces"],
  ];

  it.each(cases)('"%s" → "%s"', (type, expected) => {
    expect(coinLabel(type)).toBe(expected);
  });
});
