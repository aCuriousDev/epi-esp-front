import { CharacterClass } from "../types/character";

// Class portrait files live under /public/assets/classes/ (not bundled by
// Rollup, so filenames are not content-hashed). Without a cache-buster the
// Discord Activity proxy + browsers serve the bytes from when the URL was
// first fetched, even after the bytes on disk change — which is how the
// post-rework portrait swap kept showing the old artwork. Appending the
// app version forces a fresh URL on every release.
const v = __APP_VERSION__;

const characterProfilPic: Record<CharacterClass, string> = {
  [CharacterClass.Barbare]: `/assets/classes/barbarian.png?v=${v}`,
  [CharacterClass.Barde]: `/assets/classes/bard.png?v=${v}`,
  [CharacterClass.Clerc]: `/assets/classes/cleric.png?v=${v}`,
  [CharacterClass.Druide]: `/assets/classes/druid.png?v=${v}`,
  [CharacterClass.Guerrier]: `/assets/classes/fighter.png?v=${v}`,
  [CharacterClass.Moine]: `/assets/classes/monk.png?v=${v}`,
  [CharacterClass.Paladin]: `/assets/classes/paladin.png?v=${v}`,
  [CharacterClass.Rodeur]: `/assets/classes/ranger.png?v=${v}`,
  [CharacterClass.Voleur]: `/assets/classes/rogue.png?v=${v}`,
  [CharacterClass.Ensorceleur]: `/assets/classes/sorcerer.png?v=${v}`,
  [CharacterClass.Sorcier]: `/assets/classes/warlock.png?v=${v}`,
  [CharacterClass.Magicien]: `/assets/classes/wizard.png?v=${v}`,
};

const defaultImg = `/assets/classes/rogue.png?v=${v}`;

export class GetCharacterProfilPic {
  static getCharacterProfilPic(characterClass: CharacterClass): string {
    return characterProfilPic[characterClass] || defaultImg;
  }

  static getCharacterProfilPicOrDefault(characterClass?: CharacterClass): string {
    return characterClass ? this.getCharacterProfilPic(characterClass) : defaultImg;
  }
}
