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

/** Réinitialiser l'état session (ex. après Leave). */
export function clearSession(): void {
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
}

/** Stocker le payload GameStarted reçu du serveur. */
export function setGameStarted(payload: GameStartedPayload): void {
  setSessionState("gameStartedPayload", payload);
}

/** Définir la session (après Create/Join réussi). */
export function setSession(session: SessionInfo | null): void {
  setSessionState("session", session);
  setSessionState("error", null);
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

/** Retourne le userId (Guid) du hub pour comparaison avec les players. */
export function getHubUserId(): string | null {
  return sessionState.hubUserId;
}
