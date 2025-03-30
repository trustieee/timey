import { PlayerProfile, ChoreStatus } from "../../src/playerProfile";
import { APP_CONFIG } from "../utils/appConfig";

// Calculate level and XP from profile history
export const calculatePlayerStats = (profile: PlayerProfile) => {
  let totalXp = 0;

  // Sum up all final XP from history
  Object.values(profile.history || {}).forEach((day) => {
    if (day.xp && day.xp.final) {
      totalXp += day.xp.final;
    }
  });

  // Get XP per level from app config - now a single value
  const xpPerLevel = APP_CONFIG.PROFILE.XP_PER_LEVEL;

  // Calculate level - now a simple division since XP per level is constant
  const level = Math.floor(totalXp / xpPerLevel) + 1;

  // Calculate XP progress toward next level
  const xpInCurrentLevel = totalXp % xpPerLevel;

  return {
    level,
    xp: xpInCurrentLevel,
    totalXp,
    xpToNextLevel: xpPerLevel,
  };
};

// Calculate play session statistics
export const calculatePlayStats = (
  dayData: PlayerProfile["history"][string]
) => {
  if (
    !dayData.playTime ||
    !dayData.playTime.sessions ||
    dayData.playTime.sessions.length === 0
  ) {
    return {
      totalPlayTime: 0,
      totalSessions: 0,
      formattedPlayTime: "0:00",
    };
  }

  let totalPlayTimeMs = 0;
  const totalSessions = dayData.playTime.sessions.length;

  dayData.playTime.sessions.forEach((session) => {
    if (session.start && session.end) {
      const startTime = new Date(session.start).getTime();
      const endTime = new Date(session.end).getTime();
      totalPlayTimeMs += endTime - startTime;
    }
  });

  // Convert milliseconds to minutes
  const totalPlayMinutes = Math.floor(totalPlayTimeMs / (1000 * 60));

  // Format as hours:minutes
  const hours = Math.floor(totalPlayMinutes / 60);
  const minutes = totalPlayMinutes % 60;
  const formattedPlayTime = `${hours}:${minutes.toString().padStart(2, "0")}`;

  return {
    totalPlayTime: totalPlayMinutes,
    totalSessions,
    formattedPlayTime,
  };
};

// Calculate aggregate stats for a profile
export const calculateAggregateStats = (profile: PlayerProfile) => {
  let totalPlayTime = 0;
  let totalSessions = 0;
  let totalChores = 0;
  let completedChores = 0;

  Object.values(profile.history || {}).forEach((day) => {
    // Count play sessions
    if (day.playTime?.sessions) {
      totalSessions += day.playTime.sessions.length;

      // Calculate total play time
      day.playTime.sessions.forEach((session) => {
        if (session.start && session.end) {
          const startTime = new Date(session.start).getTime();
          const endTime = new Date(session.end).getTime();
          totalPlayTime += endTime - startTime;
        }
      });
    }

    // Count chores
    if (day.chores) {
      totalChores += day.chores.length;
      completedChores += day.chores.filter(
        (chore) => chore.status === "completed"
      ).length;
    }
  });

  // Convert milliseconds to minutes
  const totalPlayMinutes = Math.floor(totalPlayTime / (1000 * 60));

  // Format as hours:minutes
  const hours = Math.floor(totalPlayMinutes / 60);
  const minutes = totalPlayMinutes % 60;
  const formattedPlayTime = `${hours}:${minutes.toString().padStart(2, "0")}`;

  // Calculate chore completion percentage
  const choreCompletionRate =
    totalChores > 0 ? Math.round((completedChores / totalChores) * 100) : 0;

  return {
    totalPlayMinutes,
    formattedPlayTime,
    totalSessions,
    totalChores,
    completedChores,
    choreCompletionRate,
  };
};

// Calculate chore completion for a day
export const calculateDayChoreStats = (
  dayData: PlayerProfile["history"][string]
) => {
  if (!dayData.chores || dayData.chores.length === 0) {
    return { total: 0, completed: 0, completionRate: 0 };
  }

  const total = dayData.chores.length;
  const completed = dayData.chores.filter(
    (chore) => chore.status === "completed"
  ).length;
  const completionRate = Math.round((completed / total) * 100);

  return { total, completed, completionRate };
};

// Get status icon for chore status
export const getStatusIcon = (
  status: ChoreStatus
): { icon: string; color: string } => {
  switch (status) {
    case "completed":
      return { icon: "✓", color: "text-green-400" };
    case "na":
      return { icon: "N/A", color: "text-gray-400" };
    case "incomplete":
      return { icon: "✗", color: "text-red-400" };
    default:
      return { icon: "✗", color: "text-red-400" };
  }
};

// Get today's date and day of week in a reliable way
export const getTodayInfo = (): { dateString: string; dayOfWeek: number } => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0"); // +1 because months are 0-indexed
  const day = String(today.getDate()).padStart(2, "0");
  const dateString = `${year}-${month}-${day}`;
  const dayOfWeek = today.getDay();

  return { dateString, dayOfWeek };
};

// Format day name helper
export const getDayName = (day: number): string => {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days[day];
};
