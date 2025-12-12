/**
 * Character types for the frontend
 */

export enum CharacterClass {
  Barbare = "Barbare",
  Barde = "Barde",
  Clerc = "Clerc",
  Druide = "Druide",
  Guerrier = "Guerrier",
  Moine = "Moine",
  Paladin = "Paladin",
  Rodeur = "Rodeur",
  Voleur = "Voleur",
  Ensorceleur = "Ensorceleur",
  Sorcier = "Sorcier",
  Magicien = "Magicien",
}

export enum CharacterRace {
  Humain = "Humain",
  Elfe = "Elfe",
  Nain = "Nain",
  Halfelin = "Halfelin",
  DemiOrc = "Demi-Orc",
  Tieffelin = "Tieffelin",
  Gnome = "Gnome",
}

export interface AbilityScores {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

export interface Character {
  id: string;
  name: string;
  level: number;
  characterClass: CharacterClass;
  race: CharacterRace;
  abilities: AbilityScores;
  maxHitPoints: number;
  currentHitPoints: number;
  armorClass: number;
  speed: number;
  initiative: number;
  portraitUrl?: string;
  campaign?: {
    title: string;
  };
  createdAt?: string;
}

/**
 * Get ability modifier from score (D&D 5e formula)
 */
export function getAbilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/**
 * Format modifier with + or - sign
 */
export function formatModifier(score: number): string {
  const mod = getAbilityModifier(score);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

/**
 * Map class to English name for asset lookup
 */
export function getClassAssetName(characterClass: CharacterClass): string {
  const mapping: Record<CharacterClass, string> = {
    [CharacterClass.Barbare]: "barbarian",
    [CharacterClass.Barde]: "bard",
    [CharacterClass.Clerc]: "cleric",
    [CharacterClass.Druide]: "druid",
    [CharacterClass.Guerrier]: "fighter",
    [CharacterClass.Moine]: "monk",
    [CharacterClass.Paladin]: "paladin",
    [CharacterClass.Rodeur]: "ranger",
    [CharacterClass.Voleur]: "rogue",
    [CharacterClass.Ensorceleur]: "sorcerer",
    [CharacterClass.Sorcier]: "warlock",
    [CharacterClass.Magicien]: "wizard",
  };
  return mapping[characterClass] || "fighter";
}

