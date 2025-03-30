import {
  app,
  BrowserWindow,
  ipcMain,
  nativeTheme,
  Menu,
  globalShortcut,
} from "electron";
import path from "path";
import started from "electron-squirrel-startup";
// Import player profile functions
import * as playerProfile from "./playerProfile";
import { PlayerProfile as BasePlayerProfile } from "./playerProfile";
import { RewardType } from "./rewards";
// Import dotenv for loading environment variables
import * as dotenv from "dotenv";
// Import Firebase authentication
import {
  auth,
  initializeFirebase,
  authenticateWithFirebase,
  onProfileUpdate,
} from "./services/firebase";
// Import APP_CONFIG directly
import { firebaseConfig as hardcodedConfig, APP_CONFIG } from "./config";
// Import electron-store for saving credentials
import Store from "electron-store";

// Load environment variables from .env file
dotenv.config();

// Define store schema interface
interface StoreSchema {
  credentials?: {
    email: string;
    password: string;
  };
}

// Create a store with typed methods
const secureStore = new Store<StoreSchema>() as Store<StoreSchema> & {
  get(key: "credentials"): StoreSchema["credentials"] | undefined;
  set(key: "credentials", value: StoreSchema["credentials"] | undefined): void;
};

// Firebase configuration from environment variables with fallback to hardcoded config
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || hardcodedConfig.apiKey,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || hardcodedConfig.authDomain,
  projectId: process.env.FIREBASE_PROJECT_ID || hardcodedConfig.projectId,
  storageBucket:
    process.env.FIREBASE_STORAGE_BUCKET || hardcodedConfig.storageBucket,
  messagingSenderId:
    process.env.FIREBASE_MESSAGING_SENDER_ID ||
    hardcodedConfig.messagingSenderId,
  appId: process.env.FIREBASE_APP_ID || hardcodedConfig.appId,
  measurementId:
    process.env.FIREBASE_MEASUREMENT_ID || hardcodedConfig.measurementId,
};

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Firebase authentication status
let isAuthenticated = false;
let authenticatedEmail: string | null = null;

// Player profile for the app session
let playerProfileData: PlayerProfile = null;

// Define the extended PlayerProfile type
type PlayerProfile = BasePlayerProfile & {
  level: number;
  xp: number;
  xpToNextLevel: number;
};

// Store unsubscribe function for profile updates
let profileUpdateUnsubscribe: (() => void) | null = null;

// Function to refresh player profile data
async function refreshPlayerProfileData() {
  try {
    // Only attempt to load profile if user is authenticated
    if (isAuthenticated && authenticatedEmail) {
      console.log(
        "Loading profile data for authenticated user:",
        authenticatedEmail
      );

      // Load profile from Firebase
      const baseProfile = await playerProfile.loadPlayerProfile();

      // Verify we got a valid profile
      if (!baseProfile) {
        console.error("Failed to load profile data - no profile returned");
        return null;
      }

      try {
        // Update appInfo on every load
        baseProfile.appInfo = playerProfile.createDefaultAppInfo();

        // Save updated appInfo back to Firebase
        await playerProfile.savePlayerProfile(baseProfile);

        // Log profile contents for debugging
        console.log(
          "Profile loaded, has chores:",
          baseProfile.chores && baseProfile.chores.length > 0
        );
      } catch (saveError) {
        // If saving fails, log but continue with the loaded profile
        console.error("Error updating appInfo:", saveError);
        // Don't return null here, continue with the profile we have
      }

      // Calculate derived properties
      playerProfileData = {
        ...baseProfile,
        level: calculateLevel(baseProfile),
        xp: calculateXp(baseProfile),
        xpToNextLevel: calculateXpToNextLevel(),
      };

      return playerProfileData;
    } else {
      console.log("Not loading profile - user not authenticated");
      playerProfileData = null;
      return null;
    }
  } catch (error) {
    console.error("Error refreshing player profile data:", error);
    return null;
  }
}

