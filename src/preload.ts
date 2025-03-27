import { contextBridge, ipcRenderer } from "electron";
import { RewardType } from "./rewards";
import { PlayerProfile as BasePlayerProfile } from "./playerProfile";

// Define the electronAPI type to ensure consistency
type ElectronAPI = {
  windowMove: (mouseX: number, mouseY: number) => void;
  getAppVersion: () => Promise<string>;
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
  startPlaySession: () => Promise<BasePlayerProfile>;
  endPlaySession: () => Promise<BasePlayerProfile>;
  getAvailableRewards: () => Promise<number>;
  useReward: (
    rewardType: RewardType,
    rewardValue: number
  ) => Promise<BasePlayerProfile>;
  getAuthStatus: () => Promise<{
    isAuthenticated: boolean;
    email: string | null;
  }>;
  getFirebaseConfig: () => Promise<any>;
  authenticateWithFirebase: (email: string, password: string) => Promise<any>;
  onProfileUpdate: (
    callback: (profile: BasePlayerProfile) => void
  ) => () => void;
};

// Define global Window interface extension for TypeScript
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

// Create the API implementation
const api: ElectronAPI = {
  // Window movement
  windowMove: (mouseX: number, mouseY: number) =>
    ipcRenderer.send("window:move", { mouseX, mouseY }),

  // App version
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),

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
    const listener = (_event: any, profile: BasePlayerProfile) =>
      callback(profile);
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld("electronAPI", api);
