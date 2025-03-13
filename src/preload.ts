import { contextBridge, ipcRenderer } from 'electron';

// Define global Window interface extension for TypeScript
declare global {
    interface Window {
        electronAPI: {
            toggleDarkMode: () => Promise<boolean>;
            getDarkMode: () => Promise<boolean>;
            windowMove: (mouseX: number, mouseY: number) => void;
            // New player profile methods
            loadPlayerProfile: () => Promise<any>;
            savePlayerProfile: (profile: any) => Promise<void>;
            addXp: (amount: number) => Promise<any>;
            removeXp: (amount: number) => Promise<any>;
            addCompletedChore: (choreId: number, choreText: string) => Promise<any>;
            removeCompletedChore: (choreId: number) => Promise<any>;
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
}

contextBridge.exposeInMainWorld('electronAPI', {
    // Expose existing API for dark mode toggle
    toggleDarkMode: () => ipcRenderer.invoke('dark-mode:toggle'),

    // Add new API to get the current dark mode state
    getDarkMode: () => ipcRenderer.invoke('dark-mode:get'),

    // Add new API for window movement
    windowMove: (mouseX: number, mouseY: number) => {
        ipcRenderer.send('window:move', { mouseX, mouseY });
    },

    // Player profile APIs
    loadPlayerProfile: () => ipcRenderer.invoke('player:load-profile'),
    savePlayerProfile: (profile: PlayerProfile) => ipcRenderer.invoke('player:save-profile', profile),
    addXp: (amount: number) => ipcRenderer.invoke('player:add-xp', amount),
    removeXp: (amount: number) => ipcRenderer.invoke('player:remove-xp', amount),
    addCompletedChore: (choreId: number, choreText: string) => ipcRenderer.invoke('player:add-completed-chore', { choreId, choreText }),
    removeCompletedChore: (choreId: number) => ipcRenderer.invoke('player:remove-completed-chore', { choreId })
});