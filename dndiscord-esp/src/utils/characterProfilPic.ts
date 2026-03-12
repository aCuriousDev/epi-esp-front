import { CharacterClass } from "../types/character";

const characterProfilPic: Record<CharacterClass, string> = {
  [CharacterClass.Barbare]: "/assets/classes/barbarian.png",
  [CharacterClass.Barde]: "/assets/classes/bard.png",
  [CharacterClass.Clerc]: "/assets/classes/cleric.png",
  [CharacterClass.Druide]: "/assets/classes/druid.png",
  [CharacterClass.Guerrier]: "/assets/classes/fighter.png",
  [CharacterClass.Moine]: "/assets/classes/monk.png",
  [CharacterClass.Paladin]: "/assets/classes/paladin.png",
  [CharacterClass.Rodeur]: "/assets/classes/ranger.png",
  [CharacterClass.Voleur]: "/assets/classes/rogue.png",
  [CharacterClass.Ensorceleur]: "/assets/classes/sorcerer.png",
  [CharacterClass.Sorcier]: "/assets/classes/warlock.png",
  [CharacterClass.Magicien]: "/assets/classes/wizard.png",
};

const defaultImg = "/assets/classes/rogue.png";

export class GetCharacterProfilPic {
  static getCharacterProfilPic(characterClass: CharacterClass): string {
    return characterProfilPic[characterClass] || defaultImg;
  }

  static getCharacterProfilPicOrDefault(characterClass?: CharacterClass): string {
    return characterClass ? this.getCharacterProfilPic(characterClass) : defaultImg;
  }
}
