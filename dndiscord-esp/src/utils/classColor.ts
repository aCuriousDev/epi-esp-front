import { CharacterClass } from "../services/character.service";

export type ClassColorVar =
  | "c-fighter"
  | "c-wizard"
  | "c-rogue"
  | "c-cleric"
  | "c-bard"
  | "c-ranger"
  | "c-fallback";

// CharacterClass enum uses French values (Guerrier, Magicien, etc.)
const MAP: Partial<Record<string, ClassColorVar>> = {
  Guerrier:    "c-fighter",
  Magicien:    "c-wizard",
  Voleur:      "c-rogue",
  Clerc:       "c-cleric",
  Barde:       "c-bard",
  Rodeur:      "c-ranger",
};

export function getClassColorVar(klass: CharacterClass | string | undefined): ClassColorVar {
  if (!klass) return "c-fallback";
  return MAP[String(klass)] ?? "c-fallback";
}

/** Hex literal — for inline style gradients. */
const HEX: Record<ClassColorVar, string> = {
  "c-fighter":  "#8B5A2B",
  "c-wizard":   "#3F6BD1",
  "c-rogue":    "#5A5260",
  "c-cleric":   "#E6C35C",
  "c-bard":     "#C97BB4",
  "c-ranger":   "#3F7A4E",
  "c-fallback": "#4B1E4E", // plum-700
};

export function getClassHex(klass: CharacterClass | string | undefined): string {
  return HEX[getClassColorVar(klass)];
}
