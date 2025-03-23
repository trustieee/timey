import { app, BrowserWindow, ipcMain, nativeTheme, Menu, dialog } from 'electron';
import * as path from 'path';
import started from 'electron-squirrel-startup';
import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater';
// Import player profile functions
import * as playerProfile from './playerProfile';
import { APP_CONFIG } from './config';
import { RewardType } from './rewards';
// Import dotenv for loading environment variables
import * as dotenv from 'dotenv';
// Import our environment helper
import { setupGitHubToken } from './env';

// Load environment variables from .env file
dotenv.config();

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
// Force update configuration even in development mode
autoUpdater.forceDevUpdateConfig = true;

// Fix for missing latest.yml file
// Tell electron-updater to use GitHub's releases API more flexibly
autoUpdater.fullChangelog = true;
// Try to read releases directly rather than requiring specific files
autoUpdater.allowDowngrade = true;

// Handle GitHub token for auto-updater
if (process.env.GH_TOKEN) {
  console.log('GitHub token already set in environment variables');
} else if (process.env.GITHUB_TOKEN) {
  // If we have GITHUB_TOKEN but not GH_TOKEN, set it (electron-updater looks for GH_TOKEN)
  process.env.GH_TOKEN = process.env.GITHUB_TOKEN;
  console.log('Set GH_TOKEN from GITHUB_TOKEN');
} else {
  // In production builds where these might not be set, we can check if this 
  // is a GitHub Actions environment
  if (process.env.GITHUB_ACTIONS) {
    console.log('Running in GitHub Actions environment');
  } else {
    console.warn('No GitHub token found! Auto-updates may not work for private repositories.');
  }
}

// Setup GitHub token for auto-updater (works in both dev and production)
setupGitHubToken();

// Handle development mode updates differently
const isDev = process.env.NODE_ENV === 'development';
if (isDev) {
  console.log('Running in development mode');
  // Use the dev-app-update.yml file
  process.env.APPIMAGE = path.join(__dirname, 'dev-app-update.yml');
  
  // Log updater details
  console.log('Update config path:', autoUpdater.updateConfigPath);
  console.log('GH_TOKEN exists:', !!process.env.GH_TOKEN);
}

// Set explicit GitHub options
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'trustieee',
  repo: 'timey',
  private: true,
  releaseType: 'release'
});

// Enable debug logs
console.log('Auto-updater debugging enabled');
console.log('Current app version:', app.getVersion());

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
  console.log(`Current version: ${app.getVersion()}, New version: ${info.version}`);
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Available',
    message: `A new version (${info.version}) is available and will be installed on quit.`,
    detail: `Current version: ${app.getVersion()}`,
    buttons: ['OK']
  });
});

autoUpdater.on('update-not-available', (info: any) => {
  console.log('Update not available');
  console.log('Update info:', info);
  console.log(`Current version: ${app.getVersion()}`);
});

