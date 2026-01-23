import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5054";

/**
 * Snapshot Status enum matching backend (integer values)
 */
export enum SnapshotStatus {
  Active = 0,
  Archived = 1,
  Corrupted = 2,
  Creating = 3,
  Failed = 4,
}

export enum SnapshotSortField {
  CreatedAt = "CreatedAt",
  Version = "Version",
  Label = "Label",
  SizeBytes = "SizeBytes",
}

export enum DifferenceType {
  Added = "Added",
  Removed = "Removed",
  Modified = "Modified",
}

/**
 * Backend API Request Types
 */
export interface CreateSnapshotRequest {
  label: string;
  description?: string;
}

export interface RestoreSnapshotRequest {
  createBackupBeforeRestore?: boolean;
  validateBeforeRestore?: boolean;
  backupLabel?: string;
}

export interface ImportSnapshotRequest {
  jsonData: string;
  label: string;
  description?: string;
  validateImport?: boolean;
}

export interface ListSnapshotsRequest {
  page?: number;
  pageSize?: number;
  status?: SnapshotStatus;
  includeArchived?: boolean;
  sortBy?: SnapshotSortField;
  sortDescending?: boolean;
}

/**
 * Backend API Response Types
 */
export interface SnapshotContentSummary {
  campaignName: string;
  characterCount: number;
  sessionCount: number;
  hasSceneState: boolean;
  lastSessionDate?: string;
}

export interface SnapshotResponse {
  id: string;
  campaignId: string;
  version: number;
  label: string;
  description?: string;
  createdBy: string;
  createdAt: string;
  status: SnapshotStatus;
  sizeBytes: number;
  sizeFormatted: string;
  contentSummary?: SnapshotContentSummary;
}

export interface SnapshotListResponse {
  items: SnapshotResponse[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface RestoreSnapshotResponse {
  success: boolean;
  message: string;
  backupSnapshotId?: string;
  warnings: string[];
}

export interface ExportSnapshotResponse {
  fileName: string;
  contentType: string;
  jsonData: string;
}

export interface SnapshotDifference {
  category: string;
  field: string;
  type: DifferenceType;
  oldValue?: string;
  newValue?: string;
}

export interface ComparisonSummary {
  addedCount: number;
  removedCount: number;
  modifiedCount: number;
  totalDifferences: number;
}

export interface CompareSnapshotsResponse {
  snapshot1Id: string;
  snapshot2Id: string;
  differences: SnapshotDifference[];
  summary: ComparisonSummary;
}

export interface ValidationErrorResponse {
  code: string;
  message: string;
  field?: string;
}

export interface ValidationWarningResponse {
  code: string;
  message: string;
  field?: string;
}

export interface ValidationResultResponse {
  isValid: boolean;
  errors: ValidationErrorResponse[];
  warnings: ValidationWarningResponse[];
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
 * Snapshot Service - handles all snapshot/versioning API calls
 */
export const SnapshotService = {
  /**
   * Create a new snapshot of a campaign
   */
  async createSnapshot(
    campaignId: string,
    request: CreateSnapshotRequest
  ): Promise<SnapshotResponse> {
    const response = await axios.post<SnapshotResponse>(
      `${API_URL}/api/campaigns/${campaignId}/snapshots`,
      request,
      { headers: getAuthHeaders() }
    );
    return response.data;
  },

  /**
   * Get paginated list of snapshots for a campaign
   */
  async listSnapshots(
    campaignId: string,
    request?: ListSnapshotsRequest
  ): Promise<SnapshotListResponse> {
    const response = await axios.get<SnapshotListResponse>(
      `${API_URL}/api/campaigns/${campaignId}/snapshots`,
      {
        headers: getAuthHeaders(),
        params: request,
      }
    );
    return response.data;
  },

  /**
   * Get snapshot details by ID
   */
  async getSnapshot(campaignId: string, snapshotId: string): Promise<SnapshotResponse> {
    const response = await axios.get<SnapshotResponse>(
      `${API_URL}/api/campaigns/${campaignId}/snapshots/${snapshotId}`,
      { headers: getAuthHeaders() }
    );
    return response.data;
  },

  /**
   * Restore a campaign from a snapshot
   */
  async restoreSnapshot(
    campaignId: string,
    snapshotId: string,
    request?: RestoreSnapshotRequest
  ): Promise<RestoreSnapshotResponse> {
    const response = await axios.post<RestoreSnapshotResponse>(
      `${API_URL}/api/campaigns/${campaignId}/snapshots/${snapshotId}/restore`,
      request || {},
      { headers: getAuthHeaders() }
    );
    return response.data;
  },

  /**
   * Delete a snapshot
   */
  async deleteSnapshot(campaignId: string, snapshotId: string): Promise<void> {
    await axios.delete(
      `${API_URL}/api/campaigns/${campaignId}/snapshots/${snapshotId}`,
      { headers: getAuthHeaders() }
    );
  },

  /**
   * Export a snapshot as JSON
   */
  async exportSnapshot(
    campaignId: string,
    snapshotId: string
  ): Promise<ExportSnapshotResponse> {
    const response = await axios.get<ExportSnapshotResponse>(
      `${API_URL}/api/campaigns/${campaignId}/snapshots/${snapshotId}/export`,
      { headers: getAuthHeaders() }
    );
    return response.data;
  },

  /**
   * Import a snapshot from JSON
   */
  async importSnapshot(
    campaignId: string,
    request: ImportSnapshotRequest
  ): Promise<SnapshotResponse> {
    const response = await axios.post<SnapshotResponse>(
      `${API_URL}/api/campaigns/${campaignId}/snapshots/import`,
      request,
      { headers: getAuthHeaders() }
    );
    return response.data;
  },

  /**
   * Compare two snapshots
   */
  async compareSnapshots(
    campaignId: string,
    snapshot1Id: string,
    snapshot2Id: string
  ): Promise<CompareSnapshotsResponse> {
    const response = await axios.get<CompareSnapshotsResponse>(
      `${API_URL}/api/campaigns/${campaignId}/snapshots/compare`,
      {
        headers: getAuthHeaders(),
        params: {
          snapshot1Id,
          snapshot2Id,
        },
      }
    );
    return response.data;
  },

  /**
   * Validate a snapshot's integrity
   */
  async validateSnapshot(
    campaignId: string,
    snapshotId: string
  ): Promise<ValidationResultResponse> {
    const response = await axios.get<ValidationResultResponse>(
      `${API_URL}/api/campaigns/${campaignId}/snapshots/${snapshotId}/validate`,
      { headers: getAuthHeaders() }
    );
    return response.data;
  },

  /**
   * Archive a snapshot
   */
  async archiveSnapshot(campaignId: string, snapshotId: string): Promise<void> {
    await axios.post(
      `${API_URL}/api/campaigns/${campaignId}/snapshots/${snapshotId}/archive`,
      {},
      { headers: getAuthHeaders() }
    );
  },

  /**
   * Recalculate a snapshot's hash (repair)
   */
  async recalculateHash(campaignId: string, snapshotId: string): Promise<SnapshotResponse> {
    const response = await axios.post<SnapshotResponse>(
      `${API_URL}/api/campaigns/${campaignId}/snapshots/${snapshotId}/recalculate-hash`,
      {},
      { headers: getAuthHeaders() }
    );
    return response.data;
  },
};
