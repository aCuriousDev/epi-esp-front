import { Campaign, CampaignStatus } from "@/types/campaign";

/**
 * Campaign Status enum matching backend (integers)
 */
export enum APICampaignStatus {
  Draft = 0,
  Active = 1,
  Paused = 2,
  Completed = 3,
  Archived = 4,
}

/**
 * Campaign Member Role enum
 */
export enum CampaignMemberRole {
  Player = "Player",
  CoDungeonMaster = "CoDungeonMaster",
  Spectator = "Spectator",
}

/**
 * Membership Status enum
 */
export enum MembershipStatus {
  Pending = "Pending",
  Active = "Active",
  Declined = "Declined",
  Removed = "Removed",
  Left = "Left",
}

/**
 * Map API member role to frontend role
 */
export const mapMemberRole = (apiRole: string): "dm" | "player" => {
  switch (apiRole) {
    case "CoDungeonMaster":
      return "dm";
    case "Player":
    case "Spectator":
    default:
      return "player";
  }
};

/**
 * Response types
 */
export interface CampaignResponse {
  id: string;
  name: string;
  description?: string;
  dungeonMasterId: string;
  status: number;
  imageUrl?: string;
  maxPlayers: number;
  isPublic: boolean;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
  lastPlayedAt?: string;
  campaignTreeDefinition: string;
}

export interface CampaignMemberResponse {
  id: string;
  userId: string;
  role: CampaignMemberRole;
  status: MembershipStatus;
  nickname?: string;
  joinedAt: string;
  acceptedAt?: string;
}

export interface CampaignDetailResponse extends CampaignResponse {
  /** True when the current user is the Dungeon Master of this campaign (from API). */
  isDungeonMaster?: boolean;
  hasInviteCode: boolean;
  inviteCodeExpiresAt?: string;
  members: CampaignMemberResponse[];
  snapshotCount: number;
}

/**
 * Map frontend status to API status (integer)
 */
export const mapToAPICampaignStatus = (status: CampaignStatus): APICampaignStatus => {
  switch (status) {
    case CampaignStatus.Planning: return APICampaignStatus.Draft;
    case CampaignStatus.Active: return APICampaignStatus.Active;
    case CampaignStatus.Paused: return APICampaignStatus.Paused;
    case CampaignStatus.Completed: return APICampaignStatus.Completed;
    case CampaignStatus.Archived: return APICampaignStatus.Archived;
    default: return APICampaignStatus.Draft;
  }
};

const GUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Display name fallback for legacy members that joined before the backend
 * started seeding Nickname from the JWT. When nickname is missing and userId
 * is a raw GUID, render a short compact label instead of the 36-char hex.
 */
function prettyMemberName(nickname: string | null | undefined, userId: string): string {
  const trimmed = nickname?.trim();
  if (trimmed) return trimmed;
  if (GUID_SHAPE.test(userId)) return `Joueur #${userId.replace(/-/g, "").slice(0, 6)}`;
  return userId;
}

/**
 * Map API campaign status (integer) to frontend status (string)
 */
export const mapCampaignStatus = (apiStatus: number): CampaignStatus => {
  switch (apiStatus) {
    case 0: return CampaignStatus.Planning; // Draft
    case 1: return CampaignStatus.Active;
    case 2: return CampaignStatus.Paused;
    case 3: return CampaignStatus.Completed;
    case 4: return CampaignStatus.Archived;
    default: return CampaignStatus.Planning;
  }
};

export const mapCampaignResponse = (apiCampaign: CampaignDetailResponse): Campaign => {
  return {
    id: apiCampaign.id,
    title: apiCampaign.name,
    description: apiCampaign.description,
    coverImageUrl: apiCampaign.imageUrl,
    status: mapCampaignStatus(apiCampaign.status),
    visibility: apiCampaign.isPublic ? "Public" as any : "Private" as any,
    dungeonMasterId: apiCampaign.dungeonMasterId,
    // Critical: the backend tells us whether the caller is the DM of this
    // campaign via IsDungeonMaster. Propagating this unblocks the "Lancer la
    // session" button, which falls back to comparing dungeonMasterId to the
    // Discord snowflake — never equal (back's DungeonMasterId is an MD5-derived Guid).
    isDungeonMaster: apiCampaign.isDungeonMaster,
    maxPlayers: apiCampaign.maxPlayers,
    currentPlayers: apiCampaign.memberCount,
    players: apiCampaign.members?.map(m => ({
      id: m.id,
      username: prettyMemberName(m.nickname, m.userId),
      role: mapMemberRole(m.role),
      characterName: m.nickname,
      joinedAt: m.joinedAt,
    })) || [],
    createdAt: apiCampaign.createdAt,
    updatedAt: apiCampaign.updatedAt,
    campaignTreeDefinition: apiCampaign.campaignTreeDefinition,
  };
};
