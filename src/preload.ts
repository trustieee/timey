import { contextBridge, ipcRenderer } from 'electron';

// Define global Window interface extension for TypeScript
declare global {
    interface Window {
        electronAPI: {
            toggleDarkMode: () => Promise<boolean>;
            getDarkMode: () => Promise<boolean>;
            windowMove: (mouseX: number, mouseY: number) => void;
        }
    }
}

contextBridge.exposeInMainWorld('electronAPI', {
    // Expose existing API for dark mode toggle
    toggleDarkMode: () => ipcRenderer.invoke('dark-mode:toggle'),

    // Add new API to get the current dark mode state
    getDarkMode: () => ipcRenderer.invoke('dark-mode:get'),

    // Add new API for window movement
    windowMove: (mouseX: number, mouseY: number) => {
        ipcRenderer.send('window:move', { mouseX, mouseY });
    }
});