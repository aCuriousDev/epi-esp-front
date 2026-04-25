import { CampaignStatus } from "@/types/campaign";
import axios from "axios";
import { getApiUrl } from "./config";
export {
  APICampaignStatus,
  CampaignMemberRole,
  MembershipStatus,
  mapMemberRole,
  mapToAPICampaignStatus,
  mapCampaignStatus,
  mapCampaignResponse,
  displayDungeonMasterName,
  hasScenario,
} from "./campaign.mappers";
export type {
  CampaignResponse,
  CampaignMemberResponse,
  CampaignDetailResponse,
} from "./campaign.mappers";
import { APICampaignStatus, CampaignMemberRole } from "./campaign.mappers";
import type { CampaignResponse, CampaignDetailResponse, CampaignMemberResponse } from "./campaign.mappers";

const API_URL = getApiUrl();

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
  roleFilter?: "All" | "AsDungeonMaster" | "AsPlayer" | "AsMember";
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

// ─── Session types ─────────────────────────────────────────────────────────

export enum GameSessionStatus {
  Active = 'Active',
  Completed = 'Completed',
  Abandoned = 'Abandoned',
}

export interface AdvanceSessionRequest {
  nodeId: string;
  nodeType: string;
  nodeTitle?: string;
  portUsed?: string;
  choiceText?: string;
}

export interface SessionHistoryEntryResponse {
  id: string;
  nodeId: string;
  nodeType: string;
  nodeTitle: string;
  portUsed?: string;
  choiceText?: string;
  visitedAt: string;
}

export interface GameSessionResponse {
  id: string;
  campaignId: string;
  status: GameSessionStatus;
  currentNodeId?: string;
  startedBy: string;
  startedAt: string;
  endedAt?: string;
  entries: SessionHistoryEntryResponse[];
}

export interface GameSessionListResponse {
  items: GameSessionResponse[];
  totalCount: number;
}

/**
 * Helper to get auth header
 */
function getAuthHeaders() {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Not authenticated");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
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
   * Join a public campaign directly by its ID (no invite code required).
   */
  async joinPublicCampaign(campaignId: string): Promise<CampaignDetailResponse> {
    const response = await axios.post<CampaignDetailResponse>(
      `${API_URL}/api/campaigns/${campaignId}/join-public`,
      {},
      { headers: getAuthHeaders() }
    );
    return response.data;
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

  // ─── Session methods ──────────────────────────────────────────────────────

  async createSession(campaignId: string): Promise<GameSessionResponse> {
    const response = await axios.post<GameSessionResponse>(
      `${API_URL}/api/campaigns/${campaignId}/sessions`,
      {},
      { headers: getAuthHeaders() }
    );
    return response.data;
  },

  async listSessions(campaignId: string): Promise<GameSessionListResponse> {
    const response = await axios.get<GameSessionListResponse>(
      `${API_URL}/api/campaigns/${campaignId}/sessions`,
      { headers: getAuthHeaders() }
    );
    return response.data;
  },

  async getSession(campaignId: string, sessionId: string): Promise<GameSessionResponse> {
    const response = await axios.get<GameSessionResponse>(
      `${API_URL}/api/campaigns/${campaignId}/sessions/${sessionId}`,
      { headers: getAuthHeaders() }
    );
    return response.data;
  },

  async advanceSession(
    campaignId: string,
    sessionId: string,
    request: AdvanceSessionRequest
  ): Promise<GameSessionResponse> {
    const response = await axios.post<GameSessionResponse>(
      `${API_URL}/api/campaigns/${campaignId}/sessions/${sessionId}/advance`,
      request,
      { headers: getAuthHeaders() }
    );
    return response.data;
  },

  async completeSession(campaignId: string, sessionId: string): Promise<GameSessionResponse> {
    const response = await axios.post<GameSessionResponse>(
      `${API_URL}/api/campaigns/${campaignId}/sessions/${sessionId}/complete`,
      {},
      { headers: getAuthHeaders() }
    );
    return response.data;
  },
};
