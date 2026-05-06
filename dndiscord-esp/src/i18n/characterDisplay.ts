import { CharacterClass, CharacterRace } from "../types/character";

export const characterClassDisplay: Record<CharacterClass, string> = {
  [CharacterClass.Barbare]: "Barbarian",
  [CharacterClass.Barde]: "Bard",
  [CharacterClass.Clerc]: "Cleric",
  [CharacterClass.Druide]: "Druid",
  [CharacterClass.Guerrier]: "Fighter",
  [CharacterClass.Moine]: "Monk",
  [CharacterClass.Paladin]: "Paladin",
  [CharacterClass.Rodeur]: "Ranger",
  [CharacterClass.Voleur]: "Rogue",
  [CharacterClass.Ensorceleur]: "Sorcerer",
  [CharacterClass.Sorcier]: "Warlock",
  [CharacterClass.Magicien]: "Wizard",
};

export const characterRaceDisplay: Record<CharacterRace, string> = {
  [CharacterRace.Humain]: "Human",
  [CharacterRace.Elfe]: "Elf",
  [CharacterRace.Nain]: "Dwarf",
  [CharacterRace.Halfelin]: "Halfling",
  [CharacterRace.DemiOrc]: "Half-Orc",
  [CharacterRace.Tieffelin]: "Tiefling",
  [CharacterRace.Gnome]: "Gnome",
};
