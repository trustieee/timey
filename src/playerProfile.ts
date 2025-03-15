import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

// Define the shape of the player profile
export interface PlayerProfile {
    level: number;
    xp: number;
    xpToNextLevel: number;
    completedChores: CompletedChore[];
}

// Interface for completed chores tracking
export interface CompletedChore {
    id: number;
    text: string;
    completedAt: string; // ISO date string
}

// Default player profile
const DEFAULT_PROFILE: PlayerProfile = {
    level: 1,
    xp: 0,
    xpToNextLevel: 100, // XP needed for first level-up
    completedChores: []
};

// XP requirements for each level
// Formula: each level requires previous level's XP + 50
export function getXpRequiredForLevel(level: number): number {
    return 100 + (level - 1) * 50;
}

// Get the profile file path
function getProfilePath(): string {
    const userDataPath = app.getPath('userData');
    console.log(userDataPath);
    return path.join(userDataPath, 'playerProfile.json');
}

// Load the player profile
export function loadPlayerProfile(): PlayerProfile {
    const profilePath = getProfilePath();
    
    try {
        if (fs.existsSync(profilePath)) {
            const data = fs.readFileSync(profilePath, 'utf8');
            const profile = JSON.parse(data) as PlayerProfile;
            
            // Update xpToNextLevel in case our formula changed
            profile.xpToNextLevel = getXpRequiredForLevel(profile.level);
            
            return profile;
        }
    } catch (error) {
        console.error('Error loading player profile:', error);
    }
    
    // Return default profile if loading fails or file doesn't exist
    return { ...DEFAULT_PROFILE };
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
    profile.xp += xpAmount;
    
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
    profile.xp -= xpAmount;
    
    // Handle negative XP by going down levels if necessary
    while (profile.xp < 0 && profile.level > 1) {
        profile.level -= 1;
        profile.xpToNextLevel = getXpRequiredForLevel(profile.level);
        profile.xp += profile.xpToNextLevel; // Add previous level's max XP
    }
    
    // Ensure XP never goes below zero at level 1
    if (profile.xp < 0 && profile.level === 1) {
        profile.xp = 0;
    }
    
    return profile;
}

// Add a completed chore to the profile
export function addCompletedChore(profile: PlayerProfile, choreId: number, choreText: string): PlayerProfile {
    profile.completedChores.push({
        id: choreId,
        text: choreText,
        completedAt: new Date().toISOString()
    });
    
    return profile;
}

// Remove a chore from completed history, used when unchecking a chore
export function removeCompletedChore(profile: PlayerProfile, choreId: number): PlayerProfile {
    // Find the index of the most recent completion of this chore
    const index = [...profile.completedChores]
        .reverse()
        .findIndex(chore => chore.id === choreId);
    
    if (index !== -1) {
        // Remove only the most recent instance
        // Convert back from reverse index to normal index
        const actualIndex = profile.completedChores.length - 1 - index;
        profile.completedChores.splice(actualIndex, 1);
    }
    
    return profile;
}

// Get XP percentage to next level
export function getXpPercentage(profile: PlayerProfile): number {
    return Math.floor((profile.xp / profile.xpToNextLevel) * 100);
} 