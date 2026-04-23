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
  type TurnEndedPayload,
  type PlayerInfo,
  type GameStartedPayload,
  type DmMoveTokenPayload,
  type DmHiddenRollPayload,
  type DmGrantItemPayload,
  type ItemGrantedPayload,
  type DmSpawnUnitPayload,
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
import { clearUnits } from "../../game/stores/UnitsStore";
import { clearTiles } from "../../game/stores/TilesStore";
import { resetGameState } from "../../game/stores/GameStateStore";
import { authStore } from "../../stores/auth.store";
import { AuthService } from "../auth.service";
import { loadMap } from "../mapStorage";
import { getApiUrl } from "../config";
import { getDiscordContextIds } from "../discord";
import {
  addPartyChatMessage,
  clearPartyChat,
  type PartyChatMessage,
} from "../../stores/partyChat.store";
import { showDmMessage, showPlayerBubble } from "../../stores/dialogue.store";
import {
  getPlayerUnits,
  removeUnitsByOwnerUserId,
} from "../../game/stores/UnitsStore";
import { addHiddenRoll, addGrantedItem } from "../../stores/dmTools.store";

const HUB = {
  createSession: "CreateSession",
  joinSession: "JoinSession",
  leaveSession: "LeaveSession",
  kickPlayer: "KickPlayer",
  createRoom: "CreateRoom",
  subscribeCampaign: "SubscribeCampaign",
  unsubscribeCampaign: "UnsubscribeCampaign",
  subscribeActivity: "SubscribeActivity",
  unsubscribeActivity: "UnsubscribeActivity",
  selectCharacter: "SelectCharacter",
  startGame: "StartGame",
  endTurn: "EndTurn",
  sendUnitMove: "SendUnitMove",
  sendAbilityUsed: "SendAbilityUsed",
  // DM Tools
  dmMoveToken: "DmMoveToken",
  dmHiddenRoll: "DmHiddenRoll",
  dmGrantItem: "DmGrantItem",
  dmSpawnUnit: "DmSpawnUnit",
  dmStartCombat: "DmStartCombat",
  dmEndCombat: "DmEndCombat",
  dmRestartGame: "DmRestartGame",
  dmSwitchMap: "DmSwitchMap",
  selectDefaultTemplate: "SelectDefaultTemplate",
} as const;

