import { CHORES } from './chores';

// Central application configuration
export const APP_CONFIG = {
  // Player profile config
  PROFILE: {
    XP_PER_LEVEL: [840, 960, 1080, 1200], // XP needed for levels 1-5 (7, 8, 9, 10 days worth of tasks)
    DEFAULT_XP_PER_LEVEL: 1200,         // XP needed for levels 5+ (10 days worth of tasks)
    XP_FOR_CHORE: 10,                   // XP gained for completing a chore
    XP_PENALTY_FOR_CHORE: 10,           // XP penalty for incomplete chore at day end
  },

  // Timer settings
  TIMER: {
    PLAY_TIME_MINUTES: .1,       // Play time (60 minutes)
    COOLDOWN_TIME_MINUTES: .1,   // Cooldown time (60 minutes)
  },

  // Notifications
  NOTIFICATIONS: {
    SOUND_FILE: 'notification.mp3', // Sound file to play when timer ends
  },

  // Default chores
  CHORES: CHORES,

  // Profile refresh interval (in milliseconds)
  PROFILE_REFRESH_INTERVAL: 5 * 60 * 1000, // 5 minutes
};

// Default player profile - now just contains empty history
export const DEFAULT_PROFILE = {
  history: {},
  rewards: {
    available: 0,
    permanent: {}
  }
}; 