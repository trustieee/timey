import { PlayerProfile, ChoreStatus } from "../../src/playerProfile";

// Interface for admin view (only adding what we need on top of PlayerProfile)
export interface AdminUserProfile extends PlayerProfile {
  uid: string;
  xp?: { final: number; base: number; bonus: number };
  playTime?: { sessions: { start: string; end: string }[] };
  lastUpdated?: string; // Add this field to track changes
}

// Interface for a chore item
export interface ChoreItem {
  id: number;
  text: string;
  status?: ChoreStatus;
  completedAt?: string;
  daysOfWeek?: number[]; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
}
