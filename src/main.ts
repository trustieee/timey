import { app, BrowserWindow, ipcMain, nativeTheme, Menu, dialog } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater';
// Import player profile functions
import {
  loadPlayerProfile,
  savePlayerProfile,
  addXp,
  removeXp,
  addCompletedChore,
  removeCompletedChore,
  PlayerProfile
} from './playerProfile';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Configure auto-updater
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

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

autoUpdater.on('error', (err: Error) => {
  console.error('Error in auto-updater:', err);
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
    message: 'A new version has been downloaded. Restart the application to apply the updates.',
    buttons: ['Restart', 'Later']
  }).then(result => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

// Player profile for the app session
let playerProfile: PlayerProfile = loadPlayerProfile();

const createWindow = () => {
  // Force dark mode at startup
  nativeTheme.themeSource = 'dark';

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 600,
    height: 950,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#333333', // Set dark background color to prevent flashing
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

  Menu.setApplicationMenu(null);

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

  // Also need to expose a way to get initial theme state
  ipcMain.handle('dark-mode:get', () => {
    return nativeTheme.shouldUseDarkColors;
  });

  ipcMain.handle('dark-mode:toggle', () => {
    if (nativeTheme.shouldUseDarkColors) {
      nativeTheme.themeSource = 'light';
    } else {
      nativeTheme.themeSource = 'dark';
    }
    return nativeTheme.shouldUseDarkColors;
  });

  // Player profile IPC handlers
  ipcMain.handle('player:load-profile', () => {
    return playerProfile;
  });

  ipcMain.handle('player:save-profile', (_, profileData: PlayerProfile) => {
    playerProfile = profileData;
    savePlayerProfile(playerProfile);
    return true;
  });

  ipcMain.handle('player:add-xp', (_, amount: number) => {
    playerProfile = addXp(playerProfile, amount);
    savePlayerProfile(playerProfile);
    return playerProfile;
  });

  ipcMain.handle('player:remove-xp', (_, amount: number) => {
    playerProfile = removeXp(playerProfile, amount);
    savePlayerProfile(playerProfile);
    return playerProfile;
  });

  ipcMain.handle('player:add-completed-chore', (_, { choreId, choreText }: { choreId: number; choreText: string }) => {
    playerProfile = addCompletedChore(playerProfile, choreId, choreText);
    // Add XP for completing chores - default to 10 XP per chore
    playerProfile = addXp(playerProfile, 10);
    savePlayerProfile(playerProfile);
    return playerProfile;
  });

  ipcMain.handle('player:remove-completed-chore', (_, { choreId }: { choreId: number }) => {
    playerProfile = removeCompletedChore(playerProfile, choreId);
    // Remove the XP that was awarded for this chore
    playerProfile = removeXp(playerProfile, 10);
    savePlayerProfile(playerProfile);
    return playerProfile;
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
  }, 3000);
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
app.on('before-quit', () => {
  savePlayerProfile(playerProfile);
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.