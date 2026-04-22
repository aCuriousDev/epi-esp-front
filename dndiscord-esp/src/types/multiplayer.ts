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

// --- Requêtes / résultats d'actions (E2.3) ---
export interface MoveRequest {
  unitId: string;
  targetX: number;
  targetY: number;
  path?: GridPosition[];
}

export interface MoveResult {
  unitId: string;
  path: GridPosition[];
  apCost: number;
  success: boolean;
  error?: string;
}

export interface AttackRequest {
  attackerId: string;
  targetId: string;
  abilityId: string;
}

export interface AttackResult {
  attackerId: string;
  targetId: string;
  abilityId: string;
  diceRoll: number;
  modifier: number;
  total: number;
  hit: boolean;
  damage?: number;
  effects?: { type: string; targetId: string; value: number }[];
  success: boolean;
  error?: string;
}

export interface AbilityTargetInfo {
  targetUnitId?: string;
  targetX?: number;
  targetY?: number;
}

export interface UseAbilityRequest {
  unitId: string;
  abilityId: string;
  target: AbilityTargetInfo;
}

export interface UseAbilityResult {
  unitId: string;
  abilityId: string;
  success: boolean;
  effect?: { type: string; targetId: string; value: number };
  error?: string;
}

export interface TurnEndedPayload {
  unitId: string;
  /** Server-authoritative fields from the hub-authoritative rework. Absent on legacy broadcasts. */
  nextUnitId?: string | null;
  phase?: ServerCombatPhase;
  round?: number;
  outcome?: ServerCombatOutcome | null;
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

// --- Message séquencé (backend) ---
export interface GameMessage<T> {
  type: string;
  sequenceNumber: number;
  timestamp: string;
  sessionId: string;
  payload: T;
}

// --- Snapshot état (simplifié pour le front) ---
export interface GameStateSnapshotPayload {
  sessionId: string;
  combatState?: {
    isActive: boolean;
    currentRound: number;
    currentUnitId: string;
    initiativeOrder: { unitId: string; initiative: number; controllerId: string }[];
  };
  units: Array<{
    unitId: string;
    name: string;
    hp: number;
    maxHp: number;
    position: GridPosition;
    controllerId: string;
    statusEffects: string[];
  }>;
  mapState?: { width: number; height: number; tiles: unknown[] };
  lastSequenceNumber: number;
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
