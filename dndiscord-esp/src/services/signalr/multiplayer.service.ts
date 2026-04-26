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
  type DmAwardExperiencePayload,
  type DmForceLevelUpPayload,
  type DmGrantGoldPayload,
  type CharacterProgressedPayload,
  type CharacterProgressedPublicPayload,
  type GoldGrantedPayload,
  type GoldGrantedPublicPayload,
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
import { resetGameState, gameState, setGameState } from "../../game/stores/GameStateStore";
import { GamePhase, Team } from "../../types";
import { authStore } from "../../stores/auth.store";
import { AuthService } from "../auth.service";
import { loadMap } from "../mapStorage";
import { getApiUrl } from "../config";
import { getDiscordContextIds } from "../discord";
import { normalizePlayer, normalizeSession } from "./multiplayer.normalizers";
import {
  unwrapPayload,
  dispatchProgressionPublic,
  dispatchGoldGrantedPublic,
} from "./multiplayer.eventHelpers";
import {
  addPartyChatMessage,
  clearPartyChat,
  type PartyChatMessage,
} from "../../stores/partyChat.store";
import { showDmMessage, showPlayerBubble } from "../../stores/dialogue.store";
import {
  units,
  removeUnitsByOwnerUserId,
} from "../../game/stores/UnitsStore";
import {
  addHiddenRoll,
  addGrantedItem,
  addCharacterProgressed,
  addGoldGranted,
} from "../../stores/dmTools.store";

