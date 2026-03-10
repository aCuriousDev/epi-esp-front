export interface GameMap {
  id: string;
  label: string;
  dimension: { width: number; height: number };
}

export interface GameCharacter {
  id: string;
  label: string;
}

export const HARDCODED_MAPS: GameMap[] = [
  { id: 'village_square',  label: 'Place du Village',   dimension: { width: 20, height: 15 } },
  { id: 'dark_forest',     label: 'Forêt Sombre',        dimension: { width: 30, height: 25 } },
  { id: 'ancient_dungeon', label: 'Donjon Ancien',        dimension: { width: 15, height: 20 } },
  { id: 'throne_room',     label: 'Salle du Trône',       dimension: { width: 25, height: 20 } },
  { id: 'tavern',          label: 'Taverne',              dimension: { width: 12, height: 10 } },
  { id: 'mountain_pass',   label: 'Col de Montagne',      dimension: { width: 18, height: 12 } },
];

export const HARDCODED_VILLAINS: GameCharacter[] = [
  { id: 'goblin',      label: 'Gobelin'   },
  { id: 'orc',         label: 'Orc'       },
  { id: 'troll',       label: 'Troll'     },
  { id: 'skeleton',    label: 'Squelette' },
  { id: 'dark_wizard', label: 'Mage Noir' },
  { id: 'dragon',      label: 'Dragon'    },
  { id: 'bandit',      label: 'Bandit'    },
  { id: 'vampire',     label: 'Vampire'   },
];
