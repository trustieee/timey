import { app, BrowserWindow, ipcMain, nativeTheme, Menu, globalShortcut } from 'electron';
import * as path from 'path';
import started from 'electron-squirrel-startup';
// Import player profile functions
import * as playerProfile from './playerProfile';
import { PlayerProfile as BasePlayerProfile } from './playerProfile';
import { RewardType } from './rewards';
// Import dotenv for loading environment variables
import * as dotenv from 'dotenv';
// Import Firebase authentication
import { auth, initializeFirebase } from './services/firebase';

// Load environment variables from .env file
dotenv.config();

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

// Function to refresh player profile data
async function refreshPlayerProfileData() {
  playerProfileData = await playerProfile.loadPlayerProfile();
}

const createWindow = async () => {
  // Force dark mode at startup
  nativeTheme.themeSource = 'dark';

  // Initialize Firebase first to establish connection and verify permissions
  try {
    const firestoreAvailable = await initializeFirebase();
    console.log(`Firebase initialized. Firestore available: ${firestoreAvailable}`);
    
    if (auth.currentUser) {
      isAuthenticated = true;
      authenticatedEmail = auth.currentUser.email;
      console.log(`User is authenticated: ${authenticatedEmail}`);
    } else {
      console.log('No authenticated user found after initialization');
    }
  } catch (error) {
    console.error('Error initializing Firebase:', error);
  }

  // Now load player profile data after Firebase initialization
  await refreshPlayerProfileData();

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 650,
    height: 950,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    },
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#333333' : '#f8f9fa', // Match theme background color
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
  
  // Set Content Security Policy
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebase.com https://*.firebaseapp.com"]
      }
    });
  });
  
  mainWindow.webContents.openDevTools();

  // Create application menu without update option
  const appMenu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        { role: 'quit' }
      ]
    }
  ]);
  Menu.setApplicationMenu(appMenu);

  // Wait until the window is ready before showing it to prevent flashing
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Ensure window stays visible when blurred - needed on some systems
  mainWindow.on('blur', () => {
    // Don't do anything special on blur
    // This prevents any default behavior that might be hiding the window
  });

  // Handle focus event to ensure window is visible
  mainWindow.on('focus', () => {
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
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  ipcMain.on('window:move', (_, { mouseX, mouseY }) => {
    const [x, y] = mainWindow.getPosition();
    mainWindow.setPosition(x + mouseX, y + mouseY);
  });

  // Add IPC handler to get the app version
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  // Also need to expose a way to get initial theme state
  ipcMain.handle('get-dark-mode', () => {
    return nativeTheme.shouldUseDarkColors;
  });

  ipcMain.handle('toggle-dark-mode', () => {
    if (nativeTheme.shouldUseDarkColors) {
      nativeTheme.themeSource = 'light';
    } else {
      nativeTheme.themeSource = 'dark';
    }
    return nativeTheme.shouldUseDarkColors;
  });

  // Player profile IPC handlers
  ipcMain.handle('load-player-profile', async () => {
    // Refresh the profile data to ensure we have the latest
    await refreshPlayerProfileData();
    return playerProfileData;
  });

  ipcMain.handle('save-player-profile', async (event, profile) => {
    await playerProfile.savePlayerProfile(profile);
    // Update our cached profile data
    playerProfileData = profile;
  });

  ipcMain.handle('add-xp', async (event, amount) => {
    const updatedProfile = await playerProfile.addXp(playerProfileData, amount);
    playerProfileData = updatedProfile;
    return updatedProfile;
  });

  ipcMain.handle('remove-xp', async (event, amount) => {
    const updatedProfile = await playerProfile.removeXp(playerProfileData, amount);
    playerProfileData = updatedProfile;
    return updatedProfile;
  });

  ipcMain.handle('update-chore-status', async (event, choreId, status) => {
    const updatedProfile = await playerProfile.updateChoreStatus(playerProfileData, choreId, status);
    playerProfileData = updatedProfile;
    return updatedProfile;
  });

  // Add handlers for completed chores
  ipcMain.handle('player:add-completed-chore', async (event, { choreId }) => {
    // Use the proper updateChoreStatus function instead of the XP workaround
    const updatedProfile = await playerProfile.updateChoreStatus(playerProfileData, choreId, 'completed');
    playerProfileData = updatedProfile;
    return updatedProfile;
  });

  ipcMain.handle('player:remove-completed-chore', async (event, { choreId }) => {
    // Use the proper updateChoreStatus function instead of the XP workaround
    const updatedProfile = await playerProfile.updateChoreStatus(playerProfileData, choreId, 'incomplete');
    playerProfileData = updatedProfile;
    return updatedProfile;
  });

  // Add handlers for rewards
  ipcMain.handle('get-available-rewards', () => {
    return playerProfileData.rewards ? playerProfileData.rewards.available : 0;
  });

  ipcMain.handle('use-reward', async (event, rewardType, rewardValue) => {
    const updatedProfile = await playerProfile.useReward(
      playerProfileData, 
      rewardType as RewardType, 
      rewardValue
    );
    playerProfileData = updatedProfile;
    return updatedProfile;
  });

  // Add handlers for play session tracking
  ipcMain.handle('start-play-session', async () => {
    const updatedProfile = await playerProfile.startPlaySession(playerProfileData);
    playerProfileData = updatedProfile;
    return updatedProfile;
  });

  ipcMain.handle('end-play-session', async () => {
    const updatedProfile = await playerProfile.endPlaySession(playerProfileData);
    playerProfileData = updatedProfile;
    return updatedProfile;
  });

  // Add IPC handler to get Firebase authentication status
  ipcMain.handle('get-auth-status', () => {
    return {
      isAuthenticated,
      email: authenticatedEmail
    };
  });

  // Register global shortcut for DevTools
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.toggleDevTools();
    }
  });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  createWindow().catch(err => {
    console.error('Error creating window:', err);
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Save player profile when app is about to quit
app.on('before-quit', async () => {
  // Make sure we have the latest profile data
  await refreshPlayerProfileData();
  
  // Save the profile
  await playerProfile.savePlayerProfile(playerProfileData);
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.