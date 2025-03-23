import { 
  calculatePlayerStats,
  PlayerProfile,
  DayProgress,
  ChoreStatus,
  getXpRequiredForLevel,
  finalizeDayProgress,
  loadPlayerProfile,
  savePlayerProfile,
  updateChoreStatus,
  useReward,
  addXp,
  removeXp
} from '../playerProfile';
import { APP_CONFIG } from '../config';
import { getLocalDateString, getPreviousDateString } from '../utils';
import { RewardType } from '../rewards';

// Mock fs module to avoid actual file operations
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn()
}));

// Mock electron's app to avoid actual path operations
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/mock/path')
  }
}));

describe('Edge Cases Tests', () => {
  // Helper function to create a test profile
  function createTestProfile(): PlayerProfile & {level: number, xp: number, xpToNextLevel: number} {
    return {
      history: {},
      rewards: {
        available: 0
      },
      level: 1,
      xp: 0,
      xpToNextLevel: APP_CONFIG.PROFILE.XP_PER_LEVEL[0]
    };
  }

  describe('XP Edge Cases', () => {
    test('Should handle negative XP correctly', () => {
      let profile = createTestProfile();
      const today = getLocalDateString();
      
      // Setup today with initial XP
      profile.history[today] = {
        date: today,
        chores: [],
        playTime: { totalMinutes: 0, sessions: [] },
        xp: {
          gained: 100,
          penalties: 0,
          final: 100
        },
        completed: false
      };
      
      // Try to remove more XP than exists
      const updatedProfile = removeXp(profile, 200);
      
      // XP should be clamped to 0, not go negative
      expect(updatedProfile.history[today].xp.gained).toBe(0);
      expect(updatedProfile.history[today].xp.final).toBe(0);
    });
    
    test('Should handle extremely high XP values', () => {
      const profile = createTestProfile();
      const today = getLocalDateString();
      
      // Setup today with extremely high XP
      profile.history[today] = {
        date: today,
        chores: [],
        playTime: { totalMinutes: 0, sessions: [] },
        xp: {
          gained: 1000000, // 1 million XP
          penalties: 0,
          final: 1000000
        },
        completed: true
      };
      
      // Calculate stats
      const stats = calculatePlayerStats(profile);
      
      // Should calculate level correctly even with very high XP
      // Expected level should be 1 + (1000000 / avg XP per level)
      const expectedLevelApprox = 1 + Math.floor(1000000 / 1000); // Assuming ~1000 XP per level
      
      // Verify level is in a reasonable range
      expect(stats.level).toBeGreaterThan(500); // Should be well over level 500
      
      // XP into current level should be less than XP required for that level
      expect(stats.xp).toBeLessThan(getXpRequiredForLevel(stats.level));
    });
    
    test('Should handle empty history', () => {
      const profile = {
        history: {},
        rewards: { available: 0 }
      };
      
      // Calculate stats with empty history
      const stats = calculatePlayerStats(profile);
      
      // Should default to level 1 with 0 XP
      expect(stats.level).toBe(1);
      expect(stats.xp).toBe(0);
      expect(stats.xpToNextLevel).toBe(APP_CONFIG.PROFILE.XP_PER_LEVEL[0]);
    });
  });

  describe('Day Transition Edge Cases', () => {
    test('Should handle multiple day gaps properly', () => {
      let profile = createTestProfile();
      
      // Set up history with gaps between days
      const today = getLocalDateString();
      
      // Format dates for days with 3-day gaps between them
      const dayMinus10 = new Date();
      dayMinus10.setDate(dayMinus10.getDate() - 10);
      const day10 = dayMinus10.toISOString().split('T')[0];
      
      const dayMinus7 = new Date();
      dayMinus7.setDate(dayMinus7.getDate() - 7);
      const day7 = dayMinus7.toISOString().split('T')[0];
      
      const dayMinus3 = new Date();
      dayMinus3.setDate(dayMinus3.getDate() - 3);
      const day3 = dayMinus3.toISOString().split('T')[0];
      
      // Add days with gaps between them
      profile.history[day10] = {
        date: day10,
        chores: [{ id: 0, text: 'Test chore', status: 'incomplete' as ChoreStatus }],
        playTime: { totalMinutes: 0, sessions: [] },
        xp: { gained: 0, penalties: 0, final: 0 },
        completed: false
      };
      
      profile.history[day7] = {
        date: day7,
        chores: [{ id: 0, text: 'Test chore', status: 'incomplete' as ChoreStatus }],
        playTime: { totalMinutes: 0, sessions: [] },
        xp: { gained: 0, penalties: 0, final: 0 },
        completed: false
      };
      
      profile.history[day3] = {
        date: day3,
        chores: [{ id: 0, text: 'Test chore', status: 'incomplete' as ChoreStatus }],
        playTime: { totalMinutes: 0, sessions: [] },
        xp: { gained: 0, penalties: 0, final: 0 },
        completed: false
      };
      
      // Finalize all previous days
      const updatedProfile = finalizeDayProgress(
        finalizeDayProgress(
          finalizeDayProgress(profile, day10), 
          day7), 
        day3
      );
      
      // Verify all past days were finalized
      expect(updatedProfile.history[day10].completed).toBe(true);
      expect(updatedProfile.history[day7].completed).toBe(true);
      expect(updatedProfile.history[day3].completed).toBe(true);
      
      // Verify penalties were applied for the incomplete chore
      expect(updatedProfile.history[day10].xp.penalties).toBe(APP_CONFIG.PROFILE.XP_PENALTY_FOR_CHORE);
      expect(updatedProfile.history[day7].xp.penalties).toBe(APP_CONFIG.PROFILE.XP_PENALTY_FOR_CHORE);
      expect(updatedProfile.history[day3].xp.penalties).toBe(APP_CONFIG.PROFILE.XP_PENALTY_FOR_CHORE);
    });
    
    test('Should handle date changes correctly', () => {
      const profile = createTestProfile();
      
      // Create a date object for "today"
      const customToday = new Date();
      // Set the date string using the date object
      const todayString = customToday.toISOString().split('T')[0];
      
      // Create a date object for "yesterday"
      const customYesterday = new Date(customToday);
      customYesterday.setDate(customYesterday.getDate() - 1);
      // Set the date string using the date object
      const yesterdayString = customYesterday.toISOString().split('T')[0];
      
      // Set up yesterday with some chores
      profile.history[yesterdayString] = {
        date: yesterdayString,
        chores: [
          { id: 0, text: 'Test chore 1', status: 'completed' as ChoreStatus },
          { id: 1, text: 'Test chore 2', status: 'incomplete' as ChoreStatus }
        ],
        playTime: { totalMinutes: 0, sessions: [] },
        xp: { gained: 10, penalties: 0, final: 10 },
        completed: false
      };
      
      // Finalize yesterday
      const updatedProfile = finalizeDayProgress(profile, yesterdayString);
      
      // Verify yesterday was finalized
      expect(updatedProfile.history[yesterdayString].completed).toBe(true);
      
      // Verify penalties
      expect(updatedProfile.history[yesterdayString].xp.penalties).toBe(APP_CONFIG.PROFILE.XP_PENALTY_FOR_CHORE);
      expect(updatedProfile.history[yesterdayString].xp.final).toBe(0); // 10 - 10 = 0
    });
  });

  describe('Rewards Edge Cases', () => {
    test('Should handle using a reward with no rewards available', () => {
      const profile = createTestProfile();
      const today = getLocalDateString();
      
      // Setup today's record
      profile.history[today] = {
        date: today,
        chores: [],
        playTime: { totalMinutes: 0, sessions: [] },
        xp: { gained: 0, penalties: 0, final: 0 },
        completed: false,
        rewardsUsed: []
      };
      
      // Ensure zero rewards available
      profile.rewards.available = 0;
      
      // Try to use a reward
      const updatedProfile = useReward(
        profile,
        RewardType.EXTEND_PLAY_TIME,
        60
      );
      
      // Should leave profile unchanged
      expect(updatedProfile.rewards.available).toBe(0);
      expect(updatedProfile.history[today].rewardsUsed?.length || 0).toBe(0);
    });
    
    test('Should handle multiple rewards used on the same day', () => {
      const profile = createTestProfile();
      const today = getLocalDateString();
      
      // Setup today's record
      profile.history[today] = {
        date: today,
        chores: [],
        playTime: { totalMinutes: 0, sessions: [] },
        xp: { gained: 0, penalties: 0, final: 0 },
        completed: false,
        rewardsUsed: []
      };
      
      // Give 3 rewards
      profile.rewards.available = 3;
      
      // Use three different reward combinations
      let tempProfile = useReward(profile, RewardType.EXTEND_PLAY_TIME, 60);
      tempProfile = useReward(tempProfile, RewardType.REDUCE_COOLDOWN, 30);
      tempProfile = useReward(tempProfile, RewardType.EXTEND_PLAY_TIME, 120);
      
      // Verify all rewards were used
      expect(tempProfile.rewards.available).toBe(0);
      
      // Verify all rewards were recorded
      expect(tempProfile.history[today].rewardsUsed?.length).toBe(3);
      expect(tempProfile.history[today].rewardsUsed?.map(r => r.type)).toContain(RewardType.EXTEND_PLAY_TIME);
      expect(tempProfile.history[today].rewardsUsed?.map(r => r.type)).toContain(RewardType.REDUCE_COOLDOWN);
      
      // Verify values were recorded properly
      expect(tempProfile.history[today].rewardsUsed?.find(r => r.value === 120)).toBeDefined();
      expect(tempProfile.history[today].rewardsUsed?.find(r => r.value === 30)).toBeDefined();
    });
  });

  describe('Chore Status Transitions', () => {
    test('Should handle all transitions between chore statuses', () => {
      let profile = createTestProfile();
      const today = getLocalDateString();
      
      // Setup today's record
      profile.history[today] = {
        date: today,
        chores: [
          { id: 0, text: 'Test chore', status: 'incomplete' as ChoreStatus }
        ],
        playTime: { totalMinutes: 0, sessions: [] },
        xp: { gained: 0, penalties: 0, final: 0 },
        completed: false
      };
      
      // Cycle 1: incomplete -> completed
      profile = updateChoreStatus(profile, 0, 'completed');
      expect(profile.history[today].chores[0].status).toBe('completed');
      expect(profile.history[today].xp.gained).toBe(APP_CONFIG.PROFILE.XP_FOR_CHORE);
      
      // Cycle 2: completed -> na
      profile = updateChoreStatus(profile, 0, 'na');
      expect(profile.history[today].chores[0].status).toBe('na');
      expect(profile.history[today].xp.gained).toBe(0); // XP removed
      
      // Cycle 3: na -> incomplete
      profile = updateChoreStatus(profile, 0, 'incomplete');
      expect(profile.history[today].chores[0].status).toBe('incomplete');
      expect(profile.history[today].xp.gained).toBe(0);
      
      // Cycle 4: incomplete -> na -> completed
      profile = updateChoreStatus(profile, 0, 'na');
      profile = updateChoreStatus(profile, 0, 'completed');
      expect(profile.history[today].chores[0].status).toBe('completed');
      expect(profile.history[today].xp.gained).toBe(APP_CONFIG.PROFILE.XP_FOR_CHORE);
    });
    
    test('Should handle invalid chore ID', () => {
      const profile = createTestProfile();
      const today = getLocalDateString();
      
      // Setup today's record
      profile.history[today] = {
        date: today,
        chores: [
          { id: 0, text: 'Test chore', status: 'incomplete' as ChoreStatus }
        ],
        playTime: { totalMinutes: 0, sessions: [] },
        xp: { gained: 0, penalties: 0, final: 0 },
        completed: false
      };
      
      // Try to update a non-existent chore
      const updatedProfile = updateChoreStatus(profile, 999, 'completed');
      
      // Profile should remain unchanged
      expect(updatedProfile).toEqual(profile);
      expect(updatedProfile.history[today].xp.gained).toBe(0);
    });
  });
}); 