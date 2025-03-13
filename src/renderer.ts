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

// Define chore list
interface Chore {
    id: number;
    text: string;
    completed: boolean;
}

// Define player profile interface
interface PlayerProfile {
    level: number;
    xp: number;
    xpToNextLevel: number;
    completedChores: CompletedChore[];
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
    NOTIFICATION_SOUND: 'notification.mp3', // Sound file to play when timer ends
    DEFAULT_CHORES: CHORES,
    XP_FOR_CHORE_COMPLETION: 10, // XP gained for completing a chore
    XP_FOR_PLAYTIME_COMPLETION: 5 // XP gained for completing play time
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
                completedChores: []
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

    // Remove XP from player
    async function removeXp(amount: number) {
        try {
            playerProfile = await window.electronAPI.removeXp(amount);
            updateXpDisplay();
        } catch (error) {
            console.error('Error removing XP:', error);
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
        const clockElement = document.getElementById('clock');
        if (!clockElement) return;

        // in 12 hour format
        const now = new Date();
        const hours = now.getHours() % 12 || 12; // Convert 0 to 12 for 12 AM
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');
        const ampm = now.getHours() >= 12 ? 'PM' : 'AM';
        clockElement.textContent = `${hours}:${minutes}:${seconds} ${ampm}`;
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
                choresSection.classList.remove('hidden');
                isPaused = false;
                updatePauseButtonText();
                resetChores();
                renderChores();
                
                // Award XP for completing play time
                addXp(CONFIG.XP_FOR_PLAYTIME_COMPLETION);
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

    // Reset chores to uncompleted state
    function resetChores(): void {
        chores = JSON.parse(JSON.stringify(CONFIG.DEFAULT_CHORES)); // Deep copy
        completionMessage.classList.add('hidden');
    }

    // Render chores list
    function renderChores(): void {
        // Clear existing chores
        choresList.innerHTML = '';

        // Add each chore
        chores.forEach(chore => {
            const choreItem = document.createElement('div');
            choreItem.className = `chore-item ${chore.completed ? 'completed' : ''}`;
            choreItem.dataset.id = chore.id.toString();

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = chore.completed;
            checkbox.addEventListener('change', () => {
                toggleChore(chore.id);
            });

            const label = document.createElement('span');
            label.textContent = chore.text;

            choreItem.appendChild(checkbox);
            choreItem.appendChild(label);
            choresList.appendChild(choreItem);
        });

        // Check if all chores are completed
        checkAllChoresCompleted();
    }

    // Toggle chore completion status
    function toggleChore(id: number): void {
        const chore = chores.find(c => c.id === id);
        if (chore) {
            chore.completed = !chore.completed;
            
            if (chore.completed) {
                // Add to completed chores record for XP if checked
                addCompletedChore(chore.id, chore.text);
            } else {
                // Remove from completed chores and remove XP if unchecked
                removeCompletedChore(chore.id);
            }
            
            renderChores();
        }
    }

    // Check if all chores are completed
    function checkAllChoresCompleted(): void {
        const allCompleted = chores.every(chore => chore.completed);

        if (allCompleted) {
            completionMessage.classList.remove('hidden');
        } else {
            completionMessage.classList.add('hidden');
        }
    }

    // Event Listeners
    startTimerBtn.addEventListener('click', startTimer);
    pauseTimerBtn.addEventListener('click', pauseResumeTimer);
    resetAfterChoresBtn.addEventListener('click', () => {
        updateAppState(AppState.READY);
    });

    // Initialize the app
    updateAppState(AppState.READY);
    updateTimerDisplay();

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
    function showNotification(): void {
        // Check if browser notifications are supported
        if ('Notification' in window) {
            if (Notification.permission === 'granted') {
                new Notification('Time\'s Up!', {
                    body: 'Your play time is over. Time to do some chores!',
                    icon: '/path/to/icon.png' // Replace with actual icon path
                });
            } else if (Notification.permission !== 'denied') {
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                        new Notification('Time\'s Up!', {
                            body: 'Your play time is over. Time to do some chores!',
                            icon: '/path/to/icon.png' // Replace with actual icon path
                        });
                    }
                });
            }
        }
    }
});