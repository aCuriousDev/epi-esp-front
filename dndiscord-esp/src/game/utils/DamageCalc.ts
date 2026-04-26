import { Unit, Ability } from '../../types';

export function calculateDamage(attacker: Unit, defender: Unit, ability: Ability): number {
  const baseDamage = ability.baseDamage + attacker.stats.attackDamage;
  const defense = defender.stats.defense;
  const reduction = defense / (defense + 50); // Diminishing returns formula
  const damage = Math.floor(baseDamage * (1 - reduction));
  return Math.max(1, damage); // Minimum 1 damage
}
