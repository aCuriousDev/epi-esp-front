/**
 * Service multijoueur : session + événements + appels hub.
 */

import { signalRService } from "./SignalRService";
import {
  PlayerRole,
  ConnectionStatus,
  SessionState,
  type SessionInfo,
  type JoinResult,
  type KickResult,
  type MoveRequest,
  type MoveResult,
  type AttackRequest,
  type AttackResult,
  type UseAbilityRequest,
  type UseAbilityResult,
  type TurnEndedPayload,
  type GameMessage,
  type GameStateSnapshotPayload,
  type PlayerInfo,
  type GameStartedPayload,
} from "../../types/multiplayer";
import {
  setSession,
  clearSession,
  setSessionError,
  setSessionLoading,
  applyJoinResult,
  applyKickResult,
  removePlayerFromSession,
  upsertPlayerInSession,
  updateSession,
  setGameStarted,
  setHubUserId,
  getPersistedSession,
  sessionState,
} from "../../stores/session.store";
import { registerGameSyncHandlers } from "./gameSync";
import { authStore } from "../../stores/auth.store";
import { AuthService } from "../auth.service";
import { loadMap } from "../mapStorage";
import { getApiUrl } from "../config";
import { getDiscordContextIds } from "../discord";
import { addPartyChatMessage, clearPartyChat, type PartyChatMessage } from "../../stores/partyChat.store";

const HUB = {
  createSession: "CreateSession",
  joinSession: "JoinSession",
  leaveSession: "LeaveSession",
  kickPlayer: "KickPlayer",
  createRoom: "CreateRoom",
  selectCharacter: "SelectCharacter",
  startGame: "StartGame",
  move: "Move",
  attack: "Attack",
  useAbility: "UseAbility",
  endTurn: "EndTurn",
  requestFullState: "RequestFullState",
  sendGameStateSnapshot: "SendGameStateSnapshot",
  sendUnitMove: "SendUnitMove",
  sendAbilityUsed: "SendAbilityUsed",
  sendEndTurn: "SendEndTurn",
} as const;

async function tryBindDiscordVoiceToSession(sessionId: string): Promise<void> {
  const ctx = getDiscordContextIds();
  if (!ctx) return;
  const token = AuthService.getToken();
  if (!token) return;

  try {
    const voiceChannelId = ctx.voiceChannelId || ctx.channelId;
    const res = await fetch(`${getApiUrl().replace(/\/$/, "")}/api/party-chat/bind`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        sessionId,
        guildId: ctx.guildId,
        voiceChannelId,
      }),
      credentials: "include",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("party-chat bind failed:", res.status, text);
    } else {
      console.log("party-chat bind ok", {
        sessionId,
        guildId: ctx.guildId,
        channelId: ctx.channelId,
        voiceChannelId: ctx.voiceChannelId,
        boundVoiceChannelId: voiceChannelId,
      });
    }
  } catch (e) {
    console.warn("party-chat bind failed:", e);
  }
}

/** Créer une session pour une campagne (DM). campaignId = GUID string. */
export async function createSession(campaignId: string): Promise<SessionInfo> {
  const raw = await signalRService.invoke(HUB.createSession, campaignId);
  const result = normalizeSession(raw as Record<string, unknown>);
  setSession(result);
  clearPartyChat();
  await tryBindDiscordVoiceToSession(result.sessionId);
  return result;
}

/** Rejoindre une session par son ID. */
export async function joinSession(sessionId: string): Promise<JoinResult> {
  syncHubUserId();
  const raw = (await signalRService.invoke(HUB.joinSession, sessionId)) as Record<string, unknown>;
  syncHubUserId();
  const result: JoinResult = {
    success: !!raw.success,
    message: raw.message as string | undefined,
    session: raw.session ? normalizeSession(raw.session as Record<string, unknown>) : undefined,
  };
  applyJoinResult(result);
  if (result.success && result.session) {
    clearPartyChat();
    await tryBindDiscordVoiceToSession(result.session.sessionId);
  }
  return result;
}

/** Quitter la session courante. */
export async function leaveSession(): Promise<void> {
  await signalRService.invoke(HUB.leaveSession);
  clearSession();
  clearPartyChat();
  resetHandlersRegistered();
}

/** Exclure un joueur (DM uniquement). */
export async function kickPlayer(targetUserId: string): Promise<KickResult> {
  const result = (await signalRService.invoke(
    HUB.kickPlayer,
    targetUserId,
  )) as KickResult;
  applyKickResult(result);
  return result;
}

/** Sync hubUserId from SignalR service to session store. */
function syncHubUserId(): void {
  if (signalRService.hubUserId) {
    setHubUserId(signalRService.hubUserId);
  }
}

/** Créer une room standalone (multijoueur libre). */
export async function createRoom(maxPlayers: number): Promise<SessionInfo> {
  syncHubUserId();
  const raw = await signalRService.invoke(HUB.createRoom, maxPlayers);
  syncHubUserId();
  const result = normalizeSession(raw as Record<string, unknown>);
  setSession(result);
  return result;
}

/** Sélectionner un personnage dans le lobby. null = personnage par défaut. */
export async function selectCharacter(characterId: string | null): Promise<void> {
  await signalRService.invoke(HUB.selectCharacter, characterId);
}

/** Lancer la partie (host uniquement). Envoie les données de la map pour les joueurs distants. */
export async function startGame(mapId: string): Promise<void> {
  let mapData: string | null = null;
  if (mapId && mapId !== 'default') {
    const map = loadMap(mapId);
    if (map) {
      mapData = JSON.stringify(map);
    }
  }
  await signalRService.invoke(HUB.startGame, mapId, mapData);
}

// --- Actions de jeu (E2.3, server-authoritative) ---

export async function move(request: MoveRequest): Promise<MoveResult> {
  return signalRService.invoke(HUB.move, request) as Promise<MoveResult>;
}

export async function attack(request: AttackRequest): Promise<AttackResult> {
  return signalRService.invoke(HUB.attack, request) as Promise<AttackResult>;
}

export async function useAbility(
  request: UseAbilityRequest,
): Promise<UseAbilityResult> {
  return signalRService.invoke(HUB.useAbility, request) as Promise<UseAbilityResult>;
}

export async function endTurn(payload: TurnEndedPayload): Promise<void> {
  await signalRService.invoke(HUB.endTurn, payload);
}

export async function requestFullState(): Promise<
  GameMessage<GameStateSnapshotPayload>
> {
  return signalRService.invoke(HUB.requestFullState) as Promise<
    GameMessage<GameStateSnapshotPayload>
  >;
}

/** Envoyer un snapshot d'état (legacy / sync manuelle). */
export async function sendGameStateSnapshot(
  snapshot: GameStateSnapshotPayload,
): Promise<void> {
  await signalRService.invoke(HUB.sendGameStateSnapshot, snapshot);
}

/** Legacy: broadcast mouvement sans validation serveur. */
export async function sendUnitMove(payload: {
  unitId: string;
  path: { x: number; y: number }[];
  apCost: number;
  remainingAp: number;
}): Promise<void> {
  await signalRService.invoke(HUB.sendUnitMove, payload);
}

/** Legacy: broadcast capacité. */
export async function sendAbilityUsed(payload: {
  unitId: string;
  abilityId: string;
  targets: string[];
  diceResult?: { diceType: number; roll: number; modifier: number };
  effects: unknown[];
}): Promise<void> {
  await signalRService.invoke(HUB.sendAbilityUsed, payload);
}

/** Legacy: broadcast fin de tour. */
export async function sendEndTurn(payload: TurnEndedPayload): Promise<void> {
  await signalRService.invoke(HUB.sendEndTurn, payload);
}

// --- Enregistrement des handlers d'événements ---

/** Map backend integer enum to frontend enum. Backend: 0=Player, 1=DungeonMaster */
const ROLE_MAP: Record<number, PlayerRole> = { 0: PlayerRole.Player, 1: PlayerRole.DungeonMaster };
const STATUS_MAP: Record<number, ConnectionStatus> = { 0: ConnectionStatus.Connected, 1: ConnectionStatus.Disconnected, 2: ConnectionStatus.Reconnecting };
const STATE_MAP: Record<number, SessionState> = { 0: SessionState.Lobby, 1: SessionState.InProgress, 2: SessionState.Paused, 3: SessionState.Ended };

function normalizeRole(v: unknown): PlayerRole {
  if (typeof v === "number") return ROLE_MAP[v] ?? PlayerRole.Player;
  if (v === PlayerRole.Player || v === PlayerRole.DungeonMaster) return v;
  return PlayerRole.Player;
}

function normalizeStatus(v: unknown): ConnectionStatus {
  if (typeof v === "number") return STATUS_MAP[v] ?? ConnectionStatus.Connected;
  if (v === ConnectionStatus.Connected || v === ConnectionStatus.Disconnected || v === ConnectionStatus.Reconnecting) return v;
  return ConnectionStatus.Connected;
}

function normalizeState(v: unknown): SessionState {
  if (typeof v === "number") return STATE_MAP[v] ?? SessionState.Lobby;
  if (v === SessionState.Lobby || v === SessionState.InProgress || v === SessionState.Paused || v === SessionState.Ended) return v;
  return SessionState.Lobby;
}

function normalizePlayer(raw: Record<string, unknown>): PlayerInfo {
  return {
    userId: String(raw.userId ?? raw.UserId ?? ""),
    userName: String(raw.userName ?? raw.UserName ?? "?"),
    role: normalizeRole(raw.role ?? raw.Role),
    status: normalizeStatus(raw.status ?? raw.Status),
    selectedCharacterId: (raw.selectedCharacterId ?? raw.SelectedCharacterId) as string | undefined,
    selectedCharacterName: (raw.selectedCharacterName ?? raw.SelectedCharacterName) as string | undefined,
  };
}

function normalizeSession(raw: Record<string, unknown>): SessionInfo {
  const players = Array.isArray(raw.players)
    ? (raw.players as Record<string, unknown>[]).map(normalizePlayer)
    : [];
  return {
    sessionId: String(raw.sessionId ?? raw.SessionId ?? ""),
    campaignId: (raw.campaignId ?? raw.CampaignId) as string | undefined,
    campaignName: (raw.campaignName ?? raw.CampaignName) as string | undefined,
    playerCount: Number(raw.playerCount ?? raw.PlayerCount ?? 0),
    maxPlayers: Number(raw.maxPlayers ?? raw.MaxPlayers ?? 6),
    state: normalizeState(raw.state ?? raw.State),
    mapId: (raw.mapId ?? raw.MapId) as string | undefined,
    players,
  };
}

/**
 * Enregistre tous les handlers SignalR pour la session et le jeu.
 * À appeler après connect().
 */
export function registerMultiplayerHandlers(): void {
  signalRService.on("PlayerJoined", (data: Record<string, unknown>) => {
    const player = normalizePlayer({
      userId: data.userId,
      userName: data.userName,
      role: "Player",
      status: "Connected",
    });
    upsertPlayerInSession(player);
  });

  signalRService.on("PlayerLeft", (data: Record<string, unknown>) => {
    const userId = data.userId ?? data.UserId;
    if (userId != null) removePlayerFromSession(String(userId));
  });

  signalRService.on("PlayerKicked", (data: Record<string, unknown>) => {
    const userId = data.userId ?? data.UserId;
    if (userId != null) {
      removePlayerFromSession(String(userId));
      const me = authStore.user()?.id;
      if (me && String(userId) === String(me)) {
        clearSession();
        setSessionError("Vous avez été exclu de la session.");
      }
    }
  });

  signalRService.on("PlayerDisconnected", (data: Record<string, unknown>) => {
    const userId = data.userId ?? data.UserId;
    if (userId != null) {
      // Option: marquer le joueur comme Disconnected au lieu de le retirer
      removePlayerFromSession(String(userId));
    }
  });

  // PlayerUpdated (character selection in lobby)
  signalRService.on("PlayerUpdated", (data: Record<string, unknown>) => {
    updateSession(normalizeSession(data));
  });

  // GameStarted (host started the game)
  signalRService.on("GameStarted", (data: GameStartedPayload) => {
    setGameStarted(data);
  });

  // Discord voice channel chat (filtered server-side to players in session)
  signalRService.on("PartyChatMessage", (data: PartyChatMessage) => {
    addPartyChatMessage({
      sessionId: String((data as any).sessionId ?? ""),
      content: String((data as any).content ?? ""),
      authorName: String((data as any).authorName ?? ""),
      authorDiscordId: String((data as any).authorDiscordId ?? ""),
      authorAvatar: ((data as any).authorAvatar ?? null) as string | null,
      authorRole: ((data as any).authorRole ?? "Player") as any,
      timestamp: Number((data as any).timestamp ?? Date.now()),
      messageId: String((data as any).messageId ?? ""),
    });
  });

  // Session mise à jour (si le backend envoie SessionUpdated)
  signalRService.on("SessionUpdated", (data: Record<string, unknown>) => {
    updateSession(normalizeSession(data));
  });

  // Optionnel: SessionEnded
  signalRService.on("SessionEnded", (_reason: string) => {
    clearSession();
    resetHandlersRegistered();
    setSessionError("La session a été terminée.");
  });
}

// --- Reconnection ---

/**
 * Rejoin an existing session after a reconnect (automatic or page refresh).
 * Re-calls JoinSession on the hub so the new ConnectionId is added to the
 * SignalR group, then requests the latest game state if a game is in progress.
 */
export async function rejoinSession(sessionId: string): Promise<boolean> {
  syncHubUserId();
  const raw = (await signalRService.invoke(HUB.joinSession, sessionId)) as Record<string, unknown>;
  syncHubUserId();
  const result: JoinResult = {
    success: !!raw.success,
    message: raw.message as string | undefined,
    session: raw.session ? normalizeSession(raw.session as Record<string, unknown>) : undefined,
  };
  applyJoinResult(result);

  if (!result.success) return false;

  if (result.session?.state === SessionState.InProgress) {
    try {
      await signalRService.invoke(HUB.requestFullState);
    } catch (e) {
      console.warn("RequestFullState failed after rejoin:", e);
    }
  }
  return true;
}

/**
 * Attempt to recover a session from sessionStorage after page refresh.
 * Returns true if the session was successfully rejoined.
 */
export async function tryRecoverSession(): Promise<boolean> {
  const persisted = getPersistedSession();
  if (!persisted) return false;
  if (!AuthService.hasToken()) return false;

  setSessionLoading(true);
  try {
    if (!signalRService.isConnected) {
      await signalRService.connect();
      resetHandlersRegistered();
    }
    ensureMultiplayerHandlersRegistered();
    const ok = await rejoinSession(persisted.sessionId);
    if (!ok) {
      clearSession();
    }
    return ok;
  } catch (err: any) {
    console.warn("Session recovery failed:", err?.message);
    clearSession();
    return false;
  } finally {
    setSessionLoading(false);
  }
}

// --- Handler registration ---

let _handlersRegistered = false;

export function resetHandlersRegistered(): void {
  _handlersRegistered = false;
}

export function ensureMultiplayerHandlersRegistered(): void {
  if (_handlersRegistered) return;
  _handlersRegistered = true;
  registerMultiplayerHandlers();
  registerGameSyncHandlers();
  syncHubUserId();

  signalRService.onClose(() => {
    _handlersRegistered = false;
  });

  signalRService.onReconnected(async () => {
    const sid = sessionState.session?.sessionId ?? getPersistedSession()?.sessionId;
    if (!sid) return;
    try {
      await rejoinSession(sid);
    } catch (err) {
      console.warn("Auto-rejoin after reconnect failed:", err);
    }
  });
}
