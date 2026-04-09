import axios from "axios";
import { getApiUrl } from "./config";

const API_URL = getApiUrl();

/**
 * Campaign Status enum matching backend (integers)
 */
export enum CampaignStatus {
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
 * Backend API Types
 */
export interface CreateCampaignRequest {
  name: string;
  description?: string;
  imageUrl?: string;
  maxPlayers?: number;
  isPublic?: boolean;
  status?: CampaignStatus;
}

export interface UpdateCampaignRequest {
  name?: string;
  description?: string;
  imageUrl?: string;
  maxPlayers?: number;
  isPublic?: boolean;
  status?: CampaignStatus;
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
  status: CampaignStatus;
  imageUrl?: string;
  maxPlayers: number;
  isPublic: boolean;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
  lastPlayedAt?: string;
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
