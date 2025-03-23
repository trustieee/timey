import { app, BrowserWindow, ipcMain, nativeTheme, Menu, dialog } from 'electron';
import * as path from 'path';
import started from 'electron-squirrel-startup';
import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater';
// Import player profile functions
import * as playerProfile from './playerProfile';
import { APP_CONFIG } from './config';
import { RewardType } from './rewards';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Configure auto-updater
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.logger = console;
autoUpdater.allowDowngrade = false;
autoUpdater.allowPrerelease = true;
autoUpdater.channel = "latest";

// Get app version from package.json
const appVersion = app.getVersion();

// Check for updates every hour when app is running
const CHECK_INTERVAL = APP_CONFIG.UPDATE_CHECK_INTERVAL;

// Auto updater events
autoUpdater.on('checking-for-update', () => {
  console.log('Checking for update...');
});

autoUpdater.on('update-available', (info: UpdateInfo) => {
  console.log('Update available:', info);
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Available',
    message: `A new version (${info.version}) is available and will be installed on quit.`,
    buttons: ['OK']
  });
});

autoUpdater.on('update-not-available', () => {
  console.log('Update not available');
});

autoUpdater.on('error', (err) => {
  console.error('Auto updater error:', err);
});

autoUpdater.on('download-progress', (progressObj: ProgressInfo) => {
  let logMessage = `Download speed: ${progressObj.bytesPerSecond}`;
  logMessage = `${logMessage} - Downloaded ${progressObj.percent}%`;
  logMessage = `${logMessage} (${progressObj.transferred}/${progressObj.total})`;
  console.log(logMessage);
});

autoUpdater.on('update-downloaded', () => {
  console.log('Update downloaded');
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Ready',
    message: 'A new version has been downloaded. Would you like to install it now?',
    detail: 'The application will restart to apply the updates.',
    buttons: ['Install Now', 'Install Later'],
    defaultId: 0,
    cancelId: 1
  }).then(result => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall(true, true);
    }
  });
});

// Player profile for the app session
let playerProfileData = playerProfile.loadPlayerProfile();

// Function to refresh player profile data
function refreshPlayerProfileData() {
  playerProfileData = playerProfile.loadPlayerProfile();
}

const createWindow = () => {
  // Force dark mode at startup
  nativeTheme.themeSource = 'dark';

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 650,
    height: 950,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
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

  // Create application menu with update option
  const appMenu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        {
          label: 'Check for Updates',
          click: () => {
            autoUpdater.checkForUpdatesAndNotify().catch((err: Error) => {
              console.error('Error checking for updates:', err);
              dialog.showMessageBox({
                type: 'error',
                title: 'Update Error',
                message: `Failed to check for updates: ${err.message}`,
                buttons: ['OK']
              });
            });
          }
        },
        { type: 'separator' },
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

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();

  ipcMain.on('window:move', (_, { mouseX, mouseY }) => {
    const [x, y] = mainWindow.getPosition();
    mainWindow.setPosition(x + mouseX, y + mouseY);
  });

  // Add IPC handler to get the app version
  ipcMain.handle('get-app-version', () => {
    return appVersion;
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
  ipcMain.handle('load-player-profile', () => {
    // Refresh the profile data to ensure we have the latest
    refreshPlayerProfileData();
    return playerProfileData;
  });

  ipcMain.handle('save-player-profile', (event, profile) => {
    playerProfile.savePlayerProfile(profile);
    // Update our cached profile data
    playerProfileData = profile;
  });

  ipcMain.handle('add-xp', (event, amount) => {
    const updatedProfile = playerProfile.addXp(playerProfileData, amount);
    playerProfile.savePlayerProfile(updatedProfile);
    playerProfileData = updatedProfile;
    return updatedProfile;
  });

  ipcMain.handle('remove-xp', (event, amount) => {
    const updatedProfile = playerProfile.removeXp(playerProfileData, amount);
    playerProfile.savePlayerProfile(updatedProfile);
    playerProfileData = updatedProfile;
    return updatedProfile;
  });

  ipcMain.handle('update-chore-status', (event, choreId, status) => {
    const updatedProfile = playerProfile.updateChoreStatus(playerProfileData, choreId, status);
    playerProfile.savePlayerProfile(updatedProfile);
    playerProfileData = updatedProfile;
    return updatedProfile;
  });

  // Add handlers for completed chores
  ipcMain.handle('player:add-completed-chore', (event, { choreId, choreText }) => {
    // Use the proper updateChoreStatus function instead of the XP workaround
    const updatedProfile = playerProfile.updateChoreStatus(playerProfileData, choreId, 'completed');
    playerProfile.savePlayerProfile(updatedProfile);
    playerProfileData = updatedProfile;
    return updatedProfile;
  });

  ipcMain.handle('player:remove-completed-chore', (event, { choreId }) => {
    // Use the proper updateChoreStatus function instead of the XP workaround
    const updatedProfile = playerProfile.updateChoreStatus(playerProfileData, choreId, 'incomplete');
    playerProfile.savePlayerProfile(updatedProfile);
    playerProfileData = updatedProfile;
    return updatedProfile;
  });

  // Add handlers for rewards
  ipcMain.handle('get-available-rewards', () => {
    return playerProfileData.rewards ? playerProfileData.rewards.available : 0;
  });

  ipcMain.handle('use-reward', (event, rewardType, rewardValue) => {
    const updatedProfile = playerProfile.useReward(
      playerProfileData, 
      rewardType as RewardType, 
      rewardValue
    );
    playerProfile.savePlayerProfile(updatedProfile);
    playerProfileData = updatedProfile;
    return updatedProfile;
  });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  createWindow();

  // Check for updates after a small delay to ensure the app is fully loaded
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch((err: Error) => {
      console.error('Error checking for updates:', err);
    });
    
    // Set up recurring update checks
    setInterval(() => {
      autoUpdater.checkForUpdatesAndNotify().catch((err: Error) => {
        console.error('Error in periodic update check:', err);
      });
    }, CHECK_INTERVAL);
  }, 5000);
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

  // Check for updates when app is activated/reopened
  autoUpdater.checkForUpdatesAndNotify().catch((err: Error) => {
    console.error('Error checking for updates on app activation:', err);
  });
});

// Save player profile when app is about to quit
app.on('before-quit', () => {
  // Make sure we have the latest profile data
  refreshPlayerProfileData();
  
  // Save the profile
  playerProfile.savePlayerProfile(playerProfileData);
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.