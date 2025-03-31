/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 */

import "./index.css";
import {
  ChoreStatus,
  DayProgress,
  PlayerProfile as BasePlayerProfile,
} from "./playerProfile";
import { APP_CONFIG } from "./config";
import {
  getLocalDateString,
  formatDisplayDate,
  formatClockDate,
  formatClockTime,
} from "./utils";
import { REWARDS, Reward, RewardType } from "./rewards";
import { ElectronAPI } from "./preload";

// Define app states
enum AppState {
  READY = "ready",
  PLAYING = "playing",
  COOLDOWN = "cooldown",
}

// Define chore list
interface Chore {
  id: number;
  text: string;
  status: ChoreStatus;
}

// Define renderer-specific player profile interface
interface RendererPlayerProfile extends BasePlayerProfile {
  level: number;
  xp: number;
  xpToNextLevel: number;
  completedChores: Array<{
    id: number;
    text: string;
    completedAt: string;
  }>;
  lastUpdated?: string; // Add this field to track changes
}

// Use TypeScript type assertion instead of global interface augmentation
// This provides proper typing for the electronAPI object
type ElectronAPIType = ElectronAPI;

document.addEventListener("DOMContentLoaded", async () => {
  // Get the top bar for dragging - now the entire top section is draggable
  const topBar = document.querySelector(".top-bar");

  // Get player profile UI elements
  const xpBarElement = document.getElementById("xp-bar") as HTMLElement;
  const xpTextElement = document.querySelector(".xp-text") as HTMLElement;
  const levelIndicatorElement = document.querySelector(
    ".level-indicator"
  ) as HTMLElement;

  // Display app version
  const appVersionElement = document.getElementById(
    "app-version"
  ) as HTMLElement;

  // Rewards panel elements
  const rewardsBtn = document.getElementById(
    "show-rewards"
  ) as HTMLButtonElement;
  const rewardsPanel = document.getElementById("rewards-panel") as HTMLElement;
  const rewardsContent = rewardsPanel.querySelector(
    ".rewards-content"
  ) as HTMLElement;
  const availableRewardsCount = document.getElementById(
    "available-rewards-count"
  ) as HTMLElement;

  // Player profile data
  let playerProfile: RendererPlayerProfile;

  // Store the unsubscribe function for profile updates
  let profileUpdateUnsubscribe: (() => void) | null = null;

  // Variables to track time when app is minimized
  let lastTimestamp = Date.now();

  // Track authentication status
  let isAuthenticated = false;

  // Add window focus/blur event listeners to accurately track time when minimized
  window.addEventListener("blur", () => {
    // Don't pause the timer, let it continue running
  });

  window.addEventListener("focus", () => {
    // Reset timestamp when window regains focus to prevent counting inactive time
    lastTimestamp = Date.now();
  });

  // Create an overlay element to indicate the UI is disabled when not logged in
  const authOverlay = document.createElement("div");
  authOverlay.id = "auth-overlay";
  authOverlay.className = "auth-overlay hidden";

  // Add a message to the overlay
  const overlayMessage = document.createElement("div");
  overlayMessage.className = "overlay-message";
  overlayMessage.textContent = "Please log in to use the application";
  authOverlay.appendChild(overlayMessage);

  document.body.appendChild(authOverlay);

  // Load player profile
  async function loadPlayerProfile() {
    try {
      const api = window.electronAPI as ElectronAPIType;
      const loadedProfile = await api.loadPlayerProfile();
      // Convert base profile to renderer profile
      playerProfile = {
        ...loadedProfile,
        level: calculateLevel(loadedProfile),
        xp: calculateXp(loadedProfile),
        xpToNextLevel: calculateXpToNextLevel(),
        completedChores: getCompletedChores(loadedProfile),
      };
      updateXpDisplay();

      // Set up real-time profile update listener if not already set up
      setupProfileUpdateListener();
    } catch (error) {
      console.error("Error loading player profile:", error);
      // Set default values if profile can't be loaded
      playerProfile = {
        level: 1,
        xp: 0,
        xpToNextLevel: APP_CONFIG.PROFILE.XP_PER_LEVEL,
        history: {},
        completedChores: [],
        rewards: {
          available: 0,
          permanent: {},
        },
      };
    }
  }

  // Helper functions to calculate profile properties
  function calculateLevel(profile: BasePlayerProfile): number {
    let totalXp = 0;

    // Sum up the final XP from all days in history
    Object.values(profile.history || {}).forEach((day) => {
      if (day.xp && day.xp.final > 0) {
        totalXp += day.xp.final;
      }
    });

    // Calculate level based on XP using a simple division
    const level = Math.floor(totalXp / APP_CONFIG.PROFILE.XP_PER_LEVEL) + 1;
    return level;
  }

  function calculateXp(profile: BasePlayerProfile): number {
    let totalXp = 0;

    // Sum up the final XP from all days in history
    Object.values(profile.history || {}).forEach((day) => {
      if (day.xp && day.xp.final > 0) {
        totalXp += day.xp.final;
      }
    });

    // Calculate remaining XP for current level using modulo
    return totalXp % APP_CONFIG.PROFILE.XP_PER_LEVEL;
  }

  function calculateXpToNextLevel(): number {
    // Simply return the constant XP value
    return APP_CONFIG.PROFILE.XP_PER_LEVEL;
  }

  function getCompletedChores(
    profile: BasePlayerProfile
  ): Array<{ id: number; text: string; completedAt: string }> {
    const completedChores: Array<{
      id: number;
      text: string;
      completedAt: string;
    }> = [];
    for (const date in profile.history) {
      const dayProgress = profile.history[date];
      for (const chore of dayProgress.chores) {
        if (chore.status === "completed" && chore.completedAt) {
          completedChores.push({
            id: chore.id,
            text: chore.text,
            completedAt: chore.completedAt,
          });
        }
      }
    }
    return completedChores;
  }

  // Update XP display
  function updateXpDisplay() {
    if (!playerProfile) return;

    const xpPercentage = Math.min(
      100,
      Math.floor((playerProfile.xp / playerProfile.xpToNextLevel) * 100)
    );

    // Update XP bar width
    xpBarElement.style.width = `${xpPercentage}%`;

    // Update XP text
    xpTextElement.textContent = `${playerProfile.xp}/${playerProfile.xpToNextLevel} XP`;

    // Update level indicator
    levelIndicatorElement.textContent = `Level ${playerProfile.level}`;
  }

  // Set up real-time listener for profile updates
  function setupProfileUpdateListener() {
    // Clean up any existing listener first
    if (profileUpdateUnsubscribe) {
      profileUpdateUnsubscribe();
      profileUpdateUnsubscribe = null;
    }

    // Set up a new listener
    const api = window.electronAPI as ElectronAPIType;
    profileUpdateUnsubscribe = api.onProfileUpdate(
      (updatedProfile: BasePlayerProfile) => {
        console.log("Real-time profile update received");

        // Update the renderer profile with the new data
        const convertedProfile = {
          ...updatedProfile,
          level: calculateLevel(updatedProfile),
          xp: calculateXp(updatedProfile),
          xpToNextLevel: calculateXpToNextLevel(),
          completedChores: getCompletedChores(updatedProfile),
        };

        // Store the updated profile
        playerProfile = convertedProfile;

        // Update UI elements
        updateXpDisplay();

        // Reload today's chores and re-render
        loadTodayChores().then(() => {
          renderChores();
        });

        // Update rewards display
        renderRewards();

        // Apply any permanent bonuses
        applyPermanentBonuses();

        console.log("Profile and UI updated from real-time update");
      }
    );
  }

  // Load player profile at startup
  await loadPlayerProfile();

  if (topBar) {
    let isDragging = false;
    let startMouseX = 0;
    let startMouseY = 0;

    topBar.addEventListener("mousedown", (e: MouseEvent) => {
      isDragging = true;
      startMouseX = e.clientX;
      startMouseY = e.clientY;
    });

    document.addEventListener("mousemove", (e: MouseEvent) => {
      if (isDragging) {
        const deltaX = e.clientX - startMouseX;
        const deltaY = e.clientY - startMouseY;

        const api = window.electronAPI as ElectronAPIType;
        api.windowMove(deltaX, deltaY);

        startMouseX = e.clientX;
        startMouseY = e.clientY;
      }
    });

    document.addEventListener("mouseup", () => {
      isDragging = false;
    });
  }

  // Always use dark mode
  document.documentElement.classList.add("dark-mode");

  // Display app version
  if (appVersionElement) {
    try {
      const api = window.electronAPI as ElectronAPIType;
      const version = await api.getAppVersion();
      appVersionElement.textContent = `v${version}`;
    } catch (error) {
      console.error("Error getting app version:", error);
      appVersionElement.textContent = "v?.?.?";
    }
  }

  // Track the current day to detect date changes
  let currentDay = new Date().getDate();

  function updateClock(): void {
    const topDateTimeElement = document.getElementById("top-date-time");
    if (!topDateTimeElement) return;

    const now = new Date();

    // Check if the day has changed (midnight passed)
    if (now.getDate() !== currentDay) {
      console.log("Day changed! Refreshing profile...");
      currentDay = now.getDate();
      // Immediately reload the profile to handle the date change
      reloadProfile();
    }

    // Format using utility functions to ensure consistency
    const dateStr = formatClockDate(now);
    const timeStr = formatClockTime(now);

    // Combine date and time
    topDateTimeElement.textContent = `${dateStr} ${timeStr}`;
  }

  // Update the clock immediately
  updateClock();

  // Then update it every second
  setInterval(updateClock, 1000);

  // Timer Application Code
  // ----------------------

  // Get UI elements
  const timerDisplay = document.getElementById("timer-display") as HTMLElement;
  const startTimerBtn = document.getElementById(
    "start-timer"
  ) as HTMLButtonElement;
  const pauseTimerBtn = document.getElementById(
    "pause-timer"
  ) as HTMLButtonElement;
  const resetAfterChoresBtn = document.getElementById(
    "reset-after-chores"
  ) as HTMLButtonElement;
  const currentStateElement = document.getElementById(
    "current-state"
  ) as HTMLElement;
  const choresSection = document.getElementById(
    "chores-section"
  ) as HTMLElement;
  const choresList = document.getElementById("chores-list") as HTMLElement;
  const completionMessage = document.getElementById(
    "completion-message"
  ) as HTMLElement;
  const historyBtn = document.getElementById(
    "show-history"
  ) as HTMLButtonElement;

  // Timer variables - use config values
  let timerInterval: number | null = null;
  let timeLeft = APP_CONFIG.TIMER.PLAY_TIME_MINUTES * 60; // in seconds (will be updated with permanent bonus after profile loads)
  let chores: Chore[] = []; // Will be populated from profile chores or defaults
  let currentState: AppState = AppState.READY;
  let isPaused = false;

  // Reset chores to uncompleted state - only used for new days
  function resetChores(): void {
    // Use custom chores from profile if available, otherwise fall back to default chores
    const choreSource = playerProfile?.chores || APP_CONFIG.CHORES;

    chores = choreSource.map((chore) => ({
      id: chore.id,
      text: chore.text,
      status: "incomplete" as ChoreStatus,
    }));
  }

  // Load or initialize today's chores
  async function loadTodayChores(): Promise<void> {
    try {
      const today = getLocalDateString();
      const todayProgress = playerProfile.history[today];

      if (todayProgress && todayProgress.chores) {
        // Use today's existing progress
        chores = todayProgress.chores.map((chore) => ({
          id: chore.id,
          text: chore.text,
          status: chore.status as ChoreStatus,
        }));
      } else {
        // Initialize new day with default incomplete status
        resetChores();

        // Create a proper day progress object in the history
        if (!playerProfile.history[today]) {
          // Initialize with all required DayProgress properties
          playerProfile.history[today] = {
            date: today,
            chores: [],
            playTime: {
              sessions: [],
            },
            xp: {
              gained: 0,
              penalties: 0,
              final: 0,
            },
            completed: false,
          };

          // Then update it with the current chores
          playerProfile.history[today].chores = chores.map((chore) => ({
            id: chore.id,
            text: chore.text,
            status: chore.status,
          }));

          // Save the updated profile
          await window.electronAPI.savePlayerProfile(playerProfile);
        }
      }
    } catch (error) {
      console.error("Error loading today's chores:", error);
      resetChores();
    }
  }

  // Function to update app state
  function updateAppState(newState: AppState): void {
    currentState = newState;
    currentStateElement.textContent = getStateDisplayName(newState);
    currentStateElement.className = "state-badge " + newState;

    // Update UI based on state
    switch (newState) {
      case AppState.READY: {
        startTimerBtn.disabled = false;
        pauseTimerBtn.disabled = true;
        choresSection.classList.add("hidden");

        // Apply permanent play time bonus
        const basePlayTime = APP_CONFIG.TIMER.PLAY_TIME_MINUTES;
        const permanentPlayBonus = getPermanentPlayTimeBonus();
        timeLeft = (basePlayTime + permanentPlayBonus) * 60;

        isPaused = false;
        updatePauseButtonText();
        updateTimerDisplay();
        break;
      }

      case AppState.PLAYING: {
        startTimerBtn.disabled = true;
        pauseTimerBtn.disabled = false;
        choresSection.classList.add("hidden");
        break;
      }

      case AppState.COOLDOWN: {
        startTimerBtn.disabled = true;
        pauseTimerBtn.disabled = true;
        resetAfterChoresBtn.disabled = true;
        choresSection.classList.remove("hidden");

        // Apply permanent cooldown reduction
        const baseCooldown = APP_CONFIG.TIMER.COOLDOWN_TIME_MINUTES;
        const permanentCooldownReduction = getPermanentCooldownReduction();
        const effectiveCooldown = Math.max(
          0,
          baseCooldown - permanentCooldownReduction
        );
        timeLeft = effectiveCooldown * 60;

        console.log(
          `Applied cooldown reduction: Base ${baseCooldown} - Permanent ${permanentCooldownReduction} = ${effectiveCooldown} minutes`
        );

        isPaused = false;
        updatePauseButtonText();
        loadTodayChores().then(() => {
          renderChores();
        });

        // If the cooldown time is already 0 after reduction, skip cooldown period
        if (timeLeft <= 0) {
          stopTimer(false); // Not a play session ending, this is a cooldown
          showNotification(
            "Cooldown Skipped",
            "Thanks to your rewards, you can start playing immediately!"
          );
          updateAppState(AppState.READY);
        }

        break;
      }
    }
  }

  // Update the pause button text based on pause state
  function updatePauseButtonText(): void {
    pauseTimerBtn.textContent = isPaused ? "Resume" : "Pause";
  }

  // Helper to get user-friendly state name
  function getStateDisplayName(state: AppState): string {
    switch (state) {
      case AppState.READY:
        return "Ready to Play";
      case AppState.PLAYING:
        return isPaused ? "Paused" : "Playing Time";
      case AppState.COOLDOWN:
        return "Daily Objectives Time";
      default:
        return "Unknown State";
    }
  }

  // Format time as HH:MM:SS
  function formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return [
      hours.toString().padStart(2, "0"),
      minutes.toString().padStart(2, "0"),
      secs.toString().padStart(2, "0"),
    ].join(":");
  }

  // Update timer display
  function updateTimerDisplay(): void {
    timerDisplay.textContent = formatTime(timeLeft);
  }

  // Start the timer
  async function startTimer(): Promise<void> {
    try {
      if (currentState === AppState.READY) {
        // Start a new play session in the profile
        await window.electronAPI.startPlaySession();

        currentState = AppState.PLAYING;
        updateAppState(AppState.PLAYING);
        // Start play time
        if (timerInterval) {
          clearInterval(timerInterval);
        }

        lastTimestamp = Date.now(); // Reset timestamp when starting timer

        timerInterval = window.setInterval(() => {
          if (!isPaused) {
            const now = Date.now();
            const elapsed = Math.floor((now - lastTimestamp) / 1000);
            lastTimestamp = now;

            // Ensure we decrement by at least 1 second, but also account for longer gaps
            const decrementAmount = Math.max(1, elapsed);
            timeLeft = Math.max(0, timeLeft - decrementAmount);
            updateTimerDisplay();

            if (timeLeft <= 0) {
              stopTimer(true); // true indicates end of play session
              playNotificationSound();
              showNotification();
              updateAppState(AppState.COOLDOWN);
              startCooldownTimer(); // Start cooldown timer when play time ends
            }
          }
        }, 1000);
      } else {
        console.warn(`Cannot start timer from state: ${currentState}`);
      }
    } catch (error) {
      console.error("Error starting timer:", error);
      resetAppState();
    }
  }

  // Start the cooldown timer
  function startCooldownTimer(): void {
    if (timerInterval) {
      clearInterval(timerInterval);
    }

    lastTimestamp = Date.now(); // Reset timestamp when starting cooldown timer

    timerInterval = window.setInterval(() => {
      if (!isPaused) {
        const now = Date.now();
        const elapsed = Math.floor((now - lastTimestamp) / 1000);
        lastTimestamp = now;

        // Ensure we decrement by at least 1 second, but also account for longer gaps
        const decrementAmount = Math.max(1, elapsed);
        timeLeft = Math.max(0, timeLeft - decrementAmount);
        updateTimerDisplay();
        updateResetButtonState(); // Update button state every tick

        if (timeLeft <= 0) {
          stopTimer(false); // false indicates not a play session ending
          playNotificationSound();
          showNotification(
            "Cooldown Complete",
            "Your cooldown period is over! Complete your daily objectives to start playing again."
          );
          updateResetButtonState(); // Update one final time when timer hits 0
        }
      }
    }, 1000);
  }

  // Stop the timer
  async function stopTimer(isPlaySessionEnding = false): Promise<void> {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    // If this is a play session ending (not a cooldown or other timer)
    if (isPlaySessionEnding && currentState === AppState.PLAYING) {
      // End the play session in the profile
      await window.electronAPI.endPlaySession();
    }
  }

  // Pause or resume the timer
  function pauseResumeTimer(): void {
    isPaused = !isPaused;

    // When resuming, reset the timestamp to prevent counting pause time as elapsed
    if (!isPaused) {
      lastTimestamp = Date.now();
    }

    // Update the backend with pause status
    if (currentState === AppState.PLAYING) {
      window.electronAPI.toggleSessionPause().catch((error) => {
        console.error("Error updating pause status:", error);
      });
    }

    updatePauseButtonText();
    currentStateElement.textContent = getStateDisplayName(currentState);
  }

  // Render chores list
  function renderChores(): void {
    // Clear existing chores
    choresList.innerHTML = "";

    // Add each chore
    chores.forEach((chore) => {
      const choreItem = document.createElement("div");
      choreItem.className = `chore-item ${chore.status}`;
      choreItem.dataset.id = chore.id.toString();

      // Create status toggle button
      const statusBtn = document.createElement("button");
      statusBtn.className = "chore-status-btn";
      statusBtn.innerHTML = getStatusIcon(chore.status);
      statusBtn.addEventListener("click", () => {
        cycleChoreStatus(chore.id);
      });

      const label = document.createElement("span");
      label.textContent = chore.text;

      choreItem.appendChild(statusBtn);
      choreItem.appendChild(label);
      choresList.appendChild(choreItem);
    });

    // Check if all chores are completed or N/A
    checkAllChoresCompleted();
  }

  // Get icon for chore status
  function getStatusIcon(status: ChoreStatus): string {
    switch (status) {
      case "completed":
        return "✓";
      case "na":
        return "N/A";
      case "incomplete":
        return "✗";
      default:
        return "✗"; // Default to incomplete
    }
  }

  // Cycle through chore statuses
  function cycleChoreStatus(id: number): void {
    const chore = chores.find((c) => c.id === id);
    if (!chore) return;

    // Cycle through states: incomplete -> completed -> na -> incomplete
    const nextStatus: { [key in ChoreStatus]: ChoreStatus } = {
      incomplete: "completed",
      completed: "na",
      na: "incomplete",
    };

    const oldStatus = chore.status;
    const newStatus = nextStatus[oldStatus];

    // Update chore status locally
    chore.status = newStatus;

    // First update chore status on the server to handle XP changes
    window.electronAPI
      .updateChoreStatus(id, newStatus)
      .then(() => {
        // Reload the entire profile to ensure consistency
        reloadProfile().then(() => {
          // Re-render chores in the main list
          renderChores();

          // Re-render the history panel if it's visible
          if (historyPanel.classList.contains("visible")) {
            renderHistory();
          }
        });
      })
      .catch((err) => {
        console.error("Error updating chore status:", err);
        // Revert the local status change in case of error
        chore.status = oldStatus;
        renderChores();
      });
  }

  // Check if all chores are completed or N/A
  function checkAllChoresCompleted(): void {
    // Always show completion message, but with different text based on completion
    completionMessage.classList.remove("hidden");
    updateResetButtonState();
  }

  // Update the reset button state and completion message
  function updateResetButtonState(): void {
    const allChoresCompleted = chores.every(
      (chore) => chore.status === "completed" || chore.status === "na"
    );

    // Only enable the reset button if cooldown timer is done
    resetAfterChoresBtn.disabled = timeLeft > 0;

    // Update the completion message text based on state
    const messageElement = completionMessage.querySelector("p");
    if (!messageElement) return;

    if (timeLeft > 0) {
      messageElement.textContent = `Cooldown time remaining. Complete your daily objectives while you wait!`;
    } else if (allChoresCompleted) {
      messageElement.textContent = `Great job completing your daily objectives! You can start play time now.`;
    } else {
      const incompleteCount = chores.filter(
        (chore) => chore.status === "incomplete"
      ).length;

      messageElement.textContent = `You have ${incompleteCount} incomplete ${
        incompleteCount === 1 ? "daily objective" : "daily objectives"
      }. Remember: -10 XP per incomplete daily objective at the end of the day!`;
    }
    completionMessage.classList.remove("hidden");
  }

  // Event Listeners
  startTimerBtn.addEventListener("click", startTimer);
  pauseTimerBtn.addEventListener("click", pauseResumeTimer);
  resetAfterChoresBtn.addEventListener("click", () => {
    // Only allow starting play time if cooldown is done
    if (timeLeft <= 0) {
      updateAppState(AppState.READY);
    }
  });

  // Function to update UI element states based on authentication status
  function updateUIBasedOnAuthStatus(): void {
    // Get all interactive elements
    const interactiveElements = [
      startTimerBtn,
      pauseTimerBtn,
      resetAfterChoresBtn,
      rewardsBtn,
      historyBtn,
    ];

    if (isAuthenticated) {
      // Enable all interactive elements
      interactiveElements.forEach((element) => {
        if (element) {
          element.disabled = false;
        }
      });

      // Show profile info
      if (xpBarElement) xpBarElement.style.opacity = "1";
      if (xpTextElement) xpTextElement.style.opacity = "1";
      if (levelIndicatorElement) levelIndicatorElement.style.opacity = "1";

      // Update timer buttons based on current state
      updateAppState(currentState);

      // Hide the overlay
      authOverlay.classList.add("hidden");
    } else {
      // Disable all interactive elements
      interactiveElements.forEach((element) => {
        if (element) {
          element.disabled = true;
        }
      });

      // Hide profile info
      if (xpBarElement) xpBarElement.style.opacity = "0.5";
      if (xpTextElement) xpTextElement.style.opacity = "0.5";
      if (levelIndicatorElement) levelIndicatorElement.style.opacity = "0.5";

      // Hide chores section
      if (choresSection) choresSection.classList.add("hidden");

      // Hide history and rewards panels
      if (historyPanel) historyPanel.classList.remove("visible");
      if (rewardsPanel) rewardsPanel.classList.remove("visible");

      // Force login panel to be visible
      if (loginPanel) {
        loginPanel.classList.add("visible");
        loginPanel.style.zIndex = "1000"; // Ensure it's on top of other elements

        // Clear any previous error messages
        if (loginErrorMsg) {
          loginErrorMsg.style.display = "none";
          loginErrorMsg.textContent = "";
        }
      }

      // Show the overlay
      authOverlay.classList.remove("hidden");
    }
  }

  // Initialize the app
  async function initializeApp(): Promise<void> {
    // Check auth status first
    await checkAuthStatus();

    await reloadProfile();

    // Apply permanent play time bonus to the timer
    applyPermanentBonuses();

    updateAppState(AppState.READY);
    updateTimerDisplay();

    // Set up a regular profile refresh to handle day changes
    setInterval(() => {
      reloadProfile();
    }, APP_CONFIG.PROFILE_REFRESH_INTERVAL);
  }

  // Function to apply permanent bonuses from rewards
  function applyPermanentBonuses(): void {
    // Calculate effective play time with permanent bonus
    const basePlayTime = APP_CONFIG.TIMER.PLAY_TIME_MINUTES;
    const permanentBonus = getPermanentPlayTimeBonus();

    // Only update timer if in READY state
    if (currentState === AppState.READY) {
      timeLeft = (basePlayTime + permanentBonus) * 60;
      updateTimerDisplay();
    }
  }

  // Get permanent play time bonus from profile
  function getPermanentPlayTimeBonus(): number {
    if (
      !playerProfile?.rewards?.permanent ||
      !playerProfile.rewards.permanent[RewardType.EXTEND_PLAY_TIME]
    ) {
      return 0;
    }
    return playerProfile.rewards.permanent[RewardType.EXTEND_PLAY_TIME];
  }

  // Get permanent cooldown reduction from profile
  function getPermanentCooldownReduction(): number {
    if (
      !playerProfile?.rewards?.permanent ||
      !playerProfile.rewards.permanent[RewardType.REDUCE_COOLDOWN]
    ) {
      return 0;
    }
    return playerProfile.rewards.permanent[RewardType.REDUCE_COOLDOWN];
  }

  // Start app initialization
  async function initApp() {
    await initializeApp();
  }

  // Initialize the app
  initApp().catch(console.error);

  // History panel functionality
  const historyPanel = document.getElementById("history-panel") as HTMLElement;
  const historyContent = historyPanel.querySelector(
    ".history-content"
  ) as HTMLElement;

  function toggleHistoryPanel(e: MouseEvent): void {
    e.stopPropagation(); // Prevent event from bubbling up
    historyPanel.classList.toggle("visible");

    // Hide rewards panel if it's open
    if (rewardsPanel.classList.contains("visible")) {
      rewardsPanel.classList.remove("visible");
    }

    // Hide login panel if it's open and user is authenticated
    if (isAuthenticated && loginPanel.classList.contains("visible")) {
      loginPanel.classList.remove("visible");
    }

    if (historyPanel.classList.contains("visible")) {
      // Refresh player profile before rendering history
      loadPlayerProfile().then(() => {
        renderHistory();
      });
    }
  }

  function renderHistory(): void {
    historyContent.innerHTML = "";

    // Get dates in reverse chronological order
    const dates = Object.keys(playerProfile.history).sort().reverse();
    const today = getLocalDateString(); // Get today's date to identify current day's chores

    dates.forEach((date) => {
      const dayHistory = playerProfile.history[date];
      if (!dayHistory || !dayHistory.chores || dayHistory.chores.length === 0)
        return;

      const dateSection = document.createElement("div");
      dateSection.className = "history-date";

      // Use the utility function to format the date consistently
      const formattedDate = formatDisplayDate(date);

      // Create heading element with date
      const headingEl = document.createElement("h3");
      headingEl.textContent = formattedDate;

      // Add XP gains and penalties if they exist
      if (dayHistory.xp) {
        const xpContainer = document.createElement("span");
        xpContainer.className = "xp-summary";

        // Show positive XP if any was gained
        if (dayHistory.xp.gained > 0) {
          const xpGained = document.createElement("span");
          xpGained.className = "xp-gained";
          xpGained.textContent = `+${dayHistory.xp.gained}`;
          xpContainer.appendChild(xpGained);
        }

        // Show negative XP if any penalties were applied
        if (dayHistory.xp.penalties > 0) {
          // Add a space if we already added the gained XP
          if (dayHistory.xp.gained > 0) {
            xpContainer.appendChild(document.createTextNode(" "));
          }

          const xpPenalty = document.createElement("span");
          xpPenalty.className = "xp-penalty";
          xpPenalty.textContent = `-${dayHistory.xp.penalties}`;
          xpContainer.appendChild(xpPenalty);
        }

        // If we added any XP information, append it to the heading
        if (dayHistory.xp.gained > 0 || dayHistory.xp.penalties > 0) {
          headingEl.appendChild(xpContainer);
        }
      }

      dateSection.appendChild(headingEl);

      // Add chores for this date
      dayHistory.chores.forEach((chore) => {
        const choreElement = document.createElement("div");
        choreElement.className = "history-chore";

        const isCurrentDay = date === today;
        const statusIcon = getStatusIcon(chore.status as ChoreStatus);

        // Create status element
        const statusElement = document.createElement("div");
        statusElement.className = `status ${chore.status}`;

        // Set text content instead of innerHTML for better display control
        statusElement.textContent = statusIcon;

        // Add a cursor and hover effect for today's chores to indicate they're clickable
        if (isCurrentDay) {
          statusElement.classList.add("clickable");

          // Add click handler to cycle status for today's chores
          statusElement.addEventListener("click", () => {
            cycleChoreStatus(chore.id);
          });
        }

        const textElement = document.createElement("span");
        textElement.textContent = chore.text;

        // Append child elements
        choreElement.appendChild(statusElement);
        choreElement.appendChild(textElement);

        dateSection.appendChild(choreElement);
      });

      historyContent.appendChild(dateSection);
    });

    if (dates.length === 0) {
      historyContent.innerHTML =
        '<p style="text-align: center; padding: 20px;">No history available yet.</p>';
    }
  }

  // Add event listener for history button
  historyBtn.addEventListener("click", toggleHistoryPanel);

  // Close history panel when clicking outside
  document.addEventListener("click", (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      !historyPanel.contains(target) &&
      !historyBtn.contains(target) &&
      historyPanel.classList.contains("visible")
    ) {
      historyPanel.classList.remove("visible");
    }

    if (
      !rewardsPanel.contains(target) &&
      !rewardsBtn.contains(target) &&
      rewardsPanel.classList.contains("visible")
    ) {
      rewardsPanel.classList.remove("visible");
    }

    // Only close the login panel if user is authenticated
    if (
      isAuthenticated &&
      !loginPanel.contains(target) &&
      !loginBtn.contains(target) &&
      loginPanel.classList.contains("visible")
    ) {
      loginPanel.classList.remove("visible");
    }
  });

  // Prevent clicks inside the history panel from closing it
  historyPanel.addEventListener("click", (e: MouseEvent) => {
    e.stopPropagation();
  });

  // Rewards panel functionality
  function toggleRewardsPanel(e: MouseEvent): void {
    e.stopPropagation(); // Prevent event from bubbling up

    // Only allow toggling rewards panel if authenticated
    if (isAuthenticated) {
      rewardsPanel.classList.toggle("visible");

      // Hide history panel if it's open
      if (historyPanel.classList.contains("visible")) {
        historyPanel.classList.remove("visible");
      }

      // Hide login panel if it's open and user is authenticated
      if (loginPanel.classList.contains("visible")) {
        loginPanel.classList.remove("visible");
      }

      if (rewardsPanel.classList.contains("visible")) {
        // Refresh player profile before rendering rewards
        loadPlayerProfile().then(() => {
          renderRewards();
        });
      }
    } else {
      // If not authenticated, ensure login panel is visible
      loginPanel.classList.add("visible");
    }
  }

  async function renderRewards(): Promise<void> {
    rewardsContent.innerHTML = "";

    // Get available rewards from player profile
    const availableRewards = playerProfile.rewards
      ? playerProfile.rewards.available
      : 0;
    availableRewardsCount.textContent = availableRewards.toString();

    // Create reward items
    REWARDS.forEach((reward) => {
      const rewardElement = document.createElement("div");
      rewardElement.className = `reward-item${
        availableRewards === 0 ? " disabled" : ""
      }`;

      rewardElement.innerHTML = `
                <h3>${reward.name}</h3>
                <p>${reward.description}</p>
            `;

      // Add click handler if rewards are available
      if (availableRewards > 0) {
        rewardElement.addEventListener("click", () => {
          useReward(reward);
        });
      }

      rewardsContent.appendChild(rewardElement);
    });

    // Show history of used rewards
    const rewardHistory = document.createElement("div");
    rewardHistory.className = "reward-history";
    rewardHistory.innerHTML = "<h3>Reward History</h3>";

    let hasHistory = false;

    // Gather all reward usages from all days
    const dates = Object.keys(playerProfile.history).sort().reverse();

    dates.forEach((date) => {
      const dayHistory = playerProfile.history[date];
      if (
        !dayHistory ||
        !dayHistory.rewardsUsed ||
        dayHistory.rewardsUsed.length === 0
      )
        return;

      hasHistory = true;

      dayHistory.rewardsUsed.forEach((usedReward) => {
        const reward = REWARDS.find((r) => r.id === usedReward.type);
        if (!reward) return;

        const historyElement = document.createElement("div");
        historyElement.className = "reward-history-item";

        // Format date for display
        const formattedDate = formatDisplayDate(date);

        historyElement.innerHTML = `
                    <div>${reward.name}: ${reward.description}</div>
                    <div class="date">${formattedDate}</div>
                `;

        rewardHistory.appendChild(historyElement);
      });
    });

    if (hasHistory) {
      rewardsContent.appendChild(rewardHistory);
    } else {
      const noHistoryElement = document.createElement("div");
      noHistoryElement.className = "reward-history";
      noHistoryElement.innerHTML =
        "<h3>Reward History</h3><p>No rewards used yet.</p>";
      rewardsContent.appendChild(noHistoryElement);
    }
  }

  // Function to use a reward
  async function useReward(reward: Reward): Promise<void> {
    try {
      // Check if player has available rewards
      if (!playerProfile.rewards || playerProfile.rewards.available <= 0) {
        alert("No rewards available to use!");
        return;
      }

      // Confirm the reward usage
      const confirmed = confirm(
        `Are you sure you want to use the "${reward.name}" reward?\n\n${reward.description}`
      );
      if (!confirmed) return;

      // Use the reward
      const baseProfile = await window.electronAPI.useReward(
        reward.id,
        reward.value
      );
      // Convert base profile to renderer profile
      playerProfile = {
        ...baseProfile,
        level: calculateLevel(baseProfile),
        xp: calculateXp(baseProfile),
        xpToNextLevel: calculateXpToNextLevel(),
        completedChores: getCompletedChores(baseProfile),
      };

      // Apply reward effect
      if (reward.id === RewardType.EXTEND_PLAY_TIME) {
        // Get updated permanent bonus
        const permanentBonus = getPermanentPlayTimeBonus();

        // If we're already playing, add time to the current timer
        if (currentState === AppState.PLAYING) {
          timeLeft += reward.value * 60; // Convert to seconds
          updateTimerDisplay();
        } else {
          // If in READY state, update the timer with base + permanent bonus
          if (currentState === AppState.READY) {
            const basePlayTime = APP_CONFIG.TIMER.PLAY_TIME_MINUTES;
            timeLeft = (basePlayTime + permanentBonus) * 60;
            updateTimerDisplay();
          }
        }
        showNotification(
          "Reward Used",
          `Added ${reward.value} minutes to play time permanently!`
        );
      } else if (reward.id === RewardType.REDUCE_COOLDOWN) {
        // If in cooldown, reduce time
        if (currentState === AppState.COOLDOWN) {
          // Apply the immediate reduction from the reward
          timeLeft = Math.max(0, timeLeft - reward.value * 60); // Convert to seconds
          updateTimerDisplay();

          // Check if cooldown is now complete
          if (timeLeft <= 0) {
            stopTimer(false); // Not a play session ending, this is a cooldown
            showNotification(
              "Cooldown Complete",
              "Your cooldown time is over! You may start playing again."
            );
            updateResetButtonState();
          }
        }
        showNotification(
          "Reward Used",
          `Reduced cooldown time by ${reward.value} minutes permanently!`
        );
      }

      // Refresh UI
      renderRewards();
      updateXpDisplay();
    } catch (error) {
      console.error("Error using reward:", error);
      alert("Error using reward. Please try again.");
    }
  }

  // Add event listener for rewards button
  rewardsBtn.addEventListener("click", toggleRewardsPanel);

  // Prevent clicks inside the rewards panel from closing it
  rewardsPanel.addEventListener("click", (e: MouseEvent) => {
    e.stopPropagation();
  });

  // Login panel functionality
  const loginBtn = document.getElementById("show-login") as HTMLButtonElement;
  const loginPanel = document.getElementById("login-panel") as HTMLElement;

  // Check for saved credentials function - simplified
  async function checkForSavedEmail() {
    try {
      const api = window.electronAPI as ElectronAPIType;
      if (api.checkSavedCredentials) {
        const savedCredentials = await api.checkSavedCredentials();

        if (
          savedCredentials &&
          savedCredentials.hasSavedCredentials &&
          savedCredentials.email
        ) {
          // Pre-fill the email field
          emailInput.value = savedCredentials.email;
          // Focus on password field for convenience
          passwordInput.focus();
        }
      }
    } catch (error) {
      console.error("Error checking saved credentials:", error);
    }
  }

  // Authentication status check - maintain original pattern
  async function checkAuthStatus() {
    try {
      const api = window.electronAPI as ElectronAPIType;
      const status = await api.getAuthStatus();

      // First check if they're authenticated at all
      if (!status.isAuthenticated) {
        isAuthenticated = false;
        updateLoginButtonState(); // Update button state
        updateUIBasedOnAuthStatus(); // Disable UI elements

        // Check for saved credentials to prefill login form
        await checkForSavedEmail();

        loginPanel.classList.add("visible");
        return false;
      }

      // Then load the profile with retry logic
      let hasChores = false;
      let retryCount = 0;
      const maxRetries = 3;

      while (!hasChores && retryCount < maxRetries) {
        // Reload the profile from server
        await reloadProfile();

        // Check if the user has any chores set up
        hasChores = playerProfile.chores && playerProfile.chores.length > 0;

        if (!hasChores) {
          console.log(
            `Profile loaded but no chores found, retry ${
              retryCount + 1
            }/${maxRetries}`
          );
          retryCount++;

          if (retryCount < maxRetries) {
            // Wait a bit before retrying
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      }

      if (!hasChores) {
        // No chores found after retries - user is not fully authenticated
        isAuthenticated = false;
        updateLoginButtonState(); // Update button state
        updateUIBasedOnAuthStatus(); // Disable UI elements

        // Display login panel with error message
        loginPanel.classList.add("visible");

        // Show error message
        loginErrorMsg.textContent =
          "You cannot use the app until chores are set up for your profile. Please contact your administrator to set up chores and then restart the app.";
        loginErrorMsg.style.display = "block";

        return false;
      }

      // If we get here, user is authenticated and has chores
      isAuthenticated = true;
      updateLoginButtonState(); // Update button state
      updateUIBasedOnAuthStatus(); // Enable UI elements
      return true;
    } catch (error) {
      console.error("Failed to check auth status:", error);
      isAuthenticated = false;
      updateUIBasedOnAuthStatus(); // Disable UI elements
      loginPanel.classList.add("visible");
      return false;
    }
  }

  function toggleLoginPanel(e: MouseEvent): void {
    e.stopPropagation(); // Prevent event from bubbling up

    // Clear any previous error messages when toggling
    if (!loginPanel.classList.contains("visible")) {
      loginErrorMsg.style.display = "none";
      loginErrorMsg.textContent = "";
    }

    // Update button text based on authentication status
    updateLoginButtonState();

    // Always ensure button is enabled when panel is opened
    signInButton.disabled = false;

    // If authenticated, toggle panel normally
    if (isAuthenticated) {
      loginPanel.classList.toggle("visible");

      // Hide other panels if they're open
      if (historyPanel.classList.contains("visible")) {
        historyPanel.classList.remove("visible");
      }

      if (rewardsPanel.classList.contains("visible")) {
        rewardsPanel.classList.remove("visible");
      }
    } else {
      // If not authenticated, force panel to stay open and bring to front
      loginPanel.classList.add("visible");
      loginPanel.style.zIndex = "1000"; // Ensure it's on top of other elements

      // Focus on email input if empty, otherwise password
      if (!emailInput.value.trim()) {
        emailInput.focus();
      } else {
        passwordInput.focus();
      }
    }
  }

  // Function to update login button state based on authentication
  function updateLoginButtonState() {
    if (isAuthenticated) {
      signInButton.textContent = "Logout";
      emailInput.disabled = true;
      passwordInput.disabled = true;
    } else {
      signInButton.textContent = "Sign In";
      emailInput.disabled = false;
      passwordInput.disabled = false;
    }

    // Always make sure button is enabled
    signInButton.disabled = false;
  }

  // Add event listener for login button
  loginBtn.addEventListener("click", toggleLoginPanel);

  // Prevent clicks inside the login panel from closing it
  loginPanel.addEventListener("click", (e: MouseEvent) => {
    e.stopPropagation();
  });

  // Modify the document click event to respect authentication state
  document.addEventListener("click", (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    // Only close the login panel on outside click if user is authenticated
    if (
      isAuthenticated &&
      !loginPanel.contains(target) &&
      !loginBtn.contains(target) &&
      loginPanel.classList.contains("visible")
    ) {
      loginPanel.classList.remove("visible");
    }
  });

  // Modify sign-in button click handler to update authentication state
  const signInButton = document.getElementById(
    "sign-in-button"
  ) as HTMLButtonElement;
  const emailInput = document.getElementById("email") as HTMLInputElement;
  const passwordInput = document.getElementById("password") as HTMLInputElement;

  // Add error message element for login form
  const loginErrorMsg = document.createElement("div");
  loginErrorMsg.className = "login-error-message";
  loginErrorMsg.style.color = "#FF5252";
  loginErrorMsg.style.margin = "10px 0";
  loginErrorMsg.style.padding = "8px";
  loginErrorMsg.style.borderRadius = "4px";
  loginErrorMsg.style.backgroundColor = "rgba(255, 82, 82, 0.1)";
  loginErrorMsg.style.display = "none";

  // Insert error message before the sign-in button
  const formGroup = signInButton.parentElement;
  formGroup.insertBefore(loginErrorMsg, signInButton);

  // Add event listeners for Enter key in login inputs
  emailInput.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      // If enter is pressed in the email field, move focus to password
      // unless password already has a value, then submit the form
      if (passwordInput.value.trim()) {
        signInButton.click();
      } else {
        passwordInput.focus();
      }
    }
  });

  passwordInput.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      // If enter is pressed in the password field, submit the form
      signInButton.click();
    }
  });

  // Authentication handler
  signInButton.addEventListener("click", async () => {
    // If already authenticated, handle logout
    if (isAuthenticated) {
      try {
        // Show loading state
        signInButton.textContent = "Logging out...";
        signInButton.disabled = true;

        // Instead of calling problematic backend methods, just handle logout locally
        // Update authentication state
        isAuthenticated = false;

        // Update button state
        updateLoginButtonState();
        updateUIBasedOnAuthStatus(); // Disable UI elements

        // Reset form fields
        passwordInput.value = "";

        // Keep login panel open for re-login
        loginPanel.classList.add("visible");

        // Focus on email field
        emailInput.focus();

        // Enable button
        signInButton.disabled = false;

        console.log("User logged out locally");
      } catch (error) {
        console.error("Logout failed:", error);
        signInButton.textContent = "Logout";
        signInButton.disabled = false;
      }
      return;
    }

    // Clear any previous error messages
    loginErrorMsg.style.display = "none";
    loginErrorMsg.textContent = "";

    // Get the email and password values
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    // Validate inputs
    if (!email || !password) {
      loginErrorMsg.textContent = "Please enter both email and password.";
      loginErrorMsg.style.display = "block";
      emailInput.focus();
      return;
    }

    try {
      // Show loading state
      signInButton.textContent = "Signing in...";
      signInButton.disabled = true;

      // Use IPC to authenticate with Firebase with type assertion
      const api = window.electronAPI as ElectronAPIType;
      const result = await api.authenticateWithFirebase(email, password);

      if (result.error) {
        throw new Error(result.error || "Authentication failed");
      }

      console.log("Sign-in successful", result.user.email);
      signInButton.textContent = "Signed in";

      // Update authentication state - temporarily mark as authenticated
      isAuthenticated = true;

      // Force a complete profile reload
      try {
        // First reload the profile from server
        await reloadProfile();

        // Check if the user has any chores set up
        const hasChores =
          playerProfile.chores && playerProfile.chores.length > 0;

        if (!hasChores) {
          // No chores found - show error and prevent leaving login panel
          loginErrorMsg.textContent =
            "You cannot use the app until chores are set up for your profile. Please contact your administrator to set up chores and then restart the app.";
          loginErrorMsg.style.display = "block";

          // Mark as not authenticated to keep them on the login panel
          isAuthenticated = false;

          // Keep login panel visible
          loginPanel.classList.add("visible");

          // Reset button state
          signInButton.textContent = "Sign In";
          signInButton.disabled = false;

          return;
        }

        // If we get here, user has chores, so proceed normally
        // Close the login panel
        loginPanel.classList.remove("visible");

        // Then redraw the UI components
        updateXpDisplay();
        loadTodayChores().then(() => {
          renderChores();
        });
        renderRewards();

        // Update UI state based on authentication
        updateUIBasedOnAuthStatus();
      } catch (err) {
        console.error("Error refreshing profile after login:", err);

        // If there was an error loading the profile, mark as not authenticated
        isAuthenticated = false;
        updateUIBasedOnAuthStatus(); // Disable UI elements

        // Show an error message
        loginErrorMsg.textContent =
          "Error loading your profile. Please try again.";
        loginErrorMsg.style.display = "block";

        // Reset button state
        signInButton.textContent = "Sign In";
        signInButton.disabled = false;
      }
    } catch (error: unknown) {
      // Handle authentication errors
      console.error("Authentication failed:", error);

      // Set the error message
      const errorMsg =
        error instanceof Error ? error.message : "Authentication failed";

      loginErrorMsg.textContent = errorMsg;
      loginErrorMsg.style.display = "block";

      // Set authentication status to false
      isAuthenticated = false;
      updateLoginButtonState();
      updateUIBasedOnAuthStatus(); // Disable UI elements

      // Re-enable inputs
      signInButton.textContent = "Sign In";
      signInButton.disabled = false;

      // Focus the email input for retry
      emailInput.focus();
    }
  });

  // Play notification sound when timer ends
  function playNotificationSound(): void {
    // You would need to add a sound file to your project and implement proper audio playback
    // For now, we'll just log to console
    // Example implementation:
    // const audio = new Audio('path/to/notification.mp3');
    // audio.play();
  }

  // Show notification when timer ends
  function showNotification(
    title = "Time's Up!",
    message = "Your play time is over. Time to complete your daily objectives!"
  ): void {
    // Check if browser notifications are supported
    if ("Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification(title, {
          body: message,
          icon: "/path/to/icon.png", // Replace with actual icon path
        });
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then((permission) => {
          if (permission === "granted") {
            new Notification(title, {
              body: message,
              icon: "/path/to/icon.png", // Replace with actual icon path
            });
          }
        });
      }
    }
  }

  // Add this CSS to your index.html or a separate CSS file
  const style = document.createElement("style");
  style.textContent = `
        .app-content {
            position: relative;
            height: calc(100vh - 72px); /* Adjust for top bar (50px) and status bar (22px) */
            display: flex;
            flex-direction: column;
            padding: 20px 20px 0px;
            box-sizing: border-box;
            align-items: center;
        }

        .chores-section {
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
            margin-bottom: 10px;
            border-radius: 12px;
            background-color: rgba(255, 255, 255, 0.07);
            width: 100%;
            max-width: 800px;
            align-self: center;
            display: flex;
            flex-direction: column;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .auth-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.7);
            z-index: 900;
            display: flex;
            justify-content: center;
            align-items: center;
            backdrop-filter: blur(3px);
        }

        .auth-overlay.hidden {
            display: none;
        }

        .chores-section h2 {
            text-align: center;
            padding: 16px;
            margin: 0;
            font-size: 18px;
            font-weight: 600;
            color: rgba(255, 255, 255, 0.95);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .chores-list {
            padding: 5px;
            width: 100%;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            gap: 5px;
        }

        /* Custom scrollbar styling */
        .chores-section::-webkit-scrollbar {
            width: 6px;
        }

        .chores-section::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 3px;
        }

        .chores-section::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.2);
            border-radius: 3px;
        }

        .chores-section::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.3);
        }

        .chore-item {
            display: flex;
            align-items: center;
            padding: 5px;
            background-color: rgba(255, 255, 255, 0.08);
            border-radius: 8px;
            transition: all 0.2s ease;
            width: 100%;
            box-sizing: border-box;
            min-width: 0;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .chore-status-btn {
            width: 32px;
            height: 32px;
            min-width: 32px;
            margin-right: 14px;
            border-radius: 50%;
            border: 2px solid currentColor;
            background: transparent;
            color: inherit;
            font-size: 14px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            flex-shrink: 0;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .chore-item.completed {
            background-color: rgba(76, 175, 80, 0.15);
        }

        .chore-item.completed .chore-status-btn {
            background-color: #4CAF50;
            border-color: #4CAF50;
            color: white;
        }

        .chore-item.na {
            background-color: rgba(158, 158, 158, 0.15);
        }

        .chore-item.na .chore-status-btn {
            background-color: #9E9E9E;
            border-color: #9E9E9E;
            color: white;
            font-size: 12px;
            font-weight: bold;
        }

        .chore-item.incomplete {
            background-color: rgba(255, 82, 82, 0.15);
        }

        .chore-item.incomplete .chore-status-btn {
            background-color: transparent;
            border-color: #FF5252;
            color: #FF5252;
        }

        .chore-item.completed span {
            opacity: 0.7;
        }

        .chore-item.na span {
            opacity: 0.5;
            font-style: italic;
        }

        .chore-item span {
            flex: 1;
            font-size: 15px;
            line-height: 1.4;
            padding: 0;
            overflow-wrap: break-word;
            word-wrap: break-word;
            word-break: break-word;
            hyphens: auto;
            min-width: 0;
            color: rgba(255, 255, 255, 0.9);
        }

        /* Ensure completion message stays fixed at the bottom while scrolling */
        .completion-message {
            position: sticky;
            bottom: 0;
            right: 0;
            background-color: rgba(51, 51, 51, 0.95);
            z-index: 99;
            text-align: center;
            border-bottom-left-radius: 10px;
            border-bottom-right-radius: 10px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(5px);
            margin: 0 -16px -16px -16px;
            box-shadow: 0 -4px 6px rgba(0, 0, 0, 0.1);
            padding: 12px 16px;
        }

        .completion-message p {
            margin: 0 0 10px 0;
            color: rgba(255, 255, 255, 0.9);
            font-size: 14px;
        }

        .completion-message button {
            margin: 0;
        }

        .overlay-message {
            padding: 16px 24px;
            background-color: rgba(0, 0, 0, 0.7);
            color: white;
            border-radius: 8px;
            font-size: 18px;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }
    `;
  document.head.appendChild(style);

  // Function to reload profile data
  async function reloadProfile() {
    try {
      // Store the previous profile to compare dates
      const previousProfile = playerProfile ? { ...playerProfile } : null;
      const previousDate = previousProfile
        ? Object.keys(previousProfile.history || {})
            .sort()
            .pop()
        : null;

      // Add retry logic for loading the profile
      let baseProfile: BasePlayerProfile | null = null;
      let retryCount = 0;
      const maxRetries = 3;

      while (!baseProfile && retryCount < maxRetries) {
        try {
          // Reload the profile data with a timeout
          const profilePromise = window.electronAPI.loadPlayerProfile();
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Profile load timeout")), 5000)
          );

          baseProfile = (await Promise.race([
            profilePromise,
            timeoutPromise,
          ])) as BasePlayerProfile;

          if (!baseProfile) {
            throw new Error("No profile data returned");
          }

          // Log whether profile has chores for debugging
          console.log(
            "Profile loaded, has chores:",
            baseProfile.chores && baseProfile.chores.length > 0
          );
        } catch (loadError) {
          console.error(
            `Error loading profile (attempt ${retryCount + 1}/${maxRetries}):`,
            loadError
          );
          retryCount++;

          if (retryCount < maxRetries) {
            // Exponential backoff
            await new Promise((resolve) =>
              setTimeout(resolve, 1000 * retryCount)
            );
          } else {
            throw loadError; // Rethrow the error after max retries
          }
        }
      }

      // Convert base profile to renderer profile
      playerProfile = {
        ...baseProfile,
        level: calculateLevel(baseProfile),
        xp: calculateXp(baseProfile),
        xpToNextLevel: calculateXpToNextLevel(),
        completedChores: getCompletedChores(baseProfile),
      };
      updateXpDisplay();

      // Apply permanent bonuses after profile reload
      applyPermanentBonuses();

      // Get the current date
      const currentDate = getLocalDateString();

      // If we had a previous profile and the date has changed, check for penalties
      if (previousProfile && previousDate && previousDate !== currentDate) {
        const previousDayData = previousProfile.history[
          previousDate
        ] as DayProgress;

        // Check if previousDayData has penalties
        if (
          previousDayData &&
          previousDayData.xp &&
          previousDayData.xp.penalties > 0
        ) {
          // Show message about penalties from previous day
          showNotification(
            "Daily Objectives Summary",
            `You received a ${previousDayData.xp.penalties} XP penalty for incomplete objectives yesterday.`
          );
        }
      }

      // Load today's chores with the refreshed profile
      await loadTodayChores();
      renderChores();
      renderRewards();

      return baseProfile;
    } catch (error) {
      console.error("Error reloading profile:", error);
      // Don't show alert to user as this might happen during auto-login
      // and would be confusing
      return null;
    }
  }

  // Function to safely reset app state in case of errors
  function resetAppState() {
    try {
      clearInterval(timerInterval);
      timerInterval = null;
      currentState = AppState.READY;

      // Use base time + permanent bonus
      const basePlayTime = APP_CONFIG.TIMER.PLAY_TIME_MINUTES;
      const permanentBonus = getPermanentPlayTimeBonus();
      timeLeft = (basePlayTime + permanentBonus) * 60;

      updateTimerDisplay();
      updateAppState(AppState.READY);

      // Enable start button, disable pause
      const startButton = document.getElementById(
        "start-timer"
      ) as HTMLButtonElement;
      const pauseButton = document.getElementById(
        "pause-timer"
      ) as HTMLButtonElement;
      if (startButton) startButton.disabled = false;
      if (pauseButton) pauseButton.disabled = true;
    } catch (error) {
      console.error("Error resetting app state:", error);
    }
  }
});