const HUB = {
  createSession: "CreateSession",
  joinSession: "JoinSession",
  joinCampaignSession: "JoinCampaignSession",
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
  dmAdjustHp: "DmAdjustHp",
  dmAwardExperience: "DmAwardExperience",
  dmForceLevelUp: "DmForceLevelUp",
  dmGrantGold: "DmGrantGold",
  selectDefaultTemplate: "SelectDefaultTemplate",
  voteForChoice: "VoteForChoice",
  dmAdvanceNode: "DmAdvanceNode",
  dmLaunchCampaignMap: "DmLaunchCampaignMap",
  dmExitMap: "DmExitMap",
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
      const text = await res.text().catch((e: unknown) => (e instanceof Error ? e.message : String(e)));
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
  // Purge any board state left over from a previous session in this tab —
  // without this, the old session's DM-spawned enemies stayed in the units
  // store and contaminated the new session (isVictory() returned false
  // because ghost enemies kept isAlive=true, so every win was reported as
  // defeat; ghost enemies were also selectable in free roam but invisible
  // during combat since the server's new Combat.Units roster didn't include
  // them).
  clearUnits();
  clearTiles();
  resetGameState();
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
  // Same cross-session cleanup as createSession — stale units from a prior
  // session in this tab will otherwise survive into the new one and break
  // the victory/defeat outcome + ghost-selectable-but-invisible units.
  clearUnits();
  clearTiles();
  resetGameState();
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

/**
 * Rejoindre la session live d'une campagne par son campaignId.
 * Résout le problème de l'UUID base-de-données vs ID SignalR in-memory :
 * le hub cherche directement dans le SessionManager par campaignId.
 */
export async function joinCampaignSession(campaignId: string): Promise<JoinResult> {
  syncHubUserId();
  clearUnits();
  clearTiles();
  resetGameState();
  const raw = (await signalRService.invoke(
    HUB.joinCampaignSession,
    campaignId,
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

/** DM broadcasts that the map is done and all players should return to the session.
 * Players receive CampaignMapExited and navigate to the session page. */
export async function dmExitMap(
  campaignId: string,
  nodeId: string,
): Promise<void> {
  await signalRService.invoke(HUB.dmExitMap, campaignId, nodeId);
}

/** DM broadcasts a campaign map launch to all campaign subscribers.
 * Players receive CampaignMapLaunched, set their sessionMapConfig and
 * navigate to /board?fromSession=1. */
export async function dmLaunchCampaignMap(
  campaignId: string,
  configJson: string,
): Promise<void> {
  await signalRService.invoke(HUB.dmLaunchCampaignMap, campaignId, configJson);
}

/** DM broadcasts scenario node advancement to all campaign subscribers.
 * Players receive NodeAdvanced and navigate to nextNodeId automatically. */
export async function dmAdvanceNode(
  campaignId: string,
  fromNodeId: string,
  nextNodeId: string,
): Promise<void> {
  await signalRService.invoke(HUB.dmAdvanceNode, campaignId, fromNodeId, nextNodeId);
}

/** Diffuse le vote d'un joueur pour un choix sur un nœud Choices.
 * choiceIndex = -1 pour annuler. */
export async function voteForChoice(
  campaignId: string,
  nodeId: string,
  choiceIndex: number,
): Promise<void> {
  await signalRService.invoke(HUB.voteForChoice, campaignId, nodeId, choiceIndex);
}

/** Pick a quickstart preset (warrior / mage / archer). Mutually exclusive with
 * selectCharacter — whichever was called most recently wins server-side. */
export async function selectDefaultTemplate(
  templateId: "warrior" | "mage" | "archer" | null,
): Promise<void> {
  await signalRService.invoke(HUB.selectDefaultTemplate, templateId);
}

/** IDs réservés qui ne doivent jamais déclencher un lookup mapData.
 *  - "default" : grille procédurale générée côté client
 *  - "__tutorial__" et tout futur "__xxx__" : asset statique, pas de blob à envoyer */
function isReservedMapId(mapId: string): boolean {
  return mapId === "default" || /^__[a-z_]+__$/.test(mapId);
}

/** Lancer la partie (host uniquement). Envoie les données de la map pour les joueurs distants. */
export async function startGame(mapId: string): Promise<void> {
  let mapData: string | null = null;
  if (mapId && !isReservedMapId(mapId)) {
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
  if (mapId && !isReservedMapId(mapId)) {
    const map = loadMap(mapId);
    if (map) {
      mapData = JSON.stringify(map);
    }
  }
  await signalRService.invoke(HUB.dmRestartGame, mapId, mapData);
}

const GUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** DM-only: swap the session's scene to another of the campaign's persisted maps.
 * Server broadcasts MapSwitched to the session group. The hub method signature
 * is `DmSwitchMap(Guid mapId)`, so passing a non-UUID string (e.g. the
 * localStorage draft key the Map Editor uses) would throw on the server and
 * the error would be swallowed by the caller — silent failure. Guard here so
 * the caller sees an actionable error instead. */
export async function dmSwitchMap(mapId: string): Promise<void> {
  if (!mapId || !GUID_SHAPE.test(mapId)) {
    throw new Error(
      `dmSwitchMap: mapId must be a campaign-persisted UUID (got "${mapId}")`,
    );
  }
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

/** DM-only: heal (+) or damage (-) any unit in the combat roster. Server
 *  clamps to 0..MaxHp; peers apply the resulting HP + isAlive via the
 *  UnitHpAdjusted broadcast. */
export async function dmAdjustHp(unitId: string, delta: number): Promise<void> {
  await signalRService.invoke(HUB.dmAdjustHp, unitId, delta);
}

/** DM-only: award raw XP to a player's selected character. */
export async function dmAwardExperience(payload: DmAwardExperiencePayload): Promise<void> {
  await signalRService.invoke(HUB.dmAwardExperience, payload);
}

/** DM-only: force one or more level-ups on a player's selected character. */
export async function dmForceLevelUp(payload: DmForceLevelUpPayload): Promise<void> {
  await signalRService.invoke(HUB.dmForceLevelUp, payload);
}

/** DM-only: grant/remove a typed currency amount from a player's selected character wallet. */
export async function dmGrantGold(payload: DmGrantGoldPayload): Promise<void> {
  await signalRService.invoke(HUB.dmGrantGold, payload);
}

// --- Enregistrement des handlers d'événements ---

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
        setSessionError("You have been removed from the session.");
      }
    }
  });

  signalRService.on("PlayerDisconnected", (data: Record<string, unknown>) => {
    const userId = data.userId ?? data.UserId;
    if (userId == null) return;
    // Intentional: on a transient disconnect (page refresh, tab reload), keep
    // both the player entry and their unit mesh in place. The back marks the
    // player as Disconnected and runs a grace period before tearing down;
    // when they reconnect their token is still on the map so the DM never
    // sees a "player vanished" state. Voluntary leave (PlayerLeft) and DM
    // kick (PlayerKicked) still remove both — those handlers stay as-is.
  });

  // PlayerUpdated (character selection in lobby)
  signalRService.on("PlayerUpdated", (data: Record<string, unknown>) => {
    updateSession(normalizeSession(data));
  });

  // GameStarted (host started the game, or DmRestartGame after defeat/victory,
  // or OnConnectedAsync replay after reconnect/refresh). The store write
  // triggers BoardGame's createEffect — which dedupes by payload reference
  // so LobbyScreen's direct onGameStart call (for initial lobby→game) isn't
  // double-processed.
  signalRService.on("GameStarted", (data: GameStartedPayload) => {
    if (gameState.phase === GamePhase.GAME_OVER) {
      console.log("[multiplayer] GameStarted received during GAME_OVER — forcing phase to FREE_ROAM");
      setGameState("phase", GamePhase.FREE_ROAM);
    }
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

    // Include dead units — a player can still talk after being downed.
    const players = Object.values(units).filter(
      (u) => u.team === Team.PLAYER,
    );
    if (players.length === 0) return;

    const unit = authorUserId
      ? players.find(
          (u) => String(u.ownerUserId ?? "").toLowerCase() === authorUserId,
        )
      : undefined;

    if (!unit) {
      // Expected for the DM (no unit on the board) — warn only when an
      // authorUserId was provided but matched nothing, which signals a real
      // ownership-mapping bug rather than a legitimate DM message.
      if (authorUserId) {
        console.warn(
          "[partyChat] authorUserId present but matched no player unit — bubble suppressed; check ownerUserId mapping",
          authorUserId,
        );
      }
      return;
    }

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

  const handleProgressedDmAck = (msg: any) => {
    const payload = unwrapPayload<CharacterProgressedPayload>(msg);
    console.info("[DM] Character progression acknowledged", {
      targetUserId: payload.targetUserId,
      targetUserName: payload.targetUserName,
      newLevel: payload.newLevel,
      levelUps: payload.levelUps,
    });
  };

  const handleProgressedTarget = (msg: any) => {
    const payload = unwrapPayload<CharacterProgressedPayload>(msg);
    addCharacterProgressed(payload);
  };

  const handleProgressedPublic = (msg: any) => {
    const payload = unwrapPayload<CharacterProgressedPublicPayload>(msg);
    dispatchProgressionPublic(payload);
  };

  const handleGoldGrantedDmAck = (msg: any) => {
    const payload = unwrapPayload<GoldGrantedPayload>(msg);
    console.info("[DM] Gold grant acknowledged", {
      targetUserId: payload.targetUserId,
      targetUserName: payload.targetUserName,
      amount: payload.amount,
      currencyType: payload.currencyType,
    });
  };

  const handleGoldGrantedTarget = (msg: any) => {
    const payload = unwrapPayload<GoldGrantedPayload>(msg);
    addGoldGranted(payload);
  };

  const handleGoldGrantedPublic = (msg: any) => {
    const payload = unwrapPayload<GoldGrantedPublicPayload>(msg);
    dispatchGoldGrantedPublic(payload);
  };

  signalRService.on("CharacterProgressedDmAck", handleProgressedDmAck);
  signalRService.on("CharacterProgressed", handleProgressedTarget);
  signalRService.on("CharacterProgressedPublic", handleProgressedPublic);
  signalRService.on("GoldGrantedDmAck", handleGoldGrantedDmAck);
  signalRService.on("GoldGranted", handleGoldGrantedTarget);
  signalRService.on("GoldGrantedPublic", handleGoldGrantedPublic);

  // SessionEnded — DM left / host closed the session / back dropped it.
  // Tear the whole board state down so the remaining players don't stay
  // on an orphaned /board view (which was falling back to the solo roster
  // — Sir Roland / Elara / Theron — the moment they hit Recommencer
  // because isInSession() just flipped false). Navigate home on the next
  // tick; the clearSession/clearUnits/clearTiles combo guarantees no
  // session-scoped state leaks into whatever the player does next.
  signalRService.on("SessionEnded", (_reason: string) => {
    clearSession();
    resetHandlersRegistered();
    clearUnits();
    clearTiles();
    resetGameState();
    setSessionError("The session has ended.");
    try {
      if (typeof window !== "undefined" && window.location && window.location.pathname !== "/") {
        window.location.assign("/");
      }
    } catch (err) {
      console.warn("[multiplayer] SessionEnded navigate failed", err);
      // Navigation may be blocked (e.g. Discord Activity CSP). The board is
      // already torn down (clearSession/clearUnits/clearTiles ran above), so
      // the player is stuck with no path home — surface an actionable message.
      setSessionError("La session a pris fin. Veuillez rafraîchir la page.");
    }
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
      // Both reconnect legs failed. The SignalR group membership is gone —
      // future broadcasts won't arrive. Surface an actionable error so the
      // player knows they need to reload rather than waiting indefinitely.
      setSessionError(
        "Reconnexion impossible — rechargez l'application pour rejoindre la session.",
      );
    }
  });
}
