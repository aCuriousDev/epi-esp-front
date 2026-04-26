import axios from "axios";
import { getApiUrl } from "./config";

const API_URL = getApiUrl();

function authHeaders() {
  const token = localStorage.getItem("token");
  return { Authorization: `Bearer ${token}` };
}

export interface CampaignMapRecord {
  id: string;
  campaignId: string;
  name: string;
  /** Serialised SavedMapData — parse before handing to mapStorage / loadMap. */
  data: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMapRequest {
  name: string;
  data: string;
}

export interface UpdateMapRequest {
  name?: string;
  data?: string;
}

/**
 * REST client for /api/campaigns/{id}/maps. Reads are allowed to any campaign
 * member; writes are DM-only (enforced server-side via IsDungeonMasterAsync).
 */
export const MapService = {
  async list(campaignId: string): Promise<CampaignMapRecord[]> {
    const res = await axios.get<CampaignMapRecord[]>(
      `${API_URL}/api/campaigns/${campaignId}/maps`,
      { headers: authHeaders() },
    );
    return res.data;
  },

  async get(campaignId: string, mapId: string): Promise<CampaignMapRecord> {
    const res = await axios.get<CampaignMapRecord>(
      `${API_URL}/api/campaigns/${campaignId}/maps/${mapId}`,
      { headers: authHeaders() },
    );
    return res.data;
  },

  async create(
    campaignId: string,
    request: CreateMapRequest,
  ): Promise<CampaignMapRecord> {
    const res = await axios.post<CampaignMapRecord>(
      `${API_URL}/api/campaigns/${campaignId}/maps`,
      request,
      { headers: authHeaders() },
    );
    return res.data;
  },

  async update(
    campaignId: string,
    mapId: string,
    request: UpdateMapRequest,
  ): Promise<CampaignMapRecord> {
    const res = await axios.put<CampaignMapRecord>(
      `${API_URL}/api/campaigns/${campaignId}/maps/${mapId}`,
      request,
      { headers: authHeaders() },
    );
    return res.data;
  },

  async remove(campaignId: string, mapId: string): Promise<void> {
    await axios.delete(
      `${API_URL}/api/campaigns/${campaignId}/maps/${mapId}`,
      { headers: authHeaders() },
    );
  },
};
