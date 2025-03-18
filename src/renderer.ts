/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 */

import { CHORES } from './chores';
import './index.css';

// Define app states
enum AppState {
    READY = 'ready',
    PLAYING = 'playing',
    COOLDOWN = 'cooldown'
}

// Define chore status type
type ChoreStatus = 'completed' | 'incomplete' | 'na';

// Define chore list
interface Chore {
    id: number;
    text: string;
    status: ChoreStatus;
}

// Define player profile interface
interface PlayerProfile {
    level: number;
    xp: number;
    xpToNextLevel: number;
    completedChores: CompletedChore[];
    history: { [date: string]: { chores: Chore[] } };
}

// Interface for completed chores tracking
interface CompletedChore {
    id: number;
    text: string;
    completedAt: string; // ISO date string
}

// App configuration
const CONFIG = {
    PLAY_TIME_MINUTES: 0.1, // 1 hour of play time
    COOLDOWN_TIME_MINUTES: 0.2, // 1 hour of cooldown time
    NOTIFICATION_SOUND: 'notification.mp3', // Sound file to play when timer ends
    DEFAULT_CHORES: CHORES,
    XP_FOR_CHORE_COMPLETION: 10, // XP gained for completing a chore
};

document.addEventListener('DOMContentLoaded', async () => {
    // Get the top bar for dragging - now the entire top section is draggable
    const topBar = document.querySelector('.top-bar');

    // Get player profile UI elements
    const xpBarElement = document.getElementById('xp-bar') as HTMLElement;
    const xpTextElement = document.querySelector('.xp-text') as HTMLElement;
    const levelIndicatorElement = document.querySelector('.level-indicator') as HTMLElement;

    // Player profile data
    let playerProfile: PlayerProfile;

    // Load player profile
    async function loadPlayerProfile() {
        try {
            playerProfile = await window.electronAPI.loadPlayerProfile();
            updateXpDisplay();
        } catch (error) {
            console.error('Error loading player profile:', error);
            // Set default values if profile can't be loaded
            playerProfile = {
                level: 1,
                xp: 0,
                xpToNextLevel: 100,
                completedChores: [],
                history: {}
            };
        }
    }

    // Update XP display
    function updateXpDisplay() {
        if (!playerProfile) return;

        const xpPercentage = Math.min(100, Math.floor((playerProfile.xp / playerProfile.xpToNextLevel) * 100));

        // Update XP bar width
        xpBarElement.style.width = `${xpPercentage}%`;

        // Update XP text
        xpTextElement.textContent = `${playerProfile.xp}/${playerProfile.xpToNextLevel} XP`;

        // Update level indicator
        levelIndicatorElement.textContent = `Level ${playerProfile.level}`;
    }

    // Add XP to player
    async function addXp(amount: number) {
        try {
            playerProfile = await window.electronAPI.addXp(amount);
            updateXpDisplay();
        } catch (error) {
            console.error('Error adding XP:', error);
        }
    }

    // Add completed chore
    async function addCompletedChore(choreId: number, choreText: string) {
        try {
            playerProfile = await window.electronAPI.addCompletedChore(choreId, choreText);
            updateXpDisplay();
        } catch (error) {
            console.error('Error adding completed chore:', error);
        }
    }

    // Remove completed chore
    async function removeCompletedChore(choreId: number) {
        try {
            playerProfile = await window.electronAPI.removeCompletedChore(choreId);
            updateXpDisplay();
        } catch (error) {
            console.error('Error removing completed chore:', error);
        }
    }

    // Load player profile at startup
    await loadPlayerProfile();

    if (topBar) {
        let isDragging = false;
        let startMouseX = 0;
        let startMouseY = 0;

        topBar.addEventListener('mousedown', (e: MouseEvent) => {
            isDragging = true;
            startMouseX = e.clientX;
            startMouseY = e.clientY;
        });

        document.addEventListener('mousemove', (e: MouseEvent) => {
            if (isDragging) {
                const deltaX = e.clientX - startMouseX;
                const deltaY = e.clientY - startMouseY;

                window.electronAPI.windowMove(deltaX, deltaY);

                startMouseX = e.clientX;
                startMouseY = e.clientY;
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }

    // Function to apply the correct theme to the html element
    const applyTheme = (isDarkMode: boolean) => {
        document.documentElement.classList.remove('dark-mode', 'light-mode');
        document.documentElement.classList.add(isDarkMode ? 'dark-mode' : 'light-mode');

        const toggleBtn = document.getElementById('toggle-dark-mode');
        if (toggleBtn) {
            toggleBtn.innerHTML = isDarkMode ? '💡' : '🌑';
        }
    };

    // Get initial dark mode status from Electron
    const syncThemeWithElectron = async () => {
        try {
            const isDarkMode = await window.electronAPI.getDarkMode();
            applyTheme(isDarkMode);
        } catch (err) {
            console.error('Error syncing theme with Electron:', err);
        }
    };

    // Set up dark mode toggle functionality
    const toggleBtn = document.getElementById('toggle-dark-mode');
    if (toggleBtn) {
        // Initialize button text based on current HTML class
        toggleBtn.innerHTML = document.documentElement.classList.contains('dark-mode') ? '💡' : '🌑';

        toggleBtn.addEventListener('click', async () => {
            try {
                const isDarkMode = await window.electronAPI.toggleDarkMode();
                applyTheme(isDarkMode);
            } catch (err) {
                console.error('Error toggling dark mode:', err);
            }
        });
    }

    // Sync theme with Electron's native theme setting
    syncThemeWithElectron();

    function updateClock(): void {
        const topDateTimeElement = document.getElementById('top-date-time');
        if (!topDateTimeElement) return;

        const now = new Date();

        // Format date as MM/DD/YYYY
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const year = now.getFullYear();
        const dateStr = `${month}/${day}/${year}`;

        // Format time in 12-hour format
        const hours = now.getHours() % 12 || 12; // Convert 0 to 12 for 12 AM
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const ampm = now.getHours() >= 12 ? 'PM' : 'AM';
        const timeStr = `${hours}:${minutes} ${ampm}`;

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
    const timerDisplay = document.getElementById('timer-display') as HTMLElement;
    const startTimerBtn = document.getElementById('start-timer') as HTMLButtonElement;
    const pauseTimerBtn = document.getElementById('pause-timer') as HTMLButtonElement;
    const resetAfterChoresBtn = document.getElementById('reset-after-chores') as HTMLButtonElement;
    const currentStateElement = document.getElementById('current-state') as HTMLElement;
    const choresSection = document.getElementById('chores-section') as HTMLElement;
    const choresList = document.getElementById('chores-list') as HTMLElement;
    const completionMessage = document.getElementById('completion-message') as HTMLElement;

    // Timer variables
    let timerInterval: number | null = null;
    let timeLeft = CONFIG.PLAY_TIME_MINUTES * 60; // in seconds
    let chores: Chore[] = JSON.parse(JSON.stringify(CONFIG.DEFAULT_CHORES)); // Deep copy
    console.log(chores);
    let currentState: AppState = AppState.READY;
    let isPaused: boolean = false;

    // Reset chores to uncompleted state - only used for new days
    function resetChores(): void {
        chores = CHORES.map(chore => ({
            id: chore.id,
            text: chore.text,
            status: 'incomplete' as ChoreStatus
        }));
    }

    // Helper function to get today's date in local time YYYY-MM-DD format
    function getLocalDateString(): string {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Load or initialize today's chores
    async function loadTodayChores(): Promise<void> {
        try {
            const today = getLocalDateString();
            const todayProgress = playerProfile.history[today];

            if (todayProgress && todayProgress.chores) {
                // Use today's existing progress
                chores = todayProgress.chores.map(chore => ({
                    id: chore.id,
                    text: chore.text,
                    status: chore.status as ChoreStatus
                }));
            } else {
                // Initialize new day with default incomplete status
                resetChores();

                // Create a proper day progress object in the history
                if (!playerProfile.history[today]) {
                    // First ensure the history object is initialized
                    playerProfile.history[today] = { chores: [] };

                    // Then update it with the current chores
                    playerProfile.history[today].chores = chores.map(chore => ({
                        id: chore.id,
                        text: chore.text,
                        status: chore.status
                    }));

                    // Save the updated profile
                    await window.electronAPI.savePlayerProfile(playerProfile);
                }
            }
        } catch (error) {
            console.error('Error loading today\'s chores:', error);
            resetChores();
        }
    }

    // Function to update app state
    function updateAppState(newState: AppState): void {
        currentState = newState;
        currentStateElement.textContent = getStateDisplayName(newState);
        currentStateElement.className = 'state-badge ' + newState;

        // Update UI based on state
        switch (newState) {
            case AppState.READY:
                startTimerBtn.disabled = false;
                pauseTimerBtn.disabled = true;
                choresSection.classList.add('hidden');
                timeLeft = CONFIG.PLAY_TIME_MINUTES * 60;
                isPaused = false;
                updatePauseButtonText();
                updateTimerDisplay();
                break;

            case AppState.PLAYING:
                startTimerBtn.disabled = true;
                pauseTimerBtn.disabled = false;
                choresSection.classList.add('hidden');
                break;

            case AppState.COOLDOWN:
                startTimerBtn.disabled = true;
                pauseTimerBtn.disabled = true;
                resetAfterChoresBtn.disabled = true;
                choresSection.classList.remove('hidden');
                timeLeft = CONFIG.COOLDOWN_TIME_MINUTES * 60;
                isPaused = false;
                updatePauseButtonText();
                loadTodayChores().then(() => {
                    renderChores();
                });

                break;
        }
    }

    // Update the pause button text based on pause state
    function updatePauseButtonText(): void {
        pauseTimerBtn.textContent = isPaused ? 'Resume' : 'Pause';
    }

    // Helper to get user-friendly state name
    function getStateDisplayName(state: AppState): string {
        switch (state) {
            case AppState.READY: return 'Ready to Play';
            case AppState.PLAYING:
                return isPaused ? 'Paused' : 'Playing Time';
            case AppState.COOLDOWN: return 'Chore Time';
            default: return 'Unknown State';
        }
    }

    // Format time as HH:MM:SS
    function formatTime(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        return [
            hours.toString().padStart(2, '0'),
            minutes.toString().padStart(2, '0'),
            secs.toString().padStart(2, '0')
        ].join(':');
    }

    // Update timer display
    function updateTimerDisplay(): void {
        timerDisplay.textContent = formatTime(timeLeft);
    }

    // Start the timer
    function startTimer(): void {
        updateAppState(AppState.PLAYING);

        if (timerInterval) {
            clearInterval(timerInterval);
        }

        timerInterval = window.setInterval(() => {
            if (!isPaused) {
                timeLeft--;
                updateTimerDisplay();

                if (timeLeft <= 0) {
                    stopTimer();
                    playNotificationSound();
                    showNotification();
                    updateAppState(AppState.COOLDOWN);
                    startCooldownTimer(); // Start cooldown timer when play time ends
                }
            }
        }, 1000);
    }

    // Start the cooldown timer
    function startCooldownTimer(): void {
        if (timerInterval) {
            clearInterval(timerInterval);
        }

        timerInterval = window.setInterval(() => {
            if (!isPaused) {
                timeLeft--;
                updateTimerDisplay();
                updateResetButtonState(); // Update button state every tick

                if (timeLeft <= 0) {
                    stopTimer();
                    playNotificationSound();
                    showNotification('Cooldown Complete', 'Your cooldown period is over! Complete your chores to start playing again.');
                    updateResetButtonState(); // Update one final time when timer hits 0
                }
            }
        }, 1000);
    }

    // Stop the timer
    function stopTimer(): void {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    // Pause or resume the timer
    function pauseResumeTimer(): void {
        isPaused = !isPaused;
        updatePauseButtonText();
        currentStateElement.textContent = getStateDisplayName(currentState);
    }

    // Render chores list
    function renderChores(): void {
        // Clear existing chores
        choresList.innerHTML = '';

        // Add each chore
        chores.forEach(chore => {
            const choreItem = document.createElement('div');
            choreItem.className = `chore-item ${chore.status}`;
            choreItem.dataset.id = chore.id.toString();

            // Create status toggle button
            const statusBtn = document.createElement('button');
            statusBtn.className = 'chore-status-btn';
            statusBtn.innerHTML = getStatusIcon(chore.status);
            statusBtn.addEventListener('click', () => {
                cycleChoreStatus(chore.id);
            });

            const label = document.createElement('span');
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
            case 'completed': return '✓';
            case 'na': return 'N/A';
            case 'incomplete': return '✗';
            default: return '✗'; // Default to incomplete
        }
    }

    // Cycle through chore statuses
    function cycleChoreStatus(id: number): void {
        const chore = chores.find(c => c.id === id);
        if (!chore) return;

        // Cycle through states: incomplete -> completed -> na -> incomplete
        const nextStatus: { [key in ChoreStatus]: ChoreStatus } = {
            'incomplete': 'completed',
            'completed': 'na',
            'na': 'incomplete'
        };

        const oldStatus = chore.status;
        const newStatus = nextStatus[oldStatus];

        // Update chore status
        chore.status = newStatus;

        // Update the profile with the new chore status
        const today = getLocalDateString();
        if (!playerProfile.history[today]) {
            playerProfile.history[today] = { chores: [] };
        }

        // Update the chore in the player profile
        const profileChore = playerProfile.history[today].chores.find(c => c.id === id);
        if (profileChore) {
            profileChore.status = newStatus;
        } else {
            // If the chore doesn't exist in the profile, add it
            playerProfile.history[today].chores.push({
                id: chore.id,
                text: chore.text,
                status: newStatus
            });
        }

        // Save to profile and handle XP changes
        window.electronAPI.savePlayerProfile(playerProfile);
        window.electronAPI.updateChoreStatus(id, newStatus);

        renderChores();
    }

    // Check if all chores are completed or N/A
    function checkAllChoresCompleted(): void {
        const allDone = chores.every(chore =>
            chore.status === 'completed' || chore.status === 'na'
        );

        // Always show completion message, but with different text based on completion
        completionMessage.classList.remove('hidden');
        updateResetButtonState();
    }

    // Update the reset button state and completion message
    function updateResetButtonState(): void {
        const allChoresCompleted = chores.every(chore =>
            chore.status === 'completed' || chore.status === 'na'
        );

        // Only enable the reset button if cooldown timer is done
        resetAfterChoresBtn.disabled = timeLeft > 0;

        // Update the completion message text based on state
        if (timeLeft > 0) {
            completionMessage.querySelector('p')!.textContent =
                `Cooldown time remaining. Complete your chores while you wait!`;
        } else if (allChoresCompleted) {
            completionMessage.querySelector('p')!.textContent =
                'Great job completing your chores! You can start play time now.';
        } else {
            const incompleteCount = chores.filter(chore =>
                chore.status === 'incomplete'
            ).length;

            completionMessage.querySelector('p')!.textContent =
                `You have ${incompleteCount} incomplete ${incompleteCount === 1 ? 'chore' : 'chores'}. Remember: -10 XP per incomplete chore at the end of the day!`;
        }
        completionMessage.classList.remove('hidden');
    }

    // Event Listeners
    startTimerBtn.addEventListener('click', startTimer);
    pauseTimerBtn.addEventListener('click', pauseResumeTimer);
    resetAfterChoresBtn.addEventListener('click', () => {
        // Only allow starting play time if cooldown is done
        if (timeLeft <= 0) {
            updateAppState(AppState.READY);
        }
    });

    // Initialize chores list
    async function initializeChores(): Promise<void> {
        await loadTodayChores();
        renderChores();
    }

    // Initialize the app
    initializeChores();
    updateAppState(AppState.READY);
    updateTimerDisplay();

    // History panel functionality
    const historyBtn = document.getElementById('show-history') as HTMLButtonElement;
    const historyPanel = document.getElementById('history-panel') as HTMLElement;
    const historyContent = historyPanel.querySelector('.history-content') as HTMLElement;

    function toggleHistoryPanel(e: MouseEvent): void {
        e.stopPropagation(); // Prevent event from bubbling up
        historyPanel.classList.toggle('visible');
        if (historyPanel.classList.contains('visible')) {
            // Refresh player profile before rendering history
            loadPlayerProfile().then(() => {
                renderHistory();
            });
        }
    }

    function renderHistory(): void {
        historyContent.innerHTML = '';

        // Get dates in reverse chronological order
        const dates = Object.keys(playerProfile.history).sort().reverse();

        dates.forEach(date => {
            const dayHistory = playerProfile.history[date];
            if (!dayHistory || !dayHistory.chores || dayHistory.chores.length === 0) return;

            const dateSection = document.createElement('div');
            dateSection.className = 'history-date';

            // Format date to be more readable (e.g., "January 1, 2024")
            const formattedDate = new Date(date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            dateSection.innerHTML = `<h3>${formattedDate}</h3>`;

            // Add chores for this date
            dayHistory.chores.forEach(chore => {
                const choreElement = document.createElement('div');
                choreElement.className = 'history-chore';

                const statusIcon = getStatusIcon(chore.status as ChoreStatus);
                choreElement.innerHTML = `
                    <div class="status ${chore.status}">${statusIcon}</div>
                    <span>${chore.text}</span>
                `;

                dateSection.appendChild(choreElement);
            });

            historyContent.appendChild(dateSection);
        });

        if (dates.length === 0) {
            historyContent.innerHTML = '<p style="text-align: center; padding: 20px;">No history available yet.</p>';
        }
    }

    // Add event listener for history button
    historyBtn.addEventListener('click', toggleHistoryPanel);

    // Close history panel when clicking outside
    document.addEventListener('click', (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!historyPanel.contains(target) &&
            !historyBtn.contains(target) &&
            historyPanel.classList.contains('visible')) {
            historyPanel.classList.remove('visible');
        }
    });

    // Prevent clicks inside the history panel from closing it
    historyPanel.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation();
    });

    // Play notification sound when timer ends
    function playNotificationSound(): void {
        // You would need to add a sound file to your project and implement proper audio playback
        // For now, we'll just log to console
        console.log('Playing notification sound');
        // Example implementation:
        // const audio = new Audio('path/to/notification.mp3');
        // audio.play();
    }

    // Show notification when timer ends
    function showNotification(title: string = 'Time\'s Up!', message: string = 'Your play time is over. Time to do some chores!'): void {
        // Check if browser notifications are supported
        if ('Notification' in window) {
            if (Notification.permission === 'granted') {
                new Notification(title, {
                    body: message,
                    icon: '/path/to/icon.png' // Replace with actual icon path
                });
            } else if (Notification.permission !== 'denied') {
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                        new Notification(title, {
                            body: message,
                            icon: '/path/to/icon.png' // Replace with actual icon path
                        });
                    }
                });
            }
        }
    }

    // Add this CSS to your index.html or a separate CSS file
    const style = document.createElement('style');
    style.textContent = `
        .app-content {
            position: relative;
            height: 100vh;
            display: flex;
            flex-direction: column;
            padding: 20px 20px 100px;
            box-sizing: border-box;
            align-items: center;
        }

        .chores-section {
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
            margin-bottom: 80px;
            border-radius: 10px;
            background-color: rgba(255, 255, 255, 0.05);
            width: 100%;
            max-width: 800px; /* Increased from 600px */
            align-self: center;
            display: flex;
            flex-direction: column;
        }

        .chores-section h2 {
            text-align: center;
            padding: 20px;
            margin: 0;
            font-size: 18px;
            color: rgba(255, 255, 255, 0.9);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .chores-list {
            padding: 20px;
            width: 100%;
            box-sizing: border-box;
        }

        /* Custom scrollbar styling */
        .chores-section::-webkit-scrollbar {
            width: 10px;
        }

        .chores-section::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 5px;
        }

        .chores-section::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.2);
            border-radius: 5px;
        }

        .chores-section::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.3);
        }

        .xp-section {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            width: calc(100% - 40px);
            max-width: 800px; /* Match chores section width */
            background-color: rgba(51, 51, 51, 0.95);
            padding: 10px;
            border-radius: 10px;
            z-index: 100;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        .chore-item {
            display: flex;
            align-items: flex-start;
            padding: 15px;
            margin-bottom: 10px;
            background-color: rgba(255, 255, 255, 0.1);
            border-radius: 5px;
            transition: all 0.3s ease;
            width: 100%;
            box-sizing: border-box;
            min-width: 0; /* Prevent flex items from overflowing */
        }

        .chore-status-btn {
            width: 40px;
            height: 40px;
            min-width: 40px;
            margin-right: 15px;
            border-radius: 50%;
            border: 2px solid currentColor;
            background: transparent;
            color: inherit;
            font-size: 16px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            flex-shrink: 0;
        }

        .chore-item.completed {
            background-color: rgba(76, 175, 80, 0.1);
        }

        .chore-item.completed .chore-status-btn {
            background-color: #4CAF50;
            border-color: #4CAF50;
            color: white;
        }

        .chore-item.na {
            background-color: rgba(158, 158, 158, 0.1);
        }

        .chore-item.na .chore-status-btn {
            background-color: #9E9E9E;
            border-color: #9E9E9E;
            color: white;
            font-size: 12px;
            font-weight: bold;
        }

        .chore-item.incomplete {
            background-color: rgba(255, 82, 82, 0.1);
        }

        .chore-item.incomplete .chore-status-btn {
            background-color: transparent;
            border-color: #FF5252;
            color: #FF5252;
        }

        .chore-item.completed span {
            text-decoration: line-through;
            opacity: 0.7;
        }

        .chore-item.na span {
            opacity: 0.5;
            font-style: italic;
        }

        .chore-item span {
            flex: 1;
            font-size: 14px;
            line-height: 1.4;
            padding: 2px 0;
            overflow-wrap: break-word;
            word-wrap: break-word;
            word-break: break-word;
            hyphens: auto;
            min-width: 0; /* Allow text to shrink below its minimum content size */
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
            margin: 0 -20px -20px -20px; /* Compensate for parent padding */
            box-shadow: 0 -4px 6px rgba(0, 0, 0, 0.1);
        }

        .completion-message p {
            margin: 0 0 10px 0;
            color: rgba(255, 255, 255, 0.9);
        }

        .completion-message button {
            margin: 0;
        }
    `;
    document.head.appendChild(style);
});