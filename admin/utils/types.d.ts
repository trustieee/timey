// Add type definitions for Electron API to keep TypeScript happy
// This won't be used in the browser environment
declare interface Window {
  electronAPI?: {
    getFirebaseConfig: () => Promise<any>;
    loadPlayerProfile: () => Promise<any>;
    onProfileUpdate: (callback: (data: any) => void) => () => void;
    windowMove: (deltaX: number, deltaY: number) => void;
    getDarkMode: () => Promise<boolean>;
    toggleDarkMode: () => Promise<boolean>;
    getAppVersion: () => Promise<string>;
    savePlayerProfile: (profile: any) => Promise<any>;
    startPlaySession: () => Promise<void>;
    endPlaySession: () => Promise<void>;
    updateChoreStatus: (id: number, status: string) => Promise<void>;
    useReward: (rewardId: string | number, value: number) => Promise<any>;
    getAuthStatus: () => Promise<{ isAuthenticated: boolean }>;
    authenticateWithFirebase: (email: string, password: string) => Promise<any>;
  };
}
