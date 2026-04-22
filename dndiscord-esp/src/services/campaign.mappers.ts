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
    dungeonMasterName: "Maître du Jeu", // API doesn't provide this
    dungeonMasterAvatar: "",
    maxPlayers: apiCampaign.maxPlayers,
    currentPlayers: apiCampaign.memberCount,
    players: apiCampaign.members?.map(m => ({
      id: m.id,
      username: m.userId, // API doesn't provide username, using userId
      role: mapMemberRole(m.role),
      characterName: m.nickname,
      joinedAt: m.joinedAt,
    })) || [],
    sessions: [], // API doesn't provide sessions yet
    totalSessions: apiCampaign.snapshotCount || 0,
    setting: undefined,
    startingLevel: 1,
    currentLevel: 1,
    tags: [],
    createdAt: apiCampaign.createdAt,
    updatedAt: apiCampaign.updatedAt,
    campaignTreeDefinition: apiCampaign.campaignTreeDefinition,
    isDungeonMaster: apiCampaign.isDungeonMaster,
  };
};
