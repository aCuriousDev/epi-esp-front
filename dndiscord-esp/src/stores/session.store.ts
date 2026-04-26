/**
 * Store pour la session multijoueur (E2.2).
 * État de la session courante + actions (create/join/leave/kick).
 */

import { createStore } from "solid-js/store";
import type {
  SessionInfo,
  JoinResult,
  KickResult,
  PlayerInfo,
  GameStartedPayload,
} from "../types/multiplayer";
import { PlayerRole } from "../types/multiplayer";
import { signalRService } from "../services/signalr/SignalRService";
import { clearDmToolsState } from "./dmTools.store";
import { clearDiceRequests } from "./diceRequests.store";

export interface SessionStoreState {
  /** Session courante (null si pas en session). */
  session: SessionInfo | null;
  /** En cours de création/rejoindre. */
  isLoading: boolean;
  /** Message d'erreur à afficher. */
  error: string | null;
  /** Payload reçu quand le host lance la partie. */
  gameStartedPayload: GameStartedPayload | null;
  /** User ID (Guid) renvoyé par le hub SignalR (différent de authStore.user().id). */
  hubUserId: string | null;
}

const initialState: SessionStoreState = {
  session: null,
  isLoading: false,
  error: null,
  gameStartedPayload: null,
  hubUserId: null,
};

export const [sessionState, setSessionState] = createStore<SessionStoreState>({
  ...initialState,
});

// --- sessionStorage persistence (survives refresh, clears on tab close) ---

const STORAGE_KEY = "dndiscord_session";
const GAME_STARTED_KEY = "dndiscord_game_started";

interface PersistedSession {
  sessionId: string;
  hubUserId: string;
}

function persistSession(sessionId: string, hubUserId: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionId, hubUserId }));
  } catch { /* quota or private mode */ }
}

function clearPersistedSession(): void {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
}

export function getPersistedSession(): PersistedSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.sessionId && parsed?.hubUserId) return parsed as PersistedSession;
    return null;
  } catch {
    return null;
  }
}

function persistGameStarted(payload: GameStartedPayload): void {
  try {
    const { mapData: _, ...rest } = payload;
    sessionStorage.setItem(GAME_STARTED_KEY, JSON.stringify(rest));
  } catch { /* quota or private mode */ }
}

function clearPersistedGameStarted(): void {
  try { sessionStorage.removeItem(GAME_STARTED_KEY); } catch { /* noop */ }
}

export function getPersistedGameStarted(): GameStartedPayload | null {
  try {
    const raw = sessionStorage.getItem(GAME_STARTED_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GameStartedPayload;
  } catch {
    return null;
  }
}

// --- Store mutations ---

/** Réinitialiser l'état session (ex. après Leave). */
export function clearSession(): void {
  clearPersistedSession();
  clearPersistedGameStarted();
  clearDmToolsState();
  clearDiceRequests();
  setSessionState({
    session: null,
    isLoading: false,
    error: null,
    gameStartedPayload: null,
    hubUserId: null,
  });
}

/** Stocker le userId (Guid) renvoyé par le hub SignalR à la connexion. */
export function setHubUserId(userId: string): void {
  setSessionState("hubUserId", userId);
  if (sessionState.session?.sessionId) {
    persistSession(sessionState.session.sessionId, userId);
  }
}

/** Effacer le payload GameStarted (ex. avant une nouvelle session).
 *  Sans ce nettoyage, LobbyScreen déclenche onMultiplayerGameStart
 *  immédiatement avec le payload de la session précédente. */
export function clearGameStarted(): void {
  clearPersistedGameStarted();
  setSessionState("gameStartedPayload", null);
}

/** Stocker le payload GameStarted reçu du serveur. */
export function setGameStarted(payload: GameStartedPayload): void {
  setSessionState("gameStartedPayload", payload);
  persistGameStarted(payload);
}

/** Définir la session (après Create/Join réussi). */
export function setSession(session: SessionInfo | null): void {
  setSessionState("session", session);
  setSessionState("error", null);
  if (session && sessionState.hubUserId) {
    persistSession(session.sessionId, sessionState.hubUserId);
  } else if (!session) {
    clearPersistedSession();
  }
}

/** Mettre à jour la liste des joueurs (événements PlayerJoined / PlayerLeft). */
export function setSessionPlayers(players: PlayerInfo[]): void {
  if (sessionState.session) {
    setSessionState("session", "players", players);
  }
}

/** Mettre à jour toute la session (événement SessionUpdated). */
export function updateSession(session: SessionInfo): void {
  setSessionState("session", session);
}

/** Marquer chargement. */
export function setSessionLoading(loading: boolean): void {
  setSessionState("isLoading", loading);
}

/** Marquer erreur. */
export function setSessionError(message: string | null): void {
  setSessionState("error", message);
  setSessionState("isLoading", false);
}

/** Appliquer le résultat d'un Join (succès ou échec). */
export function applyJoinResult(result: JoinResult): void {
  setSessionState("isLoading", false);
  setSessionState("error", result.success ? null : result.message ?? null);
  if (result.success && result.session) {
    setSessionState("session", result.session);
    if (sessionState.hubUserId) {
      persistSession(result.session.sessionId, sessionState.hubUserId);
    }
  }
}

/** Appliquer le résultat d'un Kick (côté appelant). */
export function applyKickResult(result: KickResult): void {
  if (!result.success) {
    setSessionState("error", result.message ?? null);
  }
}

/** Retirer un joueur de la liste (après PlayerLeft / PlayerKicked). */
export function removePlayerFromSession(userId: string): void {
  if (!sessionState.session) return;
  const next = sessionState.session.players.filter((p) => p.userId !== userId);
  setSessionState("session", "players", next);
  setSessionState("session", "playerCount", next.length);
}

/** Ajouter ou mettre à jour un joueur (PlayerJoined). */
export function upsertPlayerInSession(player: PlayerInfo): void {
  if (!sessionState.session) return;
  const players = [...sessionState.session.players];
  const idx = players.findIndex((p) => p.userId === player.userId);
  if (idx >= 0) players[idx] = player;
  else players.push(player);
  setSessionState("session", "players", players);
  setSessionState("session", "playerCount", players.length);
}

export const isInSession = (): boolean => !!sessionState.session;
export const getCurrentSession = (): SessionInfo | null => sessionState.session;

/** Vérifie si l'utilisateur courant est le host (DM) de la session. */
export function isHost(): boolean {
  const hubId = sessionState.hubUserId;
  if (!hubId || !sessionState.session) return false;
  const me = sessionState.session.players.find((p) => p.userId === hubId);
  return me?.role === PlayerRole.DungeonMaster;
}

/**
 * True when the SignalR hub still has a live session for the current user.
 * The session store rehydrates from sessionStorage on app load, so a stale
 * `sessionState.session` from a past game can outlive the actual hub
 * connection — gate any DM-only UI surface that lives outside the game shell
 * (CharacterView, roster, etc.) with `isHost() && isInActiveSession()`.
 *
 * Uses the live SignalR connection state as the source of truth — session
 * data alone (which sessionStorage rehydrates) is not enough.
 */
export function isInActiveSession(): boolean {
  return (
    !!sessionState.session &&
    !!sessionState.hubUserId &&
    signalRService.isConnected
  );
}

/** Alias explicite : vérifie si l'utilisateur courant est le Dungeon Master. */
export const isDm = isHost;

/** Retourne la liste des autres joueurs (pas le DM courant). */
export function getOtherPlayers() {
  const hubId = sessionState.hubUserId;
  if (!hubId || !sessionState.session) return [];
  return sessionState.session.players.filter(
    (p) => p.userId !== hubId && p.role === PlayerRole.Player
  );
}

/** Retourne le userId (Guid) du hub pour comparaison avec les players. */
export function getHubUserId(): string | null {
  return sessionState.hubUserId;
}

/**
 * True if the given characterId is selected by any player in the current session.
 * Used as a defence-in-depth filter on SignalR events that carry a characterId —
 * rejects stray broadcasts from another session if the back ever leaks them.
 */
export function isCharacterInCurrentSession(characterId: string | undefined | null): boolean {
  if (!characterId) return false;
  const session = sessionState.session;
  if (!session) return false;
  return session.players.some((p) => p.selectedCharacterId === characterId);
}

/** True when the current session has a player in the DungeonMaster role. */
export function sessionHasDm(): boolean {
  const session = sessionState.session;
  if (!session) return false;
  return session.players.some((p) => p.role === PlayerRole.DungeonMaster);
}
