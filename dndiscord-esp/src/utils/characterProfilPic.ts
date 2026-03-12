import { CharacterClass } from "../types/character";

// Imports centralisés
import barbarianImg from "../assets/classes/barbarian.png";
import bardImg from "../assets/classes/bard.png";
import clericImg from "../assets/classes/cleric.png";
import druidImg from "../assets/classes/druid.png";
import fighterImg from "../assets/classes/fighter.png";
import monkImg from "../assets/classes/monk.png";
import paladinImg from "../assets/classes/paladin.png";
import rangerImg from "../assets/classes/ranger.png";
import rogueImg from "../assets/classes/rogue.png";
import sorcererImg from "../assets/classes/sorcerer.png";
import warlockImg from "../assets/classes/warlock.png";
import wizardImg from "../assets/classes/wizard.png";


const characterProfilPic: Record<CharacterClass, string> = {
  [CharacterClass.Barbare]: barbarianImg,
  [CharacterClass.Barde]: bardImg,
  [CharacterClass.Clerc]: clericImg,
  [CharacterClass.Druide]: druidImg,
  [CharacterClass.Guerrier]: fighterImg,
  [CharacterClass.Moine]: monkImg,
  [CharacterClass.Paladin]: paladinImg,
  [CharacterClass.Rodeur]: rangerImg,
  [CharacterClass.Voleur]: rogueImg,
  [CharacterClass.Ensorceleur]: sorcererImg,
  [CharacterClass.Sorcier]: warlockImg,
  [CharacterClass.Magicien]: wizardImg,
};

export class GetCharacterProfilPic {
  static getCharacterProfilPic(characterClass: CharacterClass): string {
    return characterProfilPic[characterClass] || rogueImg;
  }

  static getCharacterProfilPicOrDefault(characterClass?: CharacterClass): string {
    return characterClass ? this.getCharacterProfilPic(characterClass) : rogueImg;
  }
}