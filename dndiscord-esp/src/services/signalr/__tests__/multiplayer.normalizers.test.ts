import {
  PlayerRole,
  ConnectionStatus,
  SessionState,
} from "../../../types/multiplayer";
import {
  normalizeRole,
  normalizeStatus,
  normalizeState,
  normalizePlayer,
  normalizeSession,
} from "../multiplayer.normalizers";

describe("normalizeRole", () => {
  it("maps 0 to PlayerRole.Player", () => {
    expect(normalizeRole(0)).toBe(PlayerRole.Player);
  });

  it("maps 1 to PlayerRole.DungeonMaster", () => {
    expect(normalizeRole(1)).toBe(PlayerRole.DungeonMaster);
  });

  it("passes through PlayerRole.Player string", () => {
    expect(normalizeRole("Player")).toBe(PlayerRole.Player);
  });

  it("passes through PlayerRole.DungeonMaster string", () => {
    expect(normalizeRole("DungeonMaster")).toBe(PlayerRole.DungeonMaster);
  });

  it("defaults undefined to PlayerRole.Player", () => {
    expect(normalizeRole(undefined)).toBe(PlayerRole.Player);
  });
});

describe("normalizeStatus", () => {
  it("maps 0 to Connected", () => {
    expect(normalizeStatus(0)).toBe(ConnectionStatus.Connected);
  });

  it("maps 1 to Disconnected", () => {
    expect(normalizeStatus(1)).toBe(ConnectionStatus.Disconnected);
  });

  it("maps 2 to Reconnecting", () => {
    expect(normalizeStatus(2)).toBe(ConnectionStatus.Reconnecting);
  });

  it("passes through string values", () => {
    expect(normalizeStatus("Connected")).toBe(ConnectionStatus.Connected);
    expect(normalizeStatus("Disconnected")).toBe(ConnectionStatus.Disconnected);
    expect(normalizeStatus("Reconnecting")).toBe(ConnectionStatus.Reconnecting);
  });

  it("defaults unknown to Connected", () => {
    expect(normalizeStatus("garbage")).toBe(ConnectionStatus.Connected);
  });
});

describe("normalizeState", () => {
  it("maps 0 to Lobby", () => {
    expect(normalizeState(0)).toBe(SessionState.Lobby);
  });

  it("maps 1 to InProgress", () => {
    expect(normalizeState(1)).toBe(SessionState.InProgress);
  });

  it("maps 2 to Paused", () => {
    expect(normalizeState(2)).toBe(SessionState.Paused);
  });

  it("maps 3 to Ended", () => {
    expect(normalizeState(3)).toBe(SessionState.Ended);
  });

  it("defaults unknown to Lobby", () => {
    expect(normalizeState(99)).toBe(SessionState.Lobby);
  });
});

describe("normalizePlayer", () => {
  it("normalizes camelCase keys", () => {
    const result = normalizePlayer({
      userId: "u1",
      userName: "Alice",
      role: 0,
      status: 0,
    });
    expect(result).toEqual({
      userId: "u1",
      userName: "Alice",
      role: PlayerRole.Player,
      status: ConnectionStatus.Connected,
      selectedCharacterId: undefined,
      selectedCharacterName: undefined,
    });
  });

  it("normalizes PascalCase keys", () => {
    const result = normalizePlayer({
      UserId: "u2",
      UserName: "Bob",
      Role: 1,
      Status: 1,
    });
    expect(result).toEqual({
      userId: "u2",
      userName: "Bob",
      role: PlayerRole.DungeonMaster,
      status: ConnectionStatus.Disconnected,
      selectedCharacterId: undefined,
      selectedCharacterName: undefined,
    });
  });

  it("defaults missing fields", () => {
    const result = normalizePlayer({});
    expect(result.userId).toBe("");
    expect(result.userName).toBe("?");
    expect(result.role).toBe(PlayerRole.Player);
    expect(result.status).toBe(ConnectionStatus.Connected);
  });
});

describe("normalizeSession", () => {
  it("normalizes full session with players", () => {
    const result = normalizeSession({
      sessionId: "s1",
      joinCode: "ABC",
      campaignId: "c1",
      campaignName: "Test",
      playerCount: 2,
      maxPlayers: 4,
      state: 1,
      mapId: "map1",
      players: [
        { userId: "u1", userName: "Alice", role: 0, status: 0 },
        { userId: "u2", userName: "Bob", role: 1, status: 0 },
      ],
    });
    expect(result.sessionId).toBe("s1");
    expect(result.joinCode).toBe("ABC");
    expect(result.state).toBe(SessionState.InProgress);
    expect(result.players).toHaveLength(2);
    expect(result.players[0].userName).toBe("Alice");
    expect(result.players[1].role).toBe(PlayerRole.DungeonMaster);
  });

  it("handles empty players", () => {
    const result = normalizeSession({
      sessionId: "s2",
      players: [],
    });
    expect(result.players).toEqual([]);
  });

  it("normalizes PascalCase keys", () => {
    const result = normalizeSession({
      SessionId: "s3",
      JoinCode: "XYZ",
      CampaignId: "c2",
      CampaignName: "PascalTest",
      PlayerCount: 1,
      MaxPlayers: 8,
      State: 2,
      MapId: "map2",
    });
    expect(result.sessionId).toBe("s3");
    expect(result.joinCode).toBe("XYZ");
    expect(result.maxPlayers).toBe(8);
    expect(result.state).toBe(SessionState.Paused);
  });

  it("uses defaults for missing fields", () => {
    const result = normalizeSession({});
    expect(result.playerCount).toBe(0);
    expect(result.maxPlayers).toBe(6);
    expect(result.state).toBe(SessionState.Lobby);
    expect(result.players).toEqual([]);
  });
});
