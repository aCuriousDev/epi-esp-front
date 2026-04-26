/**
 * Types pour le multijoueur SignalR (alignés avec le backend E2).
 */

export enum SessionState {
  Lobby = "Lobby",
  InProgress = "InProgress",
  Paused = "Paused",
  Ended = "Ended",
}

export enum PlayerRole {
  Player = "Player",
  DungeonMaster = "DungeonMaster",
}

export enum ConnectionStatus {
  Connected = "Connected",
  Disconnected = "Disconnected",
  Reconnecting = "Reconnecting",
}

export interface PlayerInfo {
  userId: string;
  userName: string;
  role: PlayerRole;
  status: ConnectionStatus;
  selectedCharacterId?: string;
  selectedCharacterName?: string;
  /** Lobby quickstart preset — "warrior" | "mage" | "archer" | undefined. */
  selectedDefaultTemplate?: string;
}

export interface SessionInfo {
  sessionId: string;
  joinCode?: string;
  campaignId?: string;
  campaignName?: string;
  playerCount: number;
  maxPlayers: number;
  state: SessionState;
  mapId?: string;
  players: PlayerInfo[];
}

export interface UnitAssignment {
  userId: string;
  unitId: string;
  unitName: string;
  characterClass: string;
  maxHp: number;
  currentHp: number;
  armorClass: number;
  speed: number;
  initiative: number;
  attackDamage: number;
  defense: number;
  movementRange: number;
  attackRange: number;
  /** Server-authoritative spawn position. Present when the back computed it
   *  at StartOrRestartGameAsync. Absent on pre-rework payloads — fall back to
   *  local placement in that case. */
  startX?: number;
  startY?: number;
}

export interface GameStartedPayload {
  mapId: string;
  mapData?: string;
  unitAssignments: UnitAssignment[];
}

export interface JoinResult {
  success: boolean;
  message?: string;
  session?: SessionInfo;
  playerInfo?: { userId: string; userName: string; role: PlayerRole; status: ConnectionStatus };
}

export interface KickResult {
  success: boolean;
  message?: string;
  kickedConnectionId?: string;
}

// --- Grille (aligné backend) ---
export interface GridPosition {
  x: number;
  y: number;
}

/**
 * Outcome shape for the legacy SendUnitMove broadcast — the hub forwards this
 * verbatim to OthersInGroup. Kept as the live move-broadcast contract.
 */
export interface MoveResult {
  unitId: string;
  path: GridPosition[];
  apCost: number;
  success: boolean;
  error?: string;
}

export interface TurnEndedPayload {
  unitId: string;
  /** Server-authoritative fields from the hub-authoritative rework. Absent on legacy broadcasts. */
  nextUnitId?: string | null;
  phase?: ServerCombatPhase;
  round?: number;
  outcome?: ServerCombatOutcome | null;
  /** Full unit roster with AP / HP reset info after the server advances the cursor. */
  units?: ServerUnitRuntimeState[];
}

/**
 * Matches `Multiplayer.Define.CombatPhase` on the back via `JsonStringEnumConverter`.
 */
export type ServerCombatPhase =
  | "FreeRoam"
  | "Preparation"
  | "PlayerTurn"
  | "EnemyTurn"
  | "Resolved";

/**
 * Matches `Multiplayer.Define.CombatResult`.
 */
export type ServerCombatOutcome = "Victory" | "Defeat" | "Fled";

export interface ServerUnitRuntimeState {
  unitId: string;
  ownerUserId: string | null;
  team: number; // 0=Player, 1=Enemy, 2=Ally, 3=Neutral (Multiplayer.Define.UnitTeam)
  name: string;
  positionX: number;
  positionY: number;
  currentHp: number;
  maxHp: number;
  currentAp: number;
  maxAp: number;
  initiative: number;
  isAlive: boolean;
}

/**
 * Server-authoritative payload broadcast when the DM starts combat. Added with
 * the hub-authoritative rework. Clients apply fields verbatim — no local
 * initiative rolling, no local phase transition.
 */
