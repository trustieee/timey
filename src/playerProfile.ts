import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { CHORES } from './chores';

// Chore status type
export type ChoreStatus = 'completed' | 'incomplete' | 'na';

// Interface for a single day's progress
export interface DayProgress {
    date: string;  // YYYY-MM-DD
    chores: {
        id: number;
        text: string;
        status: ChoreStatus;
        completedAt?: string;  // ISO datetime if completed
    }[];
    playTime: {
        totalMinutes: number;
        sessions: {
            start: string;
            end: string;
        }[];
    };
    xp: {
        gained: number;     // XP gained during the day
        penalties: number;  // XP lost from incomplete chores
        final: number;     // Net XP after penalties
    };
    completed: boolean;    // Whether this day has been finalized
}

// Define the shape of the player profile
export interface PlayerProfile {
    level: number;
    xp: number;
    xpToNextLevel: number;
    streak: {
        current: number;
        best: number;
        lastCompletedDate: string;  // YYYY-MM-DD
    };
    history: {
        [date: string]: DayProgress;  // Key is YYYY-MM-DD
    };
}

// App configuration
export const PROFILE_CONFIG = {
    XP_PER_LEVEL: 100,        // Base XP needed for first level
    XP_LEVEL_INCREMENT: 50,    // Additional XP needed per level
    XP_FOR_CHORE: 10,         // XP gained for completing a chore
    XP_PENALTY_FOR_CHORE: 10, // XP penalty for incomplete chore at day end
    STREAK_BONUS_XP: 5,       // Additional XP per chore when on a streak
    STREAK_BONUS_THRESHOLD: 3  // Days needed for streak bonus to activate
};

// Default player profile
const DEFAULT_PROFILE: PlayerProfile = {
    level: 1,
    xp: 0,
    xpToNextLevel: PROFILE_CONFIG.XP_PER_LEVEL,
    streak: {
        current: 0,
        best: 0,
        lastCompletedDate: ''
    },
    history: {}
};

// Get today's date in YYYY-MM-DD format
export function getTodayDateString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Create a new day progress object
export function createDayProgress(date: string): DayProgress {
    return {
        date,
        chores: CHORES.map(chore => ({
            id: chore.id,
            text: chore.text,
            status: 'incomplete' as ChoreStatus
        })),
        playTime: {
            totalMinutes: 0,
            sessions: []
        },
        xp: {
            gained: 0,
            penalties: 0,
            final: 0
        },
        completed: false
    };
}

// Initialize or get current day's progress
export function initializeDay(profile: PlayerProfile): PlayerProfile {
    const today = getTodayDateString();

    // If we don't have today's progress, create it
    if (!profile.history[today]) {
        // First, check if we need to finalize yesterday's progress
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayString = getPreviousDateString(today);

        if (profile.history[yesterdayString] && !profile.history[yesterdayString].completed) {
            // Apply penalties for incomplete chores from yesterday
            profile = finalizeDayProgress(profile, yesterdayString);
            // Save the profile after applying penalties
            savePlayerProfile(profile);
        }

        // Create today's progress
        profile.history[today] = createDayProgress(today);
    }

    return profile;
}

// Finalize a day's progress and apply penalties
export function finalizeDayProgress(profile: PlayerProfile, date: string): PlayerProfile {
    const dayProgress = profile.history[date];
    if (!dayProgress || dayProgress.completed) return profile;

    // Calculate penalties for incomplete chores
    let penalties = 0;
    dayProgress.chores.forEach(chore => {
        if (chore.status === 'incomplete') {
            penalties += PROFILE_CONFIG.XP_PENALTY_FOR_CHORE;
        }
    });

    // Update day's XP totals
    dayProgress.xp.penalties = penalties;
    dayProgress.xp.final = dayProgress.xp.gained - penalties;

    // Apply penalties to player's total XP
    profile.xp = Math.max(0, profile.xp - penalties);

    // Update streak
    const allCompleted = dayProgress.chores.every(chore =>
        chore.status === 'completed' || chore.status === 'na'
    );

    if (allCompleted) {
        // Check if this continues the streak
        if (profile.streak.lastCompletedDate === getPreviousDateString(date)) {
            profile.streak.current++;
            profile.streak.best = Math.max(profile.streak.best, profile.streak.current);
        } else {
            profile.streak.current = 1;
        }
        profile.streak.lastCompletedDate = date;
    } else {
        profile.streak.current = 0;
    }

    // Mark day as completed
    dayProgress.completed = true;

    // Set all remaining incomplete chores to 'incomplete'
    dayProgress.chores.forEach(chore => {
        if (chore.status !== 'completed' && chore.status !== 'na') {
            chore.status = 'incomplete';
        }
    });

    return profile;
}