autoUpdater.on('error', (err: Error) => {
  console.log('Auto updater error:', err);
  console.log('Error details:', err.message);
  
  // Try to determine the specific error type
  if (err.message.includes('Bad credentials') || err.message.includes('401')) {
    console.error('GitHub authentication failed. Please check your token.');
  } else if (err.message.includes('latest.yml')) {
    console.error('Could not find release metadata. Make sure your releases include the necessary files.');
  } else if (err.message.includes('ENOTFOUND') || err.message.includes('ETIMEDOUT')) {
    console.error('Network error. Please check your internet connection.');
  }
  
  // Log detailed error object
  try {
    console.log('Detailed error:', JSON.stringify(err, null, 2));
  } catch (e) {
    console.log('Could not stringify error:', e);
  }
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
            console.log('Manual update check initiated');
            // Show dialog that we're checking for updates
            dialog.showMessageBox({
              type: 'info',
              title: 'Checking for Updates',
              message: 'Checking for updates...',
              buttons: ['OK']
            });
            
            // Force check for updates
            autoUpdater.checkForUpdates().then((checkResult) => {
              console.log('Update check result:', checkResult);
              if (!checkResult) {
                dialog.showMessageBox({
                  type: 'info',
                  title: 'No Updates Available',
                  message: `You're running the latest version (${app.getVersion()})`,
                  buttons: ['OK']
                });
              }
            }).catch((err: Error) => {
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

  // Add IPC handler for checking updates
  ipcMain.handle('check-for-updates', async () => {
    try {
      const updateInfo = await checkForUpdates();
      return {
        success: true,
        updateAvailable: updateInfo.updateAvailable,
        currentVersion: updateInfo.currentVersion,
        latestVersion: updateInfo.latestVersion || app.getVersion()
      };
    } catch (err) {
      console.error('Error checking for updates via IPC:', err);
      return {
        success: false,
        error: err.message
      };
    }
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
    console.log('Running periodic update check...');
    // Use a more robust update check method
    checkForUpdates().then((result) => {
      if (result) {
        console.log('Update check result:', result);
        if (result.updateInfo) {
          console.log('Update info:', JSON.stringify(result.updateInfo, null, 2));
        }
      } else {
        console.log('No updates available');
      }
    }).catch((err: Error) => {
      console.error('Error checking for updates:', err);
    });
    
    // Set up recurring update checks
    setInterval(() => {
      console.log('Running periodic update check...');
      // Use a more robust update check method
      checkForUpdates().then((result) => {
        if (result) {
          console.log('Update check result:', result);
          if (result.updateInfo) {
            console.log('Update info:', JSON.stringify(result.updateInfo, null, 2));
          }
        } else {
          console.log('No updates available');
        }
      }).catch((err: Error) => {
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

/**
 * Improved check for updates that handles errors better
 */
async function checkForUpdates() {
  try {
    console.log('Checking for updates...');
    console.log('Current version:', app.getVersion());
    
    const https = require('https');
    const url = 'https://api.github.com/repos/trustieee/timey/releases';
    const currentVersion = app.getVersion();
    
    // Create a promise-based version of the request
    const checkGitHubReleases = () => {
      return new Promise<any>((resolve, reject) => {
        const options = {
          headers: {
            'User-Agent': `timey/${currentVersion}`,
            'Authorization': process.env.GH_TOKEN ? `token ${process.env.GH_TOKEN}` : undefined
          }
        };
        
        const req = https.get(url, options, (res: any) => {
          let data = '';
          res.on('data', (chunk: any) => data += chunk);
          res.on('end', () => {
            if (res.statusCode === 200) {
              try {
                const releases = JSON.parse(data);
                console.log(`Found ${releases.length} releases on GitHub`);
                
                // Filter to only include non-draft, non-prerelease versions
                const productionReleases = releases.filter((release: any) => 
                  !release.draft && !release.prerelease
                );
                
                if (productionReleases.length > 0) {
                  // Sort by created date (newest first)
                  productionReleases.sort((a: any, b: any) => 
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                  );
                  
                  const latestRelease = productionReleases[0];
                  const latestVersion = latestRelease.tag_name.replace(/^v/, '');
                  
                  console.log(`Latest version: ${latestVersion}, Current version: ${currentVersion}`);
                  
                  // Compare versions (simple string comparison, could be improved)
                  const updateAvailable = latestVersion !== currentVersion;
                  
                  // Find Windows asset in the latest release
                  const windowsAsset = latestRelease.assets.find((asset: any) => 
                    asset.name.endsWith('.exe') || asset.name.includes('win')
                  );
                  
                  resolve({
                    updateAvailable,
                    currentVersion,
                    latestVersion,
                    releaseNotes: latestRelease.body,
                    downloadUrl: windowsAsset ? windowsAsset.browser_download_url : null,
                    publishDate: latestRelease.published_at
                  });
                } else {
                  console.log('No production releases found');
                  resolve({ updateAvailable: false });
                }
              } catch (e) {
                reject(new Error(`Failed to parse GitHub response: ${e.message}`));
              }
            } else {
              reject(new Error(`GitHub API returned status ${res.statusCode}: ${data}`));
            }
          });
        });
        
        req.on('error', (err: Error) => {
          reject(new Error(`GitHub API request failed: ${err.message}`));
        });
        
        req.end();
      });
    };
    
    // Check GitHub releases directly
    const releaseInfo = await checkGitHubReleases();
    
    // If there's an update available, show a notification
    if (releaseInfo.updateAvailable) {
      dialog.showMessageBox({
        type: 'info',
        title: 'Update Available',
        message: `A new version (${releaseInfo.latestVersion}) is available.`,
        detail: `Current version: ${releaseInfo.currentVersion}\n\n${releaseInfo.releaseNotes || ''}`,
        buttons: releaseInfo.downloadUrl ? ['Download', 'Later'] : ['OK'],
        cancelId: releaseInfo.downloadUrl ? 1 : 0
      }).then(result => {
        // If user clicked Download
        if (releaseInfo.downloadUrl && result.response === 0) {
          require('electron').shell.openExternal(releaseInfo.downloadUrl);
        }
      });
    } else {
      console.log('No updates available');
    }
    
    return releaseInfo;
  } catch (err) {
    console.error('Error checking for updates:', err);
    return { updateAvailable: false, error: err.message };
  }
}

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.