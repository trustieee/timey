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
};

// Default player profile
const DEFAULT_PROFILE: PlayerProfile = {
    level: 1,
    xp: 0,
    xpToNextLevel: PROFILE_CONFIG.XP_PER_LEVEL,
    history: {}
};

// Get today's date in YYYY-MM-DD format
export function getTodayDateString(): string {
    const now = new Date();
    
    // Get local date components to ensure we're using local time, not UTC
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
        console.log(`Initializing new day: ${today}`);
        
        // First, check if we need to finalize yesterday's progress
        const yesterdayString = getPreviousDateString(today);

        if (profile.history[yesterdayString] && !profile.history[yesterdayString].completed) {
            console.log(`Found incomplete previous day: ${yesterdayString}`);
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

// Check for and finalize any incomplete previous days
export function checkAndFinalizePreviousDays(profile: PlayerProfile): PlayerProfile {
    const today = getTodayDateString();
    
    // Get all dates in the history
    const dates = Object.keys(profile.history).sort();
    
    // Check each date that's not today or in the future
    for (const date of dates) {
        if (date >= today) continue;
        
        const dayProgress = profile.history[date];
        if (dayProgress && !dayProgress.completed) {
            console.log(`Finalizing incomplete day: ${date}`);
            profile = finalizeDayProgress(profile, date);
        }
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

    // Log the penalties being applied
    if (penalties > 0) {
        console.log(`Applied ${penalties} XP penalties for incomplete tasks on ${date}`);
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
    // Create date from the string, will be interpreted in local timezone
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    
    // Get local date components
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

            // First check and finalize any previous incomplete days
            const updatedProfile = checkAndFinalizePreviousDays(profile);
            
            // Then initialize today's progress if needed
            return initializeDay(updatedProfile);
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
        addXp(profile, PROFILE_CONFIG.XP_FOR_CHORE);
    }

    return profile;
} 