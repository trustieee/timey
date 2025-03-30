// JavaScript version of the central application configuration
// This is a copy of src/config.ts without TypeScript annotations

export const APP_CONFIG = {
  // Player profile config
  PROFILE: {
    XP_PER_LEVEL: 700, // XP needed for all levels
    XP_FOR_CHORE: 10, // XP gained for completing a chore
    XP_PENALTY_FOR_CHORE: 10, // XP penalty for incomplete chore at day end
  },

  // Timer settings
  TIMER: {
    PLAY_TIME_MINUTES: 0.1, // Play time (60 minutes)
    COOLDOWN_TIME_MINUTES: 0.1, // Cooldown time (60 minutes)
  },

  // Notifications
  NOTIFICATIONS: {
    SOUND_FILE: "notification.mp3", // Sound file to play when timer ends
  },

  // Default chores (empty array)
  CHORES: [],

  // Profile refresh interval (in milliseconds)
  PROFILE_REFRESH_INTERVAL: 5 * 60 * 1000, // 5 minutes
};

// Default player profile - now just contains empty history
export const DEFAULT_PROFILE = {
  history: {},
  rewards: {
    available: 0,
    permanent: {},
  },
};

// Firebase configuration that gets populated during build
export const firebaseConfig = {
  apiKey: "AIzaSyABt0tpywqGv_o1eESnPF-KFWbZqGEI6rk",
  authDomain: "timey-cb25d.firebaseapp.com",
  projectId: "timey-cb25d",
  storageBucket: "timey-cb25d.firebasestorage.app",
  messagingSenderId: "645381009437",
  appId: "1:645381009437:web:b8b74f9f675e689a80d6f4",
  measurementId: "G-BJZ21NMYBY",
};