async function tryBindDiscordVoiceToSession(sessionId: string): Promise<void> {
  const ctx = getDiscordContextIds();
  if (!ctx) return;
  const token = AuthService.getToken();
  if (!token) return;

  try {
    const voiceChannelId = ctx.voiceChannelId || ctx.channelId;
    const res = await fetch(
      `${getApiUrl().replace(/\/$/, "")}/api/party-chat/bind`,
      {
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
      },
    );

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
  syncHubUserId();
  const ctx = getDiscordContextIds();
  const voiceChannelId = ctx?.voiceChannelId || ctx?.channelId || null;
  const raw = await signalRService.invoke(
    HUB.createSession,
    campaignId,
    ctx?.guildId ?? null,
    voiceChannelId,
  );
  syncHubUserId();
  const result = normalizeSession(raw as Record<string, unknown>);
  setSession(result);
  clearPartyChat();
  await tryBindDiscordVoiceToSession(result.sessionId);
  return result;
}

/** S'abonner aux notifications d'une campagne (ex: SessionStarted). */
export async function subscribeCampaign(campaignId: string): Promise<void> {
  await signalRService.invoke(HUB.subscribeCampaign, campaignId);
}

/** Se désabonner des notifications d'une campagne. */
export async function unsubscribeCampaign(campaignId: string): Promise<void> {
  await signalRService.invoke(HUB.unsubscribeCampaign, campaignId);
}

/** S'abonner aux notifications d'une activité Discord (guild + salon vocal). */
export async function subscribeActivity(
  guildId: string,
  voiceChannelId: string,
): Promise<void> {
  await signalRService.invoke(HUB.subscribeActivity, guildId, voiceChannelId);
}

/** Se désabonner des notifications d'une activité Discord. */
export async function unsubscribeActivity(
  guildId: string,
  voiceChannelId: string,
): Promise<void> {
  await signalRService.invoke(HUB.unsubscribeActivity, guildId, voiceChannelId);
}

/** Rejoindre une session par son ID. */
export async function joinSession(sessionId: string): Promise<JoinResult> {
  syncHubUserId();
  const raw = (await signalRService.invoke(
    HUB.joinSession,
    sessionId,
  )) as Record<string, unknown>;
  syncHubUserId();
  const result: JoinResult = {
    success: !!raw.success,
    message: raw.message as string | undefined,
    session: raw.session
      ? normalizeSession(raw.session as Record<string, unknown>)
      : undefined,
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
  // Drop the board state bound to the session that was just left. Without
  // this, joining a new session from the same tab inherits the previous
  // roster — the `DmUnitSpawned` broadcast from the new session then lands
  // on top of stale units and the cross-client roster ends up desynced
  // (BUG-E). Engine disposal happens separately via GameCanvas unmount.
  clearUnits();
  clearTiles();
  resetGameState();
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
export async function selectCharacter(
  characterId: string | null,
): Promise<void> {
  await signalRService.invoke(HUB.selectCharacter, characterId);
}

/** Pick a quickstart preset (warrior / mage / archer). Mutually exclusive with
 * selectCharacter — whichever was called most recently wins server-side. */
export async function selectDefaultTemplate(
  templateId: "warrior" | "mage" | "archer" | null,
): Promise<void> {
  await signalRService.invoke(HUB.selectDefaultTemplate, templateId);
}

/** Lancer la partie (host uniquement). Envoie les données de la map pour les joueurs distants. */
export async function startGame(mapId: string): Promise<void> {
  let mapData: string | null = null;
  if (mapId && mapId !== "default") {
    const map = loadMap(mapId);
    if (map) {
      mapData = JSON.stringify(map);
    }
  }
  await signalRService.invoke(HUB.startGame, mapId, mapData);
}

/** DM-only: restart an in-progress session. Server rebuilds assignments and
 * re-broadcasts GameStarted to every client. Unlike startGame, this doesn't
 * require the session to be in Lobby state. */
export async function dmRestartGame(mapId: string): Promise<void> {
  let mapData: string | null = null;
  if (mapId && mapId !== "default") {
    const map = loadMap(mapId);
    if (map) {
      mapData = JSON.stringify(map);
    }
  }
  await signalRService.invoke(HUB.dmRestartGame, mapId, mapData);
}

/** DM-only: swap the session's scene to another of the campaign's persisted maps.
 * Server broadcasts MapSwitched to the session group. */
export async function dmSwitchMap(mapId: string): Promise<void> {
  await signalRService.invoke(HUB.dmSwitchMap, mapId);
}

// --- Actions de jeu (server-authoritative via hub) ---

export async function endTurn(payload: TurnEndedPayload): Promise<void> {
  await signalRService.invoke(HUB.endTurn, payload);
}

/** Broadcast a player/DM movement — server validates ownership + phase. */
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

// --- DM Tools (E-MJ) ---

/** DM force-moves any token on the board. */
export async function dmMoveToken(payload: DmMoveTokenPayload): Promise<void> {
  await signalRService.invoke(HUB.dmMoveToken, payload);
}

/** DM rolls a hidden dice (result only sent back to caller). */
export async function dmHiddenRoll(
  diceType: number = 20,
  modifier: number = 0,
  label?: string,
): Promise<DmHiddenRollPayload> {
  return signalRService.invoke(
    HUB.dmHiddenRoll,
    diceType,
    modifier,
    label ?? null,
  ) as Promise<DmHiddenRollPayload>;
}

/** DM grants an item to a player. */
export async function dmGrantItem(payload: DmGrantItemPayload): Promise<void> {
  await signalRService.invoke(HUB.dmGrantItem, payload);
}

/** DM spawns a new enemy unit. */
export async function dmSpawnUnit(payload: DmSpawnUnitPayload): Promise<void> {
  await signalRService.invoke(HUB.dmSpawnUnit, payload);
}

/** DM flips the session from free-roam into combat preparation. Server broadcasts
 * CombatStarted to every client in the session group. */
export async function dmStartCombat(): Promise<void> {
  await signalRService.invoke(HUB.dmStartCombat);
}

/** DM-only: forcibly end combat and return the session to free roam. */
export async function dmEndCombat(): Promise<void> {
  await signalRService.invoke(HUB.dmEndCombat);
}

// --- Enregistrement des handlers d'événements ---

import { normalizePlayer, normalizeSession } from "./multiplayer.normalizers";

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
    if (userId != null) {
      removePlayerFromSession(String(userId));
      removeUnitsByOwnerUserId(String(userId));
    }
  });

  signalRService.on("PlayerKicked", (data: Record<string, unknown>) => {
    const userId = data.userId ?? data.UserId;
    if (userId != null) {
      removePlayerFromSession(String(userId));
      removeUnitsByOwnerUserId(String(userId));
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
      removeUnitsByOwnerUserId(String(userId));
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
    // Always keep chat history
    addPartyChatMessage({
      sessionId: String((data as any).sessionId ?? ""),
      content: String((data as any).content ?? ""),
      authorName: String((data as any).authorName ?? ""),
      authorUserId: String((data as any).authorUserId ?? ""),
      authorDiscordId: String((data as any).authorDiscordId ?? ""),
      authorAvatar: ((data as any).authorAvatar ?? null) as string | null,
      authorRole: ((data as any).authorRole ?? "Player") as any,
      timestamp: Number((data as any).timestamp ?? Date.now()),
      messageId: String((data as any).messageId ?? ""),
    });

    // Show in-game dialogue UI (bubbles / DM overlay) when possible.
    const text = String((data as any).content ?? "").trim();
    if (!text) return;

    const role = String((data as any).authorRole ?? "Player");
    const authorName = String((data as any).authorName ?? "Joueur");
    const authorUserId = String((data as any).authorUserId ?? "").toLowerCase();

    if (role === "DM") {
      showDmMessage(text);
      return;
    }

    const players = getPlayerUnits();
    if (players.length === 0) return;

    const unit =
      (authorUserId
        ? players.find(
            (u) => String(u.ownerUserId ?? "").toLowerCase() === authorUserId,
          )
        : undefined) ?? players[0];

    // Deterministic-ish color per author
    const palette = [
      // brand-literal – multiplayer player-identification colors
      "#3b82f6",
      "#ef4444",
      "#22c55e",
      "#f59e0b",
      "#ec4899",
      "#06b6d4",
    ];
    let hash = 0;
    for (let i = 0; i < authorUserId.length; i++)
      hash = (hash * 31 + authorUserId.charCodeAt(i)) >>> 0;
    const color = palette[hash % palette.length];

    showPlayerBubble(unit.id, text, authorName, color);
  });

  // Session mise à jour (si le backend envoie SessionUpdated)
  signalRService.on("SessionUpdated", (data: Record<string, unknown>) => {
    updateSession(normalizeSession(data));
  });

  // --- DM Tools events ---

  // Hidden roll result (only received by the DM who rolled)
  signalRService.on("DmHiddenRollResult", (data: DmHiddenRollPayload) => {
    addHiddenRoll(data);
  });

  // Item granted to a player (broadcast to all)
  signalRService.on("ItemGranted", (msg: any) => {
    const payload: ItemGrantedPayload = msg?.payload ?? msg;
    addGrantedItem(payload);
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
  const raw = (await signalRService.invoke(
    HUB.joinSession,
    sessionId,
  )) as Record<string, unknown>;
  syncHubUserId();
  const result: JoinResult = {
    success: !!raw.success,
    message: raw.message as string | undefined,
    session: raw.session
      ? normalizeSession(raw.session as Record<string, unknown>)
      : undefined,
  };
  applyJoinResult(result);

  if (!result.success) return false;

  // Post-rework the server replays GameStarted + CombatStarted automatically
  // via SendRejoinSnapshotAsync (triggered by OnConnectedAsync or RejoinSession).
  // No explicit state-request call needed — dead code path removed with
  // StateManager + RequestFullState hub method.
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
    // Server owns the user→session mapping post-rework (SessionManager.FindSessionByUser).
    // Invoking RejoinSession with no args triggers SendRejoinSnapshotAsync on the back,
    // which re-adds the caller to the SignalR group + pushes GameStarted + CombatStarted
    // (when in combat) as replay events. The existing front handlers consume those and
    // rehydrate the board. Closes BUG-R.
    try {
      const rejoined = await signalRService.invoke("RejoinSession");
      if (rejoined) return;
    } catch (err) {
      console.warn("RejoinSession (server-side lookup) failed, falling back:", err);
    }
    // Legacy fallback: rejoin by sessionId from local/persisted state.
    const sid =
      sessionState.session?.sessionId ?? getPersistedSession()?.sessionId;
    if (!sid) return;
    try {
      await rejoinSession(sid);
    } catch (err) {
      console.warn("Auto-rejoin after reconnect failed:", err);
    }
  });
}
