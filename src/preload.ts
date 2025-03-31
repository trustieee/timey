import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";
import { RewardType } from "./rewards";
import { PlayerProfile as BasePlayerProfile } from "./playerProfile";

// Define the electronAPI type to ensure consistency
export type ElectronAPI = {
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
  toggleSessionPause: () => Promise<BasePlayerProfile>;
  getAvailableRewards: () => Promise<number>;
  useReward: (
    rewardType: RewardType,
    rewardValue: number
  ) => Promise<BasePlayerProfile>;
  getAuthStatus: () => Promise<{
    isAuthenticated: boolean;
    email: string | null;
  }>;
  getFirebaseConfig: () => Promise<FirebaseConfig>;
  authenticateWithFirebase: (
    email: string,
    password: string
  ) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  onProfileUpdate: (
    callback: (profile: BasePlayerProfile) => void
  ) => () => void;
  checkSavedCredentials: () => Promise<{
    hasSavedCredentials: boolean;
    email: string | null;
  }>;
  clearSavedCredentials: () => Promise<{ success: boolean }>;
};

// Define global Window interface extension for TypeScript
export {};

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
  toggleSessionPause: () => ipcRenderer.invoke("toggle-session-pause"),

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
    ipcRenderer.invoke("authenticate-with-firebase", {
      email,
      password,
    }),

  // Sign out from Firebase
  signOut: () => ipcRenderer.invoke("sign-out"),

  // Saved credentials operations
  checkSavedCredentials: () => ipcRenderer.invoke("check-saved-credentials"),
  clearSavedCredentials: () => ipcRenderer.invoke("clear-saved-credentials"),

  // Real-time profile updates
  onProfileUpdate: (callback: (profile: BasePlayerProfile) => void) => {
    const channel = "profile-update";
    const listener = (_event: IpcRendererEvent, profile: BasePlayerProfile) =>
      callback(profile);
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld("electronAPI", api);

// Firebase configuration interface
interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

// Authentication result interface
interface AuthResult {
  user: {
    email: string | null;
    uid: string;
  };
  error?: string;
}
