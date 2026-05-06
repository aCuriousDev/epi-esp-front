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
  { id: 'village_square',  label: 'Village Square',     dimension: { width: 20, height: 15 } },
  { id: 'dark_forest',     label: 'Dark Forest',        dimension: { width: 30, height: 25 } },
  { id: 'ancient_dungeon', label: 'Ancient Dungeon',    dimension: { width: 15, height: 20 } },
  { id: 'throne_room',     label: 'Throne Room',        dimension: { width: 25, height: 20 } },
  { id: 'tavern',          label: 'Tavern',             dimension: { width: 12, height: 10 } },
  { id: 'mountain_pass',   label: 'Mountain Pass',      dimension: { width: 18, height: 12 } },
];

export const HARDCODED_VILLAINS: GameCharacter[] = [
  { id: 'goblin',      label: 'Goblin'      },
  { id: 'orc',         label: 'Orc'         },
  { id: 'troll',       label: 'Troll'       },
  { id: 'skeleton',    label: 'Skeleton'    },
  { id: 'dark_wizard', label: 'Dark Wizard' },
  { id: 'dragon',      label: 'Dragon'      },
  { id: 'bandit',      label: 'Bandit'      },
  { id: 'vampire',     label: 'Vampire'     },
];
