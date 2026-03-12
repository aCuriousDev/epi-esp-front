// ============================================
// GRID & POSITION TYPES
// ============================================

export interface GridPosition {
  x: number;
  z: number;
}

export interface WorldPosition {
  x: number;
  y: number;
  z: number;
}

// ============================================
// TILE TYPES
// ============================================

export enum TileType {
  FLOOR = 'floor',
  WALL = 'wall',
  OBSTACLE = 'obstacle',
  WATER = 'water',
  LAVA = 'lava',
  PIT = 'pit',
}

export interface Tile {
  position: GridPosition;
  type: TileType;
  elevation: number;
  walkable: boolean;
  movementCost: number;
  occupiedBy: string | null; // Unit ID
  effects: TileEffect[];
}

export interface TileEffect {
  id: string;
  type: 'damage' | 'heal' | 'slow' | 'buff' | 'debuff';
  value: number;
  duration: number;
}

// ============================================
// UNIT TYPES
// ============================================

export enum UnitType {
  WARRIOR = 'warrior',
  MAGE = 'mage',
  ROGUE = 'rogue',
  ARCHER = 'archer',
  HEALER = 'healer',
  ENEMY_SKELETON = 'enemy_skeleton',
  ENEMY_MAGE = 'enemy_mage',
}

export enum Team {
  PLAYER = 'player',
  ENEMY = 'enemy',
  NEUTRAL = 'neutral',
}

export interface UnitStats {
  maxHealth: number;
  currentHealth: number;
  maxActionPoints: number;
  currentActionPoints: number;
  movementRange: number;
  attackRange: number;
  attackDamage: number;
  defense: number;
  initiative: number; // Determines turn order
}

export interface Unit {
  id: string;
  name: string;
  type: UnitType;
  team: Team;
  position: GridPosition;
  stats: UnitStats;
  abilities: Ability[];
  statusEffects: StatusEffect[];
  isAlive: boolean;
  hasActed: boolean;
  hasMoved: boolean;
}

// ============================================
// ABILITY & COMBAT TYPES
// ============================================

export enum AbilityTargetType {
  SELF = 'self',
  SINGLE = 'single',
  AOE_CIRCLE = 'aoe_circle',
  AOE_LINE = 'aoe_line',
  AOE_CONE = 'aoe_cone',
}

export enum DamageType {
  PHYSICAL = 'physical',
  MAGICAL = 'magical',
  FIRE = 'fire',
  ICE = 'ice',
  LIGHTNING = 'lightning',
  HOLY = 'holy',
  DARK = 'dark',
}

export interface Ability {
  id: string;
  name: string;
  description: string;
  apCost: number;
  range: number;
  aoeRadius: number;
  targetType: AbilityTargetType;
  damageType: DamageType;
  baseDamage: number;
  cooldown: number;
  currentCooldown: number;
  effects: AbilityEffect[];
}

export interface AbilityEffect {
  type: 'damage' | 'heal' | 'buff' | 'debuff' | 'push' | 'pull' | 'teleport';
  value: number;
  duration?: number;
  statusEffect?: StatusEffectType;
}

export enum StatusEffectType {
  POISON = 'poison',
  BURN = 'burn',
  FREEZE = 'freeze',
  STUN = 'stun',
  SLOW = 'slow',
  HASTE = 'haste',
  SHIELD = 'shield',
  REGENERATION = 'regeneration',
}

export interface StatusEffect {
  id: string;
  type: StatusEffectType;
  value: number;
  duration: number;
  source: string; // Unit ID that applied it
}

// ============================================
// GAME STATE TYPES
// ============================================

export enum GameMode {
  FREE_ROAM = 'free_roam',
  COMBAT = 'combat',
  DUNGEON = 'dungeon',
}

export enum AppPhase {
  MODE_SELECTION = 'mode_selection',
  MAP_SELECTION = 'map_selection',
  DUNGEON_SETUP = 'dungeon_setup',
  IN_GAME = 'in_game',
}

export enum GamePhase {
  SETUP = 'setup',
  COMBAT_PREPARATION = 'combat_preparation',
  PLAYER_TURN = 'player_turn',
  ENEMY_TURN = 'enemy_turn',
  ANIMATION = 'animation',
  GAME_OVER = 'game_over',
  FREE_ROAM = 'free_roam',
}

export enum TurnPhase {
  SELECT_UNIT = 'select_unit',
  MOVE = 'move',
  ACTION = 'action',
  END_TURN = 'end_turn',
}

export interface GameState {
  mode: GameMode;
  phase: GamePhase;
  turnPhase: TurnPhase;
  currentTurn: number;
  turnOrder: string[]; // Unit IDs in initiative order
  currentUnitIndex: number;
  selectedUnit: string | null;
  selectedAbility: string | null;
  highlightedTiles: GridPosition[];
  pathPreview: GridPosition[];
  targetableTiles: GridPosition[];
  combatLog: CombatLogEntry[];
  mapId: string | null;
  dungeon: DungeonState | null;
}

export interface DungeonState {
  dungeonId: string;
  roomIds: string[];
  currentRoomIndex: number;
  totalRooms: number;
}

export interface CombatLogEntry {
  id: string;
  turn: number;
  timestamp: number;
  message: string;
  type: 'damage' | 'heal' | 'move' | 'ability' | 'status' | 'system';
}

// ============================================
// PATHFINDING TYPES
// ============================================

export interface PathNode {
  position: GridPosition;
  g: number; // Cost from start
  h: number; // Heuristic cost to end
  f: number; // Total cost (g + h)
  parent: PathNode | null;
}

// ============================================
// ACTION TYPES
// ============================================

export interface GameAction {
  type: ActionType;
  unitId: string;
  payload: unknown;
}

export enum ActionType {
  SELECT_UNIT = 'SELECT_UNIT',
  MOVE_UNIT = 'MOVE_UNIT',
  USE_ABILITY = 'USE_ABILITY',
  END_UNIT_TURN = 'END_UNIT_TURN',
  END_TURN = 'END_TURN',
  START_GAME = 'START_GAME',
  RESET_GAME = 'RESET_GAME',
}

export interface MoveAction extends GameAction {
  type: ActionType.MOVE_UNIT;
  payload: {
    path: GridPosition[];
    destination: GridPosition;
  };
}

export interface AbilityAction extends GameAction {
  type: ActionType.USE_ABILITY;
  payload: {
    abilityId: string;
    targetPosition: GridPosition;
    targetUnitIds: string[];
  };
}
