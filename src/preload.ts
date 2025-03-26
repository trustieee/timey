import { contextBridge, ipcRenderer } from "electron";
import { RewardType } from "./rewards";
import { PlayerProfile as BasePlayerProfile } from "./playerProfile";

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
      loadPlayerProfile: () => Promise<BasePlayerProfile>;
      savePlayerProfile: (profile: BasePlayerProfile) => Promise<void>;
      addXp: (amount: number) => Promise<BasePlayerProfile>;
      removeXp: (amount: number) => Promise<BasePlayerProfile>;
      addCompletedChore: (
        choreId: number,
        choreText: string
      ) => Promise<BasePlayerProfile>;
      removeCompletedChore: (choreId: number) => Promise<BasePlayerProfile>;
      updateChoreStatus: (
        choreId: number,
        status: string
      ) => Promise<BasePlayerProfile>;
      // Play session tracking
      startPlaySession: () => Promise<BasePlayerProfile>;
      endPlaySession: () => Promise<BasePlayerProfile>;
      // New rewards methods
      getAvailableRewards: () => Promise<number>;
      useReward: (
        rewardType: RewardType,
        rewardValue: number
      ) => Promise<BasePlayerProfile>;
      // Firebase authentication
      getAuthStatus: () => Promise<{
        isAuthenticated: boolean;
        email: string | null;
      }>;
      // Firebase configuration
      getFirebaseConfig: () => Promise<any>;
      // Firebase authentication
      authenticateWithFirebase: (
        email: string,
        password: string
      ) => Promise<any>;
      // Real-time profile updates
      onProfileUpdate: (
        callback: (profile: BasePlayerProfile) => void
      ) => () => void;
    };
  }
}

contextBridge.exposeInMainWorld("electronAPI", {
  // Expose existing API for dark mode toggle
  toggleDarkMode: () => ipcRenderer.invoke("toggle-dark-mode"),

  // Add new API to get the current dark mode state
  getDarkMode: () => ipcRenderer.invoke("get-dark-mode"),

  // Add API to get app version
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),

  // Add new API for window movement
  windowMove: (mouseX: number, mouseY: number) =>
    ipcRenderer.send("window:move", { mouseX, mouseY }),

  // Player profile APIs
  loadPlayerProfile: () => ipcRenderer.invoke("load-player-profile"),
  savePlayerProfile: (profile: BasePlayerProfile) =>
    ipcRenderer.invoke("save-player-profile", profile),
  addXp: (amount: number) => ipcRenderer.invoke("add-xp", amount),
  removeXp: (amount: number) => ipcRenderer.invoke("remove-xp", amount),
  addCompletedChore: (choreId: number, choreText: string) =>
    ipcRenderer.invoke("player:add-completed-chore", { choreId, choreText }),
  removeCompletedChore: (choreId: number) =>
    ipcRenderer.invoke("player:remove-completed-chore", { choreId }),
  updateChoreStatus: (choreId: number, status: string) =>
    ipcRenderer.invoke("update-chore-status", choreId, status),

  // Play session tracking
  startPlaySession: () => ipcRenderer.invoke("start-play-session"),
  endPlaySession: () => ipcRenderer.invoke("end-play-session"),

  // Rewards APIs
  getAvailableRewards: () => ipcRenderer.invoke("get-available-rewards"),
  useReward: (rewardType: RewardType, rewardValue: number) =>
    ipcRenderer.invoke("use-reward", rewardType, rewardValue),

  // Firebase authentication status
  getAuthStatus: () => ipcRenderer.invoke("get-auth-status"),

  // Get Firebase configuration
  getFirebaseConfig: () => ipcRenderer.invoke("get-firebase-config"),

  // Authenticate with Firebase
  authenticateWithFirebase: (email: string, password: string) =>
    ipcRenderer.invoke("authenticate-with-firebase", { email, password }),

  // Real-time profile updates
  onProfileUpdate: (callback: (profile: BasePlayerProfile) => void) => {
    const channel = "profile-update";

    // Create listener for the channel
    const listener = (_event: any, profile: BasePlayerProfile) =>
      callback(profile);
    ipcRenderer.on(channel, listener);

    // Return a cleanup function
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },
});
