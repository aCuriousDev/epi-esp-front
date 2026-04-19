import { describe, it, expect, beforeEach } from "vitest";
import {
  setSession,
  clearSession,
  isCharacterInCurrentSession,
  sessionHasDm,
} from "../session.store";
import { PlayerRole, SessionState } from "../../types/multiplayer";
import type { SessionInfo } from "../../types/multiplayer";

function makeSession(partial?: Partial<SessionInfo>): SessionInfo {
  return {
    sessionId: "session-abc",
    joinCode: "ABCD-1234",
    campaignId: "campaign-xyz",
    dmUserId: "dm-user",
    state: SessionState.Lobby,
    maxPlayers: 6,
    playerCount: 0,
    players: [],
    createdAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    mapId: null,
    ...partial,
  };
}

describe("session.store defence-in-depth helpers", () => {
  beforeEach(() => {
    clearSession();
  });

  describe("isCharacterInCurrentSession", () => {
    it("returns false when there is no session", () => {
      expect(isCharacterInCurrentSession("any")).toBe(false);
    });

    it("returns false for a null or missing characterId", () => {
      setSession(
        makeSession({
          players: [
            {
              userId: "p1",
              userName: "P1",
              role: PlayerRole.Player,
              status: 0,
              selectedCharacterId: "char-1",
            } as any,
          ],
        }),
      );
      expect(isCharacterInCurrentSession(undefined)).toBe(false);
      expect(isCharacterInCurrentSession(null)).toBe(false);
      expect(isCharacterInCurrentSession("")).toBe(false);
    });

    it("returns true only when the character is selected by a session player", () => {
      setSession(
        makeSession({
          players: [
            {
              userId: "p1",
              userName: "P1",
              role: PlayerRole.Player,
              status: 0,
              selectedCharacterId: "char-1",
            } as any,
            {
              userId: "p2",
              userName: "P2",
              role: PlayerRole.Player,
              status: 0,
              selectedCharacterId: "char-2",
            } as any,
          ],
        }),
      );
      expect(isCharacterInCurrentSession("char-1")).toBe(true);
      expect(isCharacterInCurrentSession("char-2")).toBe(true);
      expect(isCharacterInCurrentSession("char-stranger")).toBe(false);
    });
  });

  describe("sessionHasDm", () => {
    it("returns false without a session", () => {
      expect(sessionHasDm()).toBe(false);
    });

    it("returns false when no player has the DungeonMaster role", () => {
      setSession(
        makeSession({
          players: [
            { userId: "p1", userName: "P1", role: PlayerRole.Player, status: 0 } as any,
          ],
        }),
      );
      expect(sessionHasDm()).toBe(false);
    });

    it("returns true when any player is the DungeonMaster", () => {
      setSession(
        makeSession({
          players: [
            { userId: "p1", userName: "P1", role: PlayerRole.Player, status: 0 } as any,
            { userId: "dm", userName: "DM", role: PlayerRole.DungeonMaster, status: 0 } as any,
          ],
        }),
      );
      expect(sessionHasDm()).toBe(true);
    });
  });
});
