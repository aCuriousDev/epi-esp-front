import {
  cloneAbilities,
  WARRIOR_ABILITIES,
  MAGE_ABILITIES,
  ARCHER_ABILITIES,
  ENEMY_ABILITIES,
} from '../abilities/AbilityDefinitions';

describe('AbilityDefinitions', () => {
  describe('ability arrays are non-empty', () => {
    it('WARRIOR_ABILITIES is non-empty', () => {
      expect(WARRIOR_ABILITIES.length).toBeGreaterThan(0);
    });

    it('MAGE_ABILITIES is non-empty', () => {
      expect(MAGE_ABILITIES.length).toBeGreaterThan(0);
    });

    it('ARCHER_ABILITIES is non-empty', () => {
      expect(ARCHER_ABILITIES.length).toBeGreaterThan(0);
    });

    it('ENEMY_ABILITIES is non-empty', () => {
      expect(ENEMY_ABILITIES.length).toBeGreaterThan(0);
    });
  });

  describe('cloneAbilities', () => {
    it('returns a new array (not the same reference)', () => {
      const cloned = cloneAbilities(WARRIOR_ABILITIES);
      expect(cloned).not.toBe(WARRIOR_ABILITIES);
    });

    it('returns abilities with same ids and names', () => {
      const cloned = cloneAbilities(WARRIOR_ABILITIES);
      expect(cloned.map(a => a.id)).toEqual(WARRIOR_ABILITIES.map(a => a.id));
      expect(cloned.map(a => a.name)).toEqual(WARRIOR_ABILITIES.map(a => a.name));
    });

    it('resets currentCooldown to 0', () => {
      // Manually set a cooldown on original to verify reset
      const originals = WARRIOR_ABILITIES.map(a => ({
        ...a,
        currentCooldown: 5,
        effects: [...a.effects],
      }));
      const cloned = cloneAbilities(originals);
      cloned.forEach(a => {
        expect(a.currentCooldown).toBe(0);
      });
    });

    it('deep clones so modifying clone does not affect original', () => {
      const originals = WARRIOR_ABILITIES.map(a => ({
        ...a,
        effects: [...a.effects],
      }));
      const cloned = cloneAbilities(originals);

      // Mutate clone
      cloned[0].baseDamage = 9999;
      cloned[0].effects.push({ type: 'heal' as const, value: 100 });

      // Original should be unchanged
      expect(originals[0].baseDamage).not.toBe(9999);
      expect(originals[0].effects.length).not.toBe(cloned[0].effects.length);
    });

    it('each cloned ability object is a different reference', () => {
      const cloned = cloneAbilities(WARRIOR_ABILITIES);
      cloned.forEach((a, i) => {
        expect(a).not.toBe(WARRIOR_ABILITIES[i]);
      });
    });
  });
});