export interface CombatStartedPayload {
  phase?: ServerCombatPhase;
  round?: number;
  currentUnitId?: string | null;
  turnOrder?: string[];
  units?: ServerUnitRuntimeState[];
  // Legacy fields (pre-rework) kept for back-compat when the server skips the
  // new payload shape — still populated today by the rewritten DmStartCombat.
  initiativeOrder?: { unitId: string; initiative: number; controllerId: string }[];
  enemies?: unknown[];
}

export interface CombatEndedPayload {
  result?: ServerCombatOutcome;
  rewards?: { experienceGained: number; goldGained: number; itemsObtained: string[] };
}

/**
 * Wire-level ability-use event. Emitted when a unit fires an ability (attack
 * or spell) in a multiplayer session. Both the attacker and peers apply the
 * resulting HP / AP / cooldown changes via the gameSync handler — no client
 * computes damage independently.
 */
export interface AbilityUsedPayload {
  unitId: string;
  abilityId: string;
  targets: string[];
  effects: AbilityEffectPayload[];
  apCost?: number;
  cooldown?: number;
  diceResult?: { diceType: number; roll: number; modifier: number };
}

export interface AbilityEffectPayload {
  /** "Damage" | "Heal" | "Buff" | "Debuff" (server casing) */
  type: string;
  targetId: string;
  value: number;
}

/** DM-initiated HP adjust (heal or damage, any team). Server clamps delta to
 *  0..MaxHp; peers apply Hp + IsAlive verbatim and trigger death VFX when
 *  WasAlive && !IsAlive. */
export interface UnitHpAdjustedPayload {
  unitId: string;
  hp: number;
  maxHp: number;
  isAlive: boolean;
  /** Actual applied delta after clamping (may be less than requested). */
  delta: number;
  wasAlive: boolean;
}

// --- Message séquencé (backend) ---
export interface GameMessage<T> {
  type: string;
  sequenceNumber: number;
  timestamp: string;
  sessionId: string;
  payload: T;
}

// --- DM Tools Payloads ---

export interface DmMoveTokenPayload {
  unitId: string;
  target: GridPosition;
}

export interface DmHiddenRollPayload {
  diceType: number;
  result: number;
  modifier: number;
  total: number;
  label?: string;
  timestamp: string;
}

export interface DmGrantItemPayload {
  targetUserId: string;
  itemId: string;
  itemName: string;
  quantity: number;
  description?: string;
}

export interface ItemGrantedPayload {
  targetUserId: string;
  targetUserName: string;
  itemId: string;
  itemName: string;
  quantity: number;
  description?: string;
  timestamp: string;
}

export interface DmSpawnUnitPayload {
  unitId: string;
  templateId: string;
  name: string;
  unitType: string;
  target: GridPosition;
  statsJson: string;
}

export interface DmAwardExperiencePayload {
  targetUserId: string;
  experienceAmount: number;
}

export interface DmForceLevelUpPayload {
  targetUserId: string;
  levels: number;
}

export interface DmGrantGoldPayload {
  targetUserId: string;
  amount: number;
  currencyType: CurrencyType;
}

export type CurrencyType = "cp" | "sp" | "ep" | "gp" | "pp";

export interface CharacterProgressedPayload {
  targetUserId: string;
  targetUserName: string;
  characterId: string;
  awardedExperience: number;
  experienceRemainder: number;
  previousLevel: number;
  newLevel: number;
  levelUps: number;
  currentHitPoints: number;
  maxHitPoints: number;
  armorClass: number;
  initiative: number;
  speed: number;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  timestamp: string;
}

export interface GoldGrantedPayload {
  targetUserId: string;
  targetUserName: string;
  characterId: string;
  amount: number;
  currencyType: CurrencyType;
  copperPieces: number;
  silverPieces: number;
  electrumPieces: number;
  goldPieces: number;
  platinumPieces: number;
  totalInCopper: number;
  timestamp: string;
}

export interface GoldGrantedPublicPayload {
  targetUserId: string;
  targetCharacterName: string;
  currencyType: CurrencyType;
  amount: number;
}

export interface CharacterProgressedPublicPayload {
  targetUserId: string;
  targetCharacterName: string;
  newLevel: number;
  levelUps: number;
}
