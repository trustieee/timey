import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { APP_CONFIG, DEFAULT_PROFILE } from './config';
import { getLocalDateString, getLocalISOString, getPreviousDateString, parseLocalDate } from './utils';

// Chore status type
export type ChoreStatus = 'completed' | 'incomplete' | 'na';

// Interface for a single day's progress
export interface DayProgress {
    date: string;  // YYYY-MM-DD
    chores: {
        id: number;
        text: string;
        status: ChoreStatus;
        completedAt?: string;  // ISO datetime in local time (no Z suffix)
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
    history: {
        [date: string]: DayProgress;  // Key is YYYY-MM-DD
    };
    // Level and XP will be calculated from history
}

// Calculate player's XP and level from history
export function calculatePlayerStats(profile: PlayerProfile): { 
    level: number; 
    xp: number; 
    xpToNextLevel: number;
} {
    // Start at level 1 with 0 XP
    let level = 1;
    let xp = 0;

    // Sum up the final XP from all days in history
    Object.values(profile.history).forEach(day => {
        if (day.xp && day.xp.final > 0) {
            xp += day.xp.final;
        }
    });

    // Calculate level based on XP
    while (xp >= getXpRequiredForLevel(level)) {
        xp -= getXpRequiredForLevel(level);
        level += 1;
    }

    return {
        level,
        xp,
        xpToNextLevel: getXpRequiredForLevel(level)
    };
}

// Create a new day progress object
export function createDayProgress(date: string): DayProgress {
    return {
        date,
        chores: APP_CONFIG.CHORES.map(chore => ({
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
    const today = getLocalDateString();

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
    const today = getLocalDateString();
    
    // Get all dates in the history
    const dates = Object.keys(profile.history).sort();
    
    // Check each date that's not today or in the future
    for (const date of dates) {
        // To ensure we handle year differences properly, 
        // parse the dates into comparable objects
        const dateObj = parseLocalDate(date);
        const todayObj = parseLocalDate(today);
        
        if (dateObj >= todayObj) continue;
        
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
            penalties += APP_CONFIG.PROFILE.XP_PENALTY_FOR_CHORE;
        }
    });

    // Update day's XP totals
    dayProgress.xp.penalties = penalties;
    dayProgress.xp.final = dayProgress.xp.gained - penalties;

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

// XP requirements for each level
export function getXpRequiredForLevel(level: number): number {
    if (level <= APP_CONFIG.PROFILE.XP_PER_LEVEL.length) {
        return APP_CONFIG.PROFILE.XP_PER_LEVEL[level - 1];
    }
    return APP_CONFIG.PROFILE.DEFAULT_XP_PER_LEVEL;
}

// Get the profile file path
function getProfilePath(): string {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'playerProfile.json');
}

// Load the player profile
export function loadPlayerProfile(): PlayerProfile & {level: number, xp: number, xpToNextLevel: number} {
    const profilePath = getProfilePath();

    try {
        if (fs.existsSync(profilePath)) {
            const data = fs.readFileSync(profilePath, 'utf8');
            let profile = JSON.parse(data) as PlayerProfile;
            
            // Make sure history is defined
            if (!profile.history) {
                profile.history = {};
            }

            // First check and finalize any previous incomplete days
            const updatedProfile = checkAndFinalizePreviousDays(profile);
            
            // Then initialize today's progress if needed
            const finalProfile = initializeDay(updatedProfile);
            
            // Calculate player stats from history
            const stats = calculatePlayerStats(finalProfile);
            
            // Return combined profile and stats
            return { 
                ...finalProfile, 
                level: stats.level, 
                xp: stats.xp, 
                xpToNextLevel: stats.xpToNextLevel 
            };
        }
    } catch (error) {
        console.error('Error loading player profile:', error);
    }

    // Return default profile if loading fails or file doesn't exist
    const defaultProfile = { history: {} };
    const initializedProfile = initializeDay(defaultProfile);
    const stats = calculatePlayerStats(initializedProfile);
    
    // Return combined profile and stats
    return { 
        ...initializedProfile, 
        level: stats.level, 
        xp: stats.xp, 
        xpToNextLevel: stats.xpToNextLevel 
    };
}

// Save the player profile
export function savePlayerProfile(profile: PlayerProfile): void {
    const profilePath = getProfilePath();

    // We only need to save the history, not the calculated stats
    const storageProfile = {
        history: profile.history
    };

    try {
        const data = JSON.stringify(storageProfile, null, 2);
        fs.writeFileSync(profilePath, data, 'utf8');
    } catch (error) {
        console.error('Error saving player profile:', error);
    }
}

// Add XP to player profile for today's progress
export function addXp(profile: PlayerProfile & {level: number, xp: number, xpToNextLevel: number}, xpAmount: number): PlayerProfile & {level: number, xp: number, xpToNextLevel: number} {
    const today = getLocalDateString();
    const dayProgress = profile.history[today];

    // Add XP to day's gained XP
    if (dayProgress) {
        dayProgress.xp.gained += xpAmount;
        dayProgress.xp.final = dayProgress.xp.gained - dayProgress.xp.penalties;
    }

    // Recalculate player stats
    const stats = calculatePlayerStats(profile);
    
    // Return updated profile with stats
    return { 
        ...profile, 
        level: stats.level, 
        xp: stats.xp, 
        xpToNextLevel: stats.xpToNextLevel 
    };
}

// Remove XP from player profile
export function removeXp(profile: PlayerProfile & {level: number, xp: number, xpToNextLevel: number}, xpAmount: number): PlayerProfile & {level: number, xp: number, xpToNextLevel: number} {
    const today = getLocalDateString();
    const dayProgress = profile.history[today];

    // Remove XP from day's gained XP
    if (dayProgress) {
        dayProgress.xp.gained = Math.max(0, dayProgress.xp.gained - xpAmount);
        dayProgress.xp.final = dayProgress.xp.gained - dayProgress.xp.penalties;
    }

    // Recalculate player stats
    const stats = calculatePlayerStats(profile);
    
    // Return updated profile with stats
    return { 
        ...profile, 
        level: stats.level, 
        xp: stats.xp, 
        xpToNextLevel: stats.xpToNextLevel 
    };
}

// Update chore status in the current day's progress
export function updateChoreStatus(
    profile: PlayerProfile & {level: number, xp: number, xpToNextLevel: number},
    choreId: number,
    status: ChoreStatus
): PlayerProfile & {level: number, xp: number, xpToNextLevel: number} {
    const today = getLocalDateString();
    const dayProgress = profile.history[today];

    if (!dayProgress) return profile;

    const chore = dayProgress.chores.find(c => c.id === choreId);
    if (!chore) return profile;

    const oldStatus = chore.status;
    chore.status = status;

    // Update completedAt timestamp if completed - use local time format
    if (status === 'completed') {
        chore.completedAt = getLocalISOString();
    } else {
        delete chore.completedAt;
    }

    // Handle XP changes
    if (oldStatus === 'completed' && status !== 'completed') {
        // Remove XP if un-completing a chore
        return removeXp(profile, APP_CONFIG.PROFILE.XP_FOR_CHORE);
    } else if (oldStatus !== 'completed' && status === 'completed') {
        // Add XP if completing a chore
        return addXp(profile, APP_CONFIG.PROFILE.XP_FOR_CHORE);
    }

    return profile;
} 