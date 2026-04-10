import { Campaign, CampaignStatus } from "@/types/campaign";
import axios from "axios";
import { getApiUrl } from "./config";

const API_URL = getApiUrl();

/**
 * Campaign Status enum matching backend (integers)
//  */
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
export const mapMemberRole=(apiRole: string): "dm" | "player"=> {
  switch (apiRole) {
    case "CoDungeonMaster":
      return "dm";
    case "Player":
    case "Spectator":
    default:
      return "player";
  }
}
/**
 * Backend API Types
 */
export interface CreateCampaignRequest {
  name: string;
  description?: string;
  imageUrl?: string;
  maxPlayers?: number;
  isPublic?: boolean;
  status?: APICampaignStatus;
}

export interface UpdateCampaignRequest {
  name?: string;
  description?: string;
  imageUrl?: string;
  maxPlayers?: number;
  isPublic?: boolean;
  status?: APICampaignStatus;
}

export interface CampaignFilterRequest {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: CampaignStatus;
  isPublic?: boolean;
  roleFilter?: "All" | "AsDungeonMaster" | "AsPlayer";
  sortBy?: "CreatedAt" | "UpdatedAt" | "LastPlayedAt" | "Name" | "MemberCount";
  sortDescending?: boolean;
}

export interface JoinCampaignRequest {
  inviteCode: string;
}

export interface GenerateInviteCodeRequest {
  expiresInHours?: number;
}

export interface AddMemberRequest {
  userId: string;
  role?: CampaignMemberRole;
}

export interface UpdateMemberRequest {
  role?: CampaignMemberRole;
  nickname?: string;
  notes?: string;
}

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
  campaignTreeDefinition:string;
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
export interface UpdateCampaignManagerRequest {
  campaignTreeDefinition:string
}

export interface CampaignListResponse {
  items: CampaignResponse[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface InviteCodeResponse {
  inviteCode: string;
  expiresAt?: string;
  joinUrl: string;
}

export interface CampaignMemberListResponse {
  items: CampaignMemberResponse[];
  totalCount: number;
}

/**
 * Helper to get auth header
 */
function getAuthHeaders() {
  const token = localStorage.getItem("token");
  return {
    Authorization: `Bearer ${token}`,
  };
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
}

/**
 * Map API campaign status (integer) to frontend status (string)
 */
export const mapCampaignStatus = (apiStatus: number): CampaignStatus=> {
  switch (apiStatus) {
    case 0: return CampaignStatus.Planning; // Draft
    case 1: return CampaignStatus.Active;
    case 2: return CampaignStatus.Paused;
    case 3: return CampaignStatus.Completed;
    case 4: return CampaignStatus.Archived;
    default: return CampaignStatus.Planning;
  }
}

export const mapCampaignResponse = (apiCampaign: CampaignDetailResponse): Campaign=> {
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
    campaignTreeDefinition: apiCampaign.campaignTreeDefinition
  };
}
/**
 * Campaign Service - handles all campaign API calls
 */
export const CampaignService = {
  /**
   * Create a new campaign
   */
  async createCampaign(request: CreateCampaignRequest): Promise<CampaignDetailResponse> {
    const response = await axios.post<CampaignDetailResponse>(
      `${API_URL}/api/campaigns`,
      request,
      { headers: getAuthHeaders() }
    );
    return response.data;
  },

  async editCampaignManager(campaignId : string,request:UpdateCampaignManagerRequest) : Promise<CampaignDetailResponse>{
     const response = await axios.put<CampaignDetailResponse>(
      `${API_URL}/api/campaigns/${campaignId}/manager`,
      request,
      { headers: getAuthHeaders() }
      );
      return response.data;
  },

  /**
   * Get paginated list of campaigns with filters
   */
  async listCampaigns(filters?: CampaignFilterRequest): Promise<CampaignListResponse> {
    const response = await axios.get<CampaignListResponse>(
      `${API_URL}/api/campaigns`,
      {
        headers: getAuthHeaders(),
        params: filters,
      }
    );
    return response.data;
  },

  /**
   * Get campaign details by ID
   */
  async getCampaign(id: string): Promise<CampaignDetailResponse> {
    const response = await axios.get<CampaignDetailResponse>(
      `${API_URL}/api/campaigns/${id}`,
      { headers: getAuthHeaders() }
    );
    return response.data;
  },

  /**
   * Update an existing campaign
   */
  async updateCampaign(
    id: string,
    request: UpdateCampaignRequest
  ): Promise<CampaignDetailResponse> {
    const response = await axios.put<CampaignDetailResponse>(
      `${API_URL}/api/campaigns/${id}`,
      request,
      { headers: getAuthHeaders() }
    );
    return response.data;
  },

  /**
   * Delete a campaign (soft delete by default)
   */
  async deleteCampaign(id: string, hardDelete: boolean = false): Promise<void> {
    await axios.delete(`${API_URL}/api/campaigns/${id}`, {
      headers: getAuthHeaders(),
      params: { hardDelete },
    });
  },

  /**
   * Generate an invite code for a campaign
   */
  async generateInviteCode(
    campaignId: string,
    request?: GenerateInviteCodeRequest
  ): Promise<InviteCodeResponse> {
    const response = await axios.post<InviteCodeResponse>(
      `${API_URL}/api/campaigns/${campaignId}/invite`,
      request || {},
      { headers: getAuthHeaders() }
    );
    return response.data;
  },

  /**
   * Join a campaign using an invite code
   */
  async joinCampaign(request: JoinCampaignRequest): Promise<CampaignDetailResponse> {
    const response = await axios.post<CampaignDetailResponse>(
      `${API_URL}/api/campaigns/join`,
      request,
      { headers: getAuthHeaders() }
    );
    return response.data;
  },

  /**
   * Get campaign members
   */
  async getCampaignMembers(campaignId: string): Promise<CampaignMemberListResponse> {
    const response = await axios.get<CampaignMemberListResponse>(
      `${API_URL}/api/campaigns/${campaignId}/members`,
      { headers: getAuthHeaders() }
    );
    return response.data;
  },

  /**
   * Add a member to a campaign
   */
  async addMember(
    campaignId: string,
    request: AddMemberRequest
  ): Promise<CampaignMemberResponse> {
    const response = await axios.post<CampaignMemberResponse>(
      `${API_URL}/api/campaigns/${campaignId}/members`,
      request,
      { headers: getAuthHeaders() }
    );
    return response.data;
  },

  /**
   * Update a campaign member
   */
  async updateMember(
    campaignId: string,
    memberId: string,
    request: UpdateMemberRequest
  ): Promise<CampaignMemberResponse> {
    const response = await axios.put<CampaignMemberResponse>(
      `${API_URL}/api/campaigns/${campaignId}/members/${memberId}`,
      request,
      { headers: getAuthHeaders() }
    );
    return response.data;
  },

  /**
   * Remove a member from a campaign
   */
  async removeMember(campaignId: string, memberId: string): Promise<void> {
    await axios.delete(`${API_URL}/api/campaigns/${campaignId}/members/${memberId}`, {
      headers: getAuthHeaders(),
    });
  },

  /**
   * Leave a campaign
   */
  async leaveCampaign(campaignId: string): Promise<void> {
    await axios.post(
      `${API_URL}/api/campaigns/${campaignId}/leave`,
      {},
      { headers: getAuthHeaders() }
    );
  },
};