// Function to check for saved credentials and log in
async function tryAutoLogin(): Promise<boolean> {
  try {
    // Use any to bypass TypeScript checking
    const credentials = secureStore.get("credentials");

    if (
      credentials &&
      typeof credentials === "object" &&
      "email" in credentials &&
      "password" in credentials
    ) {
      const email = credentials.email as string;

      console.log(`Attempting auto-login for user: ${email}`);

      // Actually authenticate with Firebase instead of just setting flags
      try {
        // Authenticate with Firebase
        const userCredential = await authenticateWithFirebase(
          email,
          credentials.password
        );
        if (!userCredential || !userCredential.user) {
          console.log("Auto-login failed - invalid user credentials");
          return false;
        }

        isAuthenticated = true;
        authenticatedEmail = email;

        console.log(`Auto-login successful for: ${authenticatedEmail}`);

        // Ensure profile data is fully loaded after authentication
        const profile = await refreshPlayerProfileData();

        // If profile is null, something went wrong with loading
        if (!profile) {
          console.error("Auto-login failed - could not load profile data");
          isAuthenticated = false;
          authenticatedEmail = null;
          return false;
        }

        // Verify the profile has chores before considering login fully successful
        if (profile && profile.chores && profile.chores.length > 0) {
          console.log("Profile chores loaded successfully");
          return true;
        } else {
          console.log("Auto-login succeeded but profile has no chores");
          // Authentication succeeded but no chores found - still return true
          // The renderer will handle showing the appropriate message
          return true;
        }
      } catch (authError) {
        console.error("Auto-login authentication failed:", authError);
        // Clear saved credentials if they don't work
        secureStore.set("credentials", undefined);
        return false;
      }
    }
  } catch (error) {
    console.error("Auto-login failed:", error);
    // Clear saved credentials if they're invalid
    secureStore.set("credentials", undefined);
  }

  return false;
}

// Set up listener for real-time profile updates
function setupProfileChangeListener(mainWindow: BrowserWindow) {
  // Unsubscribe from any existing listener
  if (profileUpdateUnsubscribe) {
    profileUpdateUnsubscribe();
    profileUpdateUnsubscribe = null;
  }

  // Set up real-time listener
  profileUpdateUnsubscribe = onProfileUpdate((updatedProfile) => {
    console.log("Real-time profile update received in main process");

    // Update our cached profile data
    playerProfileData = {
      ...updatedProfile,
      level: calculateLevel(updatedProfile),
      xp: calculateXp(updatedProfile),
      xpToNextLevel: calculateXpToNextLevel(),
    };

    // Only forward the update if the window still exists and isn't destroyed
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      try {
        mainWindow.webContents.send("profile-update", playerProfileData);
      } catch (error) {
        console.error("Error sending profile update to renderer:", error);
      }
    }
  });
}

// Helper functions to calculate profile properties
function calculateLevel(profile: BasePlayerProfile): number {
  if (!profile.history) return 1;

  let totalXp = 0;
  for (const date in profile.history) {
    if (profile.history[date].xp && profile.history[date].xp.final) {
      totalXp += profile.history[date].xp.final;
    }
  }

  // Calculate level based on XP (each level needs same amount of XP now)
  const xpPerLevel = APP_CONFIG.PROFILE.XP_PER_LEVEL;
  const level = Math.floor(totalXp / xpPerLevel) + 1;

  return level;
}

function calculateXp(profile: BasePlayerProfile): number {
  if (!profile.history) return 0;

  let totalXp = 0;
  for (const date in profile.history) {
    // Add null/undefined checks to avoid NaN
    if (profile.history[date]?.xp?.final !== undefined) {
      totalXp += profile.history[date].xp.final;
    }
  }

  // Calculate remaining XP for current level
  const xpPerLevel = APP_CONFIG.PROFILE.XP_PER_LEVEL;
  return totalXp % xpPerLevel;
}

function calculateXpToNextLevel(): number {
  // XP to next level is simply the configured value now
  return APP_CONFIG.PROFILE.XP_PER_LEVEL;
}

