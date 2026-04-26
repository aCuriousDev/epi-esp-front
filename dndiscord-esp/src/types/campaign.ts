/**
 * Campaign types for the frontend
 */

export enum CampaignStatus {
  Planning = "Planning",
  Active = "Active",
  Paused = "Paused",
  Completed = "Completed",
  Archived = "Archived",
}

export enum CampaignVisibility {
  Public = "Public",
  Private = "Private",
  InviteOnly = "InviteOnly",
}

export interface CampaignPlayer {
  id: string;
  username: string;
  avatarUrl?: string;
  characterId?: string;
  characterName?: string;
  role: "dm" | "player";
  joinedAt: string;
}

export interface CampaignSession {
  id: string;
  number: number;
  title: string;
  date: string;
  duration?: number; // in minutes
  summary?: string;
  completed: boolean;
}

export interface Campaign {
  id: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  status: CampaignStatus;
  visibility: CampaignVisibility;
  dungeonMasterId: string;
  /** When true, the current user is the DM (from API); use this for "Lancer la session". */
  isDungeonMaster?: boolean;
  /** @deprecated The API doesn't provide DM display names yet. Fall back to "Dungeon Master" at call sites. */
  dungeonMasterName?: string;
  dungeonMasterAvatar?: string;
  maxPlayers: number;
  currentPlayers: number;
  players?: CampaignPlayer[];
  /** @deprecated Not persisted yet. Kept optional so legacy UI references still compile. */
  sessions?: CampaignSession[];
  /** @deprecated Not persisted yet. */
  nextSessionDate?: string;
  /** @deprecated Not persisted yet. */
  totalSessions?: number;
  /** @deprecated Not persisted yet. */
  setting?: string;
  /** @deprecated Not persisted yet. */
  startingLevel?: number;
  /** @deprecated Not persisted yet. */
  currentLevel?: number;
  /** @deprecated Not persisted yet. */
  tags?: string[];
  createdAt: string;
  updatedAt?: string;
  campaignTreeDefinition?: string;
}

export interface CreateCampaignDto {
  title: string;
  description?: string;
  coverImageUrl?: string;
  visibility: CampaignVisibility;
  maxPlayers: number;
}

/**
 * Get status color class
 */
export function getStatusColor(status: CampaignStatus): string {
  switch (status) {
    case CampaignStatus.Planning:
      return "text-blue-400 bg-blue-500/20 border-blue-500/30";
    case CampaignStatus.Active:
      return "text-green-400 bg-green-500/20 border-green-500/30";
    case CampaignStatus.Paused:
      return "text-yellow-400 bg-yellow-500/20 border-yellow-500/30";
    case CampaignStatus.Completed:
      return "text-purple-400 bg-purple-500/20 border-purple-500/30";
    case CampaignStatus.Archived:
      return "text-slate-400 bg-slate-500/20 border-slate-500/30";
    default:
      return "text-slate-400 bg-slate-500/20 border-slate-500/30";
  }
}

/**
 * Get status label
 */
export function getStatusLabel(status: CampaignStatus): string {
  switch (status) {
    case CampaignStatus.Planning:
      return "In preparation";
    case CampaignStatus.Active:
      return "Active";
    case CampaignStatus.Paused:
      return "Paused";
    case CampaignStatus.Completed:
      return "Completed";
    case CampaignStatus.Archived:
      return "Archived";
    default:
      return status;
  }
}

/**
 * Get visibility label
 */
export function getVisibilityLabel(visibility: CampaignVisibility): string {
  switch (visibility) {
    case CampaignVisibility.Public:
      return "Public";
    case CampaignVisibility.Private:
      return "Private";
    case CampaignVisibility.InviteOnly:
      return "Invite only";
    default:
      return visibility;
  }
}

