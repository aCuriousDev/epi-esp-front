import {
  PlayerRole,
  ConnectionStatus,
  SessionState,
  type PlayerInfo,
  type SessionInfo,
} from "../../types/multiplayer";

/** Map backend integer enum to frontend enum. Backend: 0=Player, 1=DungeonMaster */
export const ROLE_MAP: Record<number, PlayerRole> = {
  0: PlayerRole.Player,
  1: PlayerRole.DungeonMaster,
};
export const STATUS_MAP: Record<number, ConnectionStatus> = {
  0: ConnectionStatus.Connected,
  1: ConnectionStatus.Disconnected,
  2: ConnectionStatus.Reconnecting,
};
export const STATE_MAP: Record<number, SessionState> = {
  0: SessionState.Lobby,
  1: SessionState.InProgress,
  2: SessionState.Paused,
  3: SessionState.Ended,
};

export function normalizeRole(v: unknown): PlayerRole {
  if (typeof v === "number") return ROLE_MAP[v] ?? PlayerRole.Player;
  if (v === PlayerRole.Player || v === PlayerRole.DungeonMaster) return v;
  return PlayerRole.Player;
}

export function normalizeStatus(v: unknown): ConnectionStatus {
  if (typeof v === "number") return STATUS_MAP[v] ?? ConnectionStatus.Connected;
  if (
    v === ConnectionStatus.Connected ||
    v === ConnectionStatus.Disconnected ||
    v === ConnectionStatus.Reconnecting
  )
    return v;
  return ConnectionStatus.Connected;
}

export function normalizeState(v: unknown): SessionState {
  if (typeof v === "number") return STATE_MAP[v] ?? SessionState.Lobby;
  if (
    v === SessionState.Lobby ||
    v === SessionState.InProgress ||
    v === SessionState.Paused ||
    v === SessionState.Ended
  )
    return v;
  return SessionState.Lobby;
}

export function normalizePlayer(raw: Record<string, unknown>): PlayerInfo {
  return {
    userId: String(raw.userId ?? raw.UserId ?? ""),
    userName: String(raw.userName ?? raw.UserName ?? "?"),
    role: normalizeRole(raw.role ?? raw.Role),
    status: normalizeStatus(raw.status ?? raw.Status),
    selectedCharacterId: (raw.selectedCharacterId ??
      raw.SelectedCharacterId) as string | undefined,
    selectedCharacterName: (raw.selectedCharacterName ??
      raw.SelectedCharacterName) as string | undefined,
  };
}

export function normalizeSession(raw: Record<string, unknown>): SessionInfo {
  const players = Array.isArray(raw.players)
    ? (raw.players as Record<string, unknown>[]).map(normalizePlayer)
    : [];
  return {
    sessionId: String(raw.sessionId ?? raw.SessionId ?? ""),
    joinCode: (raw.joinCode ?? raw.JoinCode) as string | undefined,
    campaignId: (raw.campaignId ?? raw.CampaignId) as string | undefined,
    campaignName: (raw.campaignName ?? raw.CampaignName) as string | undefined,
    playerCount: Number(raw.playerCount ?? raw.PlayerCount ?? 0),
    maxPlayers: Number(raw.maxPlayers ?? raw.MaxPlayers ?? 6),
    state: normalizeState(raw.state ?? raw.State),
    mapId: (raw.mapId ?? raw.MapId) as string | undefined,
    players,
  };
}