const createWindow = async () => {
  // Force dark mode at startup
  nativeTheme.themeSource = "dark";

  // Create the browser window first so we can set up listeners
  const mainWindow = new BrowserWindow({
    width: 650,
    height: 950,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    backgroundColor: "#333333", // Dark theme background color
    alwaysOnTop: false,
    roundedCorners: true,
    frame: false,
    focusable: true,
    closable: true,
    fullscreenable: false,
    maximizable: false,
    resizable: false,
    show: false, // Don't show the window until it's ready
  });

  // Initialize Firebase first to establish connection but don't authenticate
  try {
    // Initialize Firebase without credentials (no auto-login)
    const firestoreAvailable = await initializeFirebase();
    console.log(
      `Firebase initialized. Firestore available: ${firestoreAvailable}`
    );

    // Check if there's already a user authenticated (from a previous session)
    if (auth.currentUser) {
      isAuthenticated = true;
      authenticatedEmail = auth.currentUser.email;
      console.log(`User is authenticated: ${authenticatedEmail}`);

      // Set up profile listener for real-time updates since user is authenticated
      setupProfileChangeListener(mainWindow);
    } else {
      // Try auto-login if no current user
      const autoLoginSuccessful = await tryAutoLogin();

      if (autoLoginSuccessful) {
        console.log("Auto-login successful, setting up profile listener");
        // Set up profile listener for real-time updates
        setupProfileChangeListener(mainWindow);
      } else {
        console.log("Auto-login failed or not attempted");
      }
    }
  } catch (error) {
    console.error("Error initializing Firebase:", error);
  }

  // Now load player profile data after Firebase initialization
  await refreshPlayerProfileData();

  // Set Content Security Policy
  mainWindow.webContents.session.webRequest.onHeadersReceived(
    (details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [
            "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebase.com https://*.firebaseapp.com",
          ],
        },
      });
    }
  );

  // For development, uncomment to enable DevTools by default
  // mainWindow.webContents.openDevTools();

  // Create application menu without update option
  const appMenu = Menu.buildFromTemplate([
    {
      label: "File",
      submenu: [{ role: "quit" }],
    },
  ]);
  Menu.setApplicationMenu(appMenu);

  // Wait until the window is ready before showing it to prevent flashing
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Ensure window stays visible when blurred - needed on some systems
  mainWindow.on("blur", () => {
    // Don't do anything special on blur
    // This prevents any default behavior that might be hiding the window
  });

  // Handle focus event to ensure window is visible
  mainWindow.on("focus", () => {
    // Make sure window is shown and not minimized when focused
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  ipcMain.on("window:move", (_, { mouseX, mouseY }) => {
    const [x, y] = mainWindow.getPosition();
    mainWindow.setPosition(x + mouseX, y + mouseY);
  });

  // Add IPC handler to get the app version
  ipcMain.handle("get-app-version", () => {
    return app.getVersion();
  });

  // Player profile IPC handlers
  ipcMain.handle("load-player-profile", async () => {
    // Refresh the profile data to ensure we have the latest
    await refreshPlayerProfileData();
    return playerProfileData;
  });

  ipcMain.handle("save-player-profile", async (event, profile) => {
    await playerProfile.savePlayerProfile(profile);
    // Update our cached profile data
    playerProfileData = profile;
  });

  ipcMain.handle("add-xp", async (event, amount) => {
    const updatedProfile = await playerProfile.addXp(playerProfileData, amount);
    playerProfileData = updatedProfile;
    return updatedProfile;
  });

  ipcMain.handle("remove-xp", async (event, amount) => {
    const updatedProfile = await playerProfile.removeXp(
      playerProfileData,
      amount
    );
    playerProfileData = updatedProfile;
    return updatedProfile;
  });

  ipcMain.handle("update-chore-status", async (event, choreId, status) => {
    const updatedProfile = await playerProfile.updateChoreStatus(
      playerProfileData,
      choreId,
      status
    );
    playerProfileData = updatedProfile;
    return updatedProfile;
  });

  // Add handlers for completed chores
  ipcMain.handle("player:add-completed-chore", async (event, { choreId }) => {
    // Use the proper updateChoreStatus function instead of the XP workaround
    const updatedProfile = await playerProfile.updateChoreStatus(
      playerProfileData,
      choreId,
      "completed"
    );
    playerProfileData = updatedProfile;
    return updatedProfile;
  });

  ipcMain.handle(
    "player:remove-completed-chore",
    async (event, { choreId }) => {
      // Use the proper updateChoreStatus function instead of the XP workaround
      const updatedProfile = await playerProfile.updateChoreStatus(
        playerProfileData,
        choreId,
        "incomplete"
      );
      playerProfileData = updatedProfile;
      return updatedProfile;
    }
  );

  // Add handlers for rewards
  ipcMain.handle("get-available-rewards", () => {
    return playerProfileData.rewards ? playerProfileData.rewards.available : 0;
  });

  ipcMain.handle("use-reward", async (event, rewardType, rewardValue) => {
    const updatedProfile = await playerProfile.useReward(
      playerProfileData,
      rewardType as RewardType,
      rewardValue
    );
    playerProfileData = updatedProfile;
    return updatedProfile;
  });

  // Add handlers for play session tracking
  ipcMain.handle("start-play-session", async () => {
    const updatedProfile = await playerProfile.startPlaySession(
      playerProfileData
    );
    playerProfileData = updatedProfile;
    return updatedProfile;
  });

  ipcMain.handle("end-play-session", async () => {
    const updatedProfile = await playerProfile.endPlaySession(
      playerProfileData
    );
    playerProfileData = updatedProfile;
    return updatedProfile;
  });

  // Add IPC handler to get Firebase authentication status
  ipcMain.handle("get-auth-status", () => {
    return {
      isAuthenticated,
      email: authenticatedEmail,
    };
  });

  // Add IPC handler to get Firebase configuration
  ipcMain.handle("get-firebase-config", () => {
    return firebaseConfig;
  });

  // Add Firebase authentication handler
  ipcMain.handle(
    "authenticate-with-firebase",
    async (event, { email, password }) => {
      try {
        const userCredential = await authenticateWithFirebase(email, password);
        isAuthenticated = true;
        authenticatedEmail = email;

        secureStore.set("credentials", { email, password });

        // Set up real-time profile update listener after successful authentication
        setupProfileChangeListener(mainWindow);

        // Only return serializable data, not the full userCredential object which might have circular references
        return {
          success: true,
          user: {
            email: userCredential.user?.email || email,
            uid: userCredential.user?.uid || null,
          },
        };
      } catch (error) {
        console.error("Authentication error:", error);
        return { success: false, error: error.message };
      }
    }
  );

  // Add new handler to check if credentials are saved
  ipcMain.handle("check-saved-credentials", () => {
    const credentials = secureStore.get("credentials");

    if (
      credentials &&
      typeof credentials === "object" &&
      "email" in credentials
    ) {
      return {
        hasSavedCredentials: true,
        email: credentials.email as string,
      };
    }

    return {
      hasSavedCredentials: false,
      email: null,
    };
  });

  // Add handler to clear saved credentials
  ipcMain.handle("clear-saved-credentials", () => {
    secureStore.set("credentials", undefined);
    return { success: true };
  });

  // Register global shortcut for DevTools
  globalShortcut.register("CommandOrControl+Shift+I", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.toggleDevTools();
    }
  });

  // Handle window close event to clean up listeners specific to this window
  mainWindow.on("closed", () => {
    // Clean up profile listeners when the window closes
    if (profileUpdateUnsubscribe) {
      profileUpdateUnsubscribe();
      profileUpdateUnsubscribe = null;
    }
  });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", () => {
  createWindow().catch((err) => {
    console.error("Error creating window:", err);
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Clean up listeners when app is quitting
app.on("before-quit", async () => {
  // Unsubscribe from all Firebase listeners first to prevent updates during shutdown
  if (profileUpdateUnsubscribe) {
    profileUpdateUnsubscribe();
    profileUpdateUnsubscribe = null;
  }

  try {
    // Make sure we have the latest profile data
    await refreshPlayerProfileData();

    // Save the profile
    await playerProfile.savePlayerProfile(playerProfileData);
  } catch (error) {
    console.error("Error saving profile during app shutdown:", error);
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