// Get the previous date string
function getPreviousDateString(date: string): string {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// XP requirements for each level
export function getXpRequiredForLevel(level: number): number {
    return PROFILE_CONFIG.XP_PER_LEVEL + (level - 1) * PROFILE_CONFIG.XP_LEVEL_INCREMENT;
}

// Get the profile file path
function getProfilePath(): string {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'playerProfile.json');
}

// Load the player profile
export function loadPlayerProfile(): PlayerProfile {
    const profilePath = getProfilePath();

    try {
        if (fs.existsSync(profilePath)) {
            const data = fs.readFileSync(profilePath, 'utf8');
            const profile = JSON.parse(data) as PlayerProfile;

            // Initialize today's progress if needed
            return initializeDay(profile);
        }
    } catch (error) {
        console.error('Error loading player profile:', error);
    }

    // Return default profile if loading fails or file doesn't exist
    const defaultProfile = { ...DEFAULT_PROFILE };
    return initializeDay(defaultProfile);
}

// Save the player profile
export function savePlayerProfile(profile: PlayerProfile): void {
    const profilePath = getProfilePath();

    try {
        const data = JSON.stringify(profile, null, 2);
        fs.writeFileSync(profilePath, data, 'utf8');
    } catch (error) {
        console.error('Error saving player profile:', error);
    }
}

// Add XP to player profile and handle level ups
export function addXp(profile: PlayerProfile, xpAmount: number): PlayerProfile {
    const today = getTodayDateString();
    const dayProgress = profile.history[today];

    // Add XP to both player total and day's gained XP
    profile.xp += xpAmount;
    if (dayProgress) {
        dayProgress.xp.gained += xpAmount;
        dayProgress.xp.final = dayProgress.xp.gained - dayProgress.xp.penalties;
    }

    // Check for level ups
    while (profile.xp >= profile.xpToNextLevel) {
        profile.xp -= profile.xpToNextLevel;
        profile.level += 1;
        profile.xpToNextLevel = getXpRequiredForLevel(profile.level);
    }

    return profile;
}

// Remove XP from player profile and handle level downs if necessary
export function removeXp(profile: PlayerProfile, xpAmount: number): PlayerProfile {
    const today = getTodayDateString();
    const dayProgress = profile.history[today];

    // Remove XP from both player total and day's gained XP
    profile.xp -= xpAmount;
    if (dayProgress) {
        dayProgress.xp.gained = Math.max(0, dayProgress.xp.gained - xpAmount);
        dayProgress.xp.final = dayProgress.xp.gained - dayProgress.xp.penalties;
    }

    // Handle negative XP by going down levels if necessary
    while (profile.xp < 0 && profile.level > 1) {
        profile.level -= 1;
        profile.xpToNextLevel = getXpRequiredForLevel(profile.level);
        profile.xp += profile.xpToNextLevel;
    }

    // Ensure XP never goes below zero at level 1
    if (profile.xp < 0 && profile.level === 1) {
        profile.xp = 0;
    }

    return profile;
}

// Update chore status in the current day's progress
export function updateChoreStatus(
    profile: PlayerProfile,
    choreId: number,
    status: ChoreStatus
): PlayerProfile {
    const today = getTodayDateString();
    const dayProgress = profile.history[today];

    if (!dayProgress) return profile;

    const chore = dayProgress.chores.find(c => c.id === choreId);
    if (!chore) return profile;

    const oldStatus = chore.status;
    chore.status = status;

    // Update completedAt timestamp if completed
    if (status === 'completed') {
        chore.completedAt = new Date().toISOString();
    } else {
        delete chore.completedAt;
    }

    // Handle XP changes
    if (oldStatus === 'completed' && status !== 'completed') {
        // Remove XP if un-completing a chore
        removeXp(profile, PROFILE_CONFIG.XP_FOR_CHORE);
    } else if (oldStatus !== 'completed' && status === 'completed') {
        // Add XP if completing a chore
        const bonusXp = (profile.streak.current >= PROFILE_CONFIG.STREAK_BONUS_THRESHOLD)
            ? PROFILE_CONFIG.STREAK_BONUS_XP
            : 0;
        addXp(profile, PROFILE_CONFIG.XP_FOR_CHORE + bonusXp);
    }

    return profile;
} 