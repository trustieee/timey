import { contextBridge, ipcRenderer } from 'electron';
import { RewardType } from './rewards';

// Define global Window interface extension for TypeScript
declare global {
    interface Window {
        electronAPI: {
            toggleDarkMode: () => Promise<boolean>;
            getDarkMode: () => Promise<boolean>;
            windowMove: (mouseX: number, mouseY: number) => void;
            // App version
            getAppVersion: () => Promise<string>;
            // New player profile methods
            loadPlayerProfile: () => Promise<any>;
            savePlayerProfile: (profile: any) => Promise<void>;
            addXp: (amount: number) => Promise<any>;
            removeXp: (amount: number) => Promise<any>;
            addCompletedChore: (choreId: number, choreText: string) => Promise<any>;
            removeCompletedChore: (choreId: number) => Promise<any>;
            updateChoreStatus: (choreId: number, status: string) => Promise<any>;
            // Play session tracking
            startPlaySession: () => Promise<any>;
            endPlaySession: () => Promise<any>;
            // New rewards methods
            getAvailableRewards: () => Promise<number>;
            useReward: (rewardType: RewardType, rewardValue: number) => Promise<any>;
            // Firebase authentication
            getAuthStatus: () => Promise<{ isAuthenticated: boolean, email: string | null }>;
        }
    }
}

// Define player profile interface for type safety
interface PlayerProfile {
    level: number;
    xp: number;
    xpToNextLevel: number;
    completedChores: Array<{
        id: number;
        text: string;
        completedAt: string;
    }>;
    rewards?: {
        available: number;
    };
}

contextBridge.exposeInMainWorld('electronAPI', {
    // Expose existing API for dark mode toggle
    toggleDarkMode: () => ipcRenderer.invoke('toggle-dark-mode'),

    // Add new API to get the current dark mode state
    getDarkMode: () => ipcRenderer.invoke('get-dark-mode'),

    // Add API to get app version
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),

    // Add new API for window movement
    windowMove: (mouseX: number, mouseY: number) => ipcRenderer.send('window:move', { mouseX, mouseY }),

    // Player profile APIs
    loadPlayerProfile: () => ipcRenderer.invoke('load-player-profile'),
    savePlayerProfile: (profile: PlayerProfile) => ipcRenderer.invoke('save-player-profile', profile),
    addXp: (amount: number) => ipcRenderer.invoke('add-xp', amount),
    removeXp: (amount: number) => ipcRenderer.invoke('remove-xp', amount),
    addCompletedChore: (choreId: number, choreText: string) => ipcRenderer.invoke('player:add-completed-chore', { choreId, choreText }),
    removeCompletedChore: (choreId: number) => ipcRenderer.invoke('player:remove-completed-chore', { choreId }),
    updateChoreStatus: (choreId: number, status: string) => ipcRenderer.invoke('update-chore-status', choreId, status),
    
    // Play session tracking
    startPlaySession: () => ipcRenderer.invoke('start-play-session'),
    endPlaySession: () => ipcRenderer.invoke('end-play-session'),
    
    // Rewards APIs
    getAvailableRewards: () => ipcRenderer.invoke('get-available-rewards'),
    useReward: (rewardType: RewardType, rewardValue: number) => ipcRenderer.invoke('use-reward', rewardType, rewardValue),
    
    // Firebase authentication status
    getAuthStatus: () => ipcRenderer.invoke('get-auth-status')
});