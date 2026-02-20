/**
 * Service multijoueur : session + événements + appels hub.
 */

import { signalRService } from "./SignalRService";
import type {
  SessionInfo,
  JoinResult,
  KickResult,
  MoveRequest,
  MoveResult,
  AttackRequest,
  AttackResult,
  UseAbilityRequest,
  UseAbilityResult,
  TurnEndedPayload,
  GameMessage,
  GameStateSnapshotPayload,
  PlayerInfo,
} from "../../types/multiplayer";
import {
  setSession,
  clearSession,
  setSessionError,
  applyJoinResult,
  applyKickResult,
  removePlayerFromSession,
  upsertPlayerInSession,
  updateSession,
} from "../../stores/session.store";
import { registerGameSyncHandlers } from "./gameSync";
import { authStore } from "../../stores/auth.store";

const HUB = {
  createSession: "CreateSession",
  joinSession: "JoinSession",
  leaveSession: "LeaveSession",
  kickPlayer: "KickPlayer",
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

/** Créer une session pour une campagne (DM). campaignId = GUID string. */
export async function createSession(campaignId: string): Promise<SessionInfo> {
  const result = (await signalRService.invoke(
    HUB.createSession,
    campaignId,
  )) as SessionInfo;
  setSession(result);
  return result;
}

/** Rejoindre une session par son ID. */
export async function joinSession(sessionId: string): Promise<JoinResult> {
  const result = (await signalRService.invoke(
    HUB.joinSession,
    sessionId,
  )) as JoinResult;
  applyJoinResult(result);
  return result;
}

/** Quitter la session courante. */
export async function leaveSession(): Promise<void> {
  await signalRService.invoke(HUB.leaveSession);
  clearSession();
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

function normalizePlayer(raw: Record<string, unknown>): PlayerInfo {
  return {
    userId: String(raw.userId ?? raw.UserId ?? ""),
    userName: String(raw.userName ?? raw.UserName ?? "?"),
    role: (raw.role ?? raw.Role ?? "Player") as PlayerInfo["role"],
    status: (raw.status ?? raw.Status ?? "Connected") as PlayerInfo["status"],
  };
}

function normalizeSession(raw: Record<string, unknown>): SessionInfo {
  const players = Array.isArray(raw.players)
    ? (raw.players as Record<string, unknown>[]).map(normalizePlayer)
    : [];
  return {
    sessionId: String(raw.sessionId ?? raw.SessionId ?? ""),
    campaignId: String(raw.campaignId ?? raw.CampaignId ?? ""),
    campaignName: String(raw.campaignName ?? raw.CampaignName ?? ""),
    playerCount: Number(raw.playerCount ?? raw.PlayerCount ?? 0),
    maxPlayers: Number(raw.maxPlayers ?? raw.MaxPlayers ?? 6),
    state: (raw.state ?? raw.State ?? "Lobby") as SessionInfo["state"],
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

  // Session mise à jour (si le backend envoie SessionUpdated)
  signalRService.on("SessionUpdated", (data: Record<string, unknown>) => {
    updateSession(normalizeSession(data));
  });

  // Optionnel: SessionEnded
  signalRService.on("SessionEnded", (_reason: string) => {
    clearSession();
    setSessionError("La session a été terminée.");
  });
}

/**
 * Désinscrit les handlers (à appeler avant disconnect si besoin).
 * SignalR ne propose pas off(methodName) sans callback, donc on garde les refs.
 */
let _handlersRegistered = false;

export function ensureMultiplayerHandlersRegistered(): void {
  if (_handlersRegistered) return;
  _handlersRegistered = true;
  registerMultiplayerHandlers();
  registerGameSyncHandlers();
}
