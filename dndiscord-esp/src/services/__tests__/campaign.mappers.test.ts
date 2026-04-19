import { CampaignStatus } from "@/types/campaign";
import {
  APICampaignStatus,
  CampaignMemberRole,
  MembershipStatus,
  mapMemberRole,
  mapCampaignStatus,
  mapToAPICampaignStatus,
  mapCampaignResponse,
  type CampaignDetailResponse,
} from "../campaign.mappers";

describe("mapMemberRole", () => {
  it('maps "CoDungeonMaster" to "dm"', () => {
    expect(mapMemberRole("CoDungeonMaster")).toBe("dm");
  });

  it('maps "Player" to "player"', () => {
    expect(mapMemberRole("Player")).toBe("player");
  });

  it('maps "Spectator" to "player"', () => {
    expect(mapMemberRole("Spectator")).toBe("player");
  });

  it('maps unknown string to "player" (default)', () => {
    expect(mapMemberRole("SomethingElse")).toBe("player");
  });
});

describe("mapCampaignStatus", () => {
  it("maps 0 to Planning", () => {
    expect(mapCampaignStatus(0)).toBe(CampaignStatus.Planning);
  });

  it("maps 1 to Active", () => {
    expect(mapCampaignStatus(1)).toBe(CampaignStatus.Active);
  });

  it("maps 2 to Paused", () => {
    expect(mapCampaignStatus(2)).toBe(CampaignStatus.Paused);
  });

  it("maps 3 to Completed", () => {
    expect(mapCampaignStatus(3)).toBe(CampaignStatus.Completed);
  });

  it("maps 4 to Archived", () => {
    expect(mapCampaignStatus(4)).toBe(CampaignStatus.Archived);
  });

  it("maps unknown (99) to Planning (default)", () => {
    expect(mapCampaignStatus(99)).toBe(CampaignStatus.Planning);
  });
});

describe("mapToAPICampaignStatus", () => {
  it("maps Planning to Draft (0)", () => {
    expect(mapToAPICampaignStatus(CampaignStatus.Planning)).toBe(APICampaignStatus.Draft);
  });

  it("maps Active to Active (1)", () => {
    expect(mapToAPICampaignStatus(CampaignStatus.Active)).toBe(APICampaignStatus.Active);
  });

  it("round-trips all 5 values correctly", () => {
    const pairs: [CampaignStatus, APICampaignStatus][] = [
      [CampaignStatus.Planning, APICampaignStatus.Draft],
      [CampaignStatus.Active, APICampaignStatus.Active],
      [CampaignStatus.Paused, APICampaignStatus.Paused],
      [CampaignStatus.Completed, APICampaignStatus.Completed],
      [CampaignStatus.Archived, APICampaignStatus.Archived],
    ];
    for (const [frontend, api] of pairs) {
      expect(mapToAPICampaignStatus(frontend)).toBe(api);
      expect(mapCampaignStatus(api)).toBe(frontend);
    }
  });
});

describe("mapCampaignResponse", () => {
  function makeCampaignDetail(overrides: Partial<CampaignDetailResponse> = {}): CampaignDetailResponse {
    return {
      id: "c1",
      name: "Test Campaign",
      description: "A test",
      dungeonMasterId: "dm1",
      status: 1,
      imageUrl: "https://img.test/cover.png",
      maxPlayers: 5,
      isPublic: true,
      memberCount: 3,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-06-01T00:00:00Z",
      campaignTreeDefinition: "{}",
      isDungeonMaster: true,
      hasInviteCode: false,
      members: [
        {
          id: "m1",
          userId: "u1",
          role: CampaignMemberRole.CoDungeonMaster,
          status: MembershipStatus.Active,
          joinedAt: "2024-01-01T00:00:00Z",
        },
        {
          id: "m2",
          userId: "u2",
          role: CampaignMemberRole.Player,
          status: MembershipStatus.Active,
          joinedAt: "2024-02-01T00:00:00Z",
        },
      ],
      snapshotCount: 7,
      ...overrides,
    };
  }

  it("maps name to title", () => {
    const result = mapCampaignResponse(makeCampaignDetail({ name: "My Campaign" }));
    expect(result.title).toBe("My Campaign");
  });

  it("maps imageUrl to coverImageUrl", () => {
    const result = mapCampaignResponse(makeCampaignDetail({ imageUrl: "https://example.com/img.png" }));
    expect(result.coverImageUrl).toBe("https://example.com/img.png");
  });

  it("maps status integer via mapCampaignStatus", () => {
    const result = mapCampaignResponse(makeCampaignDetail({ status: 2 }));
    expect(result.status).toBe(CampaignStatus.Paused);
  });

  it('maps isPublic true to visibility "Public"', () => {
    const result = mapCampaignResponse(makeCampaignDetail({ isPublic: true }));
    expect(result.visibility).toBe("Public");
  });

  it('maps isPublic false to visibility "Private"', () => {
    const result = mapCampaignResponse(makeCampaignDetail({ isPublic: false }));
    expect(result.visibility).toBe("Private");
  });

  it("maps members via mapMemberRole", () => {
    const result = mapCampaignResponse(makeCampaignDetail());
    expect(result.players).toHaveLength(2);
    expect(result.players![0].role).toBe("dm");
    expect(result.players![1].role).toBe("player");
  });

  it("handles empty members array", () => {
    const result = mapCampaignResponse(makeCampaignDetail({ members: [] }));
    expect(result.players).toEqual([]);
  });

  it("handles null/undefined members", () => {
    const detail = makeCampaignDetail();
    (detail as any).members = null;
    const result = mapCampaignResponse(detail);
    expect(result.players).toEqual([]);
  });

  it("propagates isDungeonMaster=true", () => {
    const result = mapCampaignResponse(makeCampaignDetail({ isDungeonMaster: true }));
    expect(result.isDungeonMaster).toBe(true);
  });

  it("propagates isDungeonMaster=false", () => {
    const result = mapCampaignResponse(makeCampaignDetail({ isDungeonMaster: false }));
    expect(result.isDungeonMaster).toBe(false);
  });

  it("does not fabricate dungeonMasterName — leaves it undefined for the UI to fall back", () => {
    const result = mapCampaignResponse(makeCampaignDetail());
    expect(result.dungeonMasterName).toBeUndefined();
  });

  it("uses member.nickname when present", () => {
    const detail = makeCampaignDetail({
      members: [
        {
          id: "m1",
          userId: "11111111-2222-3333-4444-555555555555",
          nickname: "Alyssa",
          role: CampaignMemberRole.Player,
          status: MembershipStatus.Active,
          joinedAt: "2024-01-01T00:00:00Z",
        },
      ],
    });
    const result = mapCampaignResponse(detail);
    expect(result.players![0].username).toBe("Alyssa");
  });

  it("falls back to 'Joueur #{short}' when nickname is missing and userId is a GUID", () => {
    const detail = makeCampaignDetail({
      members: [
        {
          id: "m1",
          userId: "11111111-2222-3333-4444-555555555555",
          role: CampaignMemberRole.Player,
          status: MembershipStatus.Active,
          joinedAt: "2024-01-01T00:00:00Z",
        },
      ],
    });
    const result = mapCampaignResponse(detail);
    expect(result.players![0].username).toBe("Joueur #111111");
  });

  it("keeps raw userId when nickname is missing and userId is not GUID-shaped", () => {
    const detail = makeCampaignDetail({
      members: [
        {
          id: "m1",
          userId: "raw-discord-snowflake",
          role: CampaignMemberRole.Player,
          status: MembershipStatus.Active,
          joinedAt: "2024-01-01T00:00:00Z",
        },
      ],
    });
    const result = mapCampaignResponse(detail);
    expect(result.players![0].username).toBe("raw-discord-snowflake");
  });
});
