import { 
  calculatePlayerStats,
  PlayerProfile,
  DayProgress,
  ChoreStatus,
  initializeDay,
  finalizeDayProgress,
  createDayProgress,
  checkAndFinalizePreviousDays,
  updateChoreStatus,
  useReward
} from '../playerProfile';
import { APP_CONFIG } from '../config';
import { getLocalDateString, getPreviousDateString, parseLocalDate } from '../utils';
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

describe('Timer Functionality and Day Transitions', () => {
  // Utility function to create a test profile
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

  describe('Day Initialization and Transitions', () => {
    test('Should create a new day with default chores', () => {
      const profile = createTestProfile();
      const today = getLocalDateString();
      
      // Initialize today
      const updatedProfile = initializeDay(profile);
      
      // Verify today exists in history
      expect(updatedProfile.history[today]).toBeDefined();
      
      // Verify chores are created with the correct structure
      const todayProgress = updatedProfile.history[today];
      expect(todayProgress.chores.length).toBe(APP_CONFIG.CHORES.length);
      
      // Verify all chores are initially incomplete
      todayProgress.chores.forEach(chore => {
        expect(chore.status).toBe('incomplete');
      });
      
      // Verify XP structure
      expect(todayProgress.xp).toEqual({
        gained: 0,
        penalties: 0,
        final: 0
      });
      
      // Verify playTime structure
      expect(todayProgress.playTime).toEqual({
        totalMinutes: 0,
        sessions: []
      });
      
      // Verify the day is not completed
      expect(todayProgress.completed).toBe(false);
    });
    
    test('Should finalize previous day with penalties when creating a new day', () => {
      const profile = createTestProfile();
      
      // Create yesterday's date
      const today = getLocalDateString();
      const yesterday = getPreviousDateString(today);
      
      // Set up yesterday with incomplete chores
      profile.history[yesterday] = createDayProgress(yesterday);
      
      // Modify some chores to be incomplete
      profile.history[yesterday].chores.forEach((chore, index) => {
        // Make every third chore incomplete
        if (index % 3 === 0) {
          chore.status = 'incomplete';
        } else {
          chore.status = 'completed';
        }
      });
      
      // Count completed chores to calculate XP gained
      const completedCount = profile.history[yesterday].chores.filter(
        chore => chore.status === 'completed'
      ).length;
      const expectedGain = completedCount * APP_CONFIG.PROFILE.XP_FOR_CHORE;
      
      // Set the initial XP gained value
      profile.history[yesterday].xp.gained = expectedGain;
      profile.history[yesterday].xp.final = expectedGain;
      
      // Initialize today, which should finalize yesterday
      const updatedProfile = initializeDay(profile);
      
      // Verify yesterday was finalized
      expect(updatedProfile.history[yesterday].completed).toBe(true);
      
      // Count incomplete chores from yesterday
      const incompleteCount = updatedProfile.history[yesterday].chores.filter(
        chore => chore.status === 'incomplete'
      ).length;
      
      // Verify penalties were applied
      const expectedPenalty = incompleteCount * APP_CONFIG.PROFILE.XP_PENALTY_FOR_CHORE;
      expect(updatedProfile.history[yesterday].xp.penalties).toBe(expectedPenalty);
      
      // Verify net XP is correct
      expect(updatedProfile.history[yesterday].xp.gained).toBe(expectedGain);
      expect(updatedProfile.history[yesterday].xp.final).toBe(expectedGain - expectedPenalty);
    });
    
    test('Should check and finalize multiple previous days', () => {
      const profile = createTestProfile();
      
      // Create dates for the last 3 days
      const today = getLocalDateString();
      const yesterday = getPreviousDateString(today);
      const twoDaysAgo = getPreviousDateString(yesterday);
      const threeDaysAgo = getPreviousDateString(twoDaysAgo);
      
      // Set up previous days with incomplete chores
      profile.history[yesterday] = createDayProgress(yesterday);
      profile.history[twoDaysAgo] = createDayProgress(twoDaysAgo);
      profile.history[threeDaysAgo] = createDayProgress(threeDaysAgo);
      
      // Ensure none are completed
      profile.history[yesterday].completed = false;
      profile.history[twoDaysAgo].completed = false;
      profile.history[threeDaysAgo].completed = false;
      
      // Add some completed chores to each day
      const daysToModify = [yesterday, twoDaysAgo, threeDaysAgo];
      daysToModify.forEach(day => {
        profile.history[day].chores.forEach((chore, index) => {
          // Make some chores completed based on index
          if (index % 2 === 0) {
            chore.status = 'completed';
          } else {
            chore.status = 'incomplete';
          }
        });
      });
      
      // Finalize all previous days
      const updatedProfile = checkAndFinalizePreviousDays(profile);
      
      // Verify all previous days were finalized
      daysToModify.forEach(day => {
        expect(updatedProfile.history[day].completed).toBe(true);
        
        // Verify penalties were applied correctly
        const incompleteCount = updatedProfile.history[day].chores.filter(
          chore => chore.status === 'incomplete'
        ).length;
        
        const expectedPenalty = incompleteCount * APP_CONFIG.PROFILE.XP_PENALTY_FOR_CHORE;
        expect(updatedProfile.history[day].xp.penalties).toBe(expectedPenalty);
      });
    });
  });

  describe('Chore Status Updates', () => {
    test('Should update chore status and add XP when completing a chore', () => {
      const profile = createTestProfile();
      const today = getLocalDateString();
      
      // Initialize today
      profile.history[today] = createDayProgress(today);
      
      // Update first chore to completed
      const updatedProfile = updateChoreStatus(profile, 0, 'completed');
      
      // Verify chore status was updated
      expect(updatedProfile.history[today].chores[0].status).toBe('completed');
      
      // Verify completedAt timestamp was added
      expect(updatedProfile.history[today].chores[0].completedAt).toBeDefined();
      
      // Verify XP was added
      expect(updatedProfile.history[today].xp.gained).toBe(APP_CONFIG.PROFILE.XP_FOR_CHORE);
      expect(updatedProfile.history[today].xp.final).toBe(APP_CONFIG.PROFILE.XP_FOR_CHORE);
    });
    
    test('Should remove XP when un-completing a chore', () => {
      const profile = createTestProfile();
      const today = getLocalDateString();
      
      // Initialize today
      profile.history[today] = createDayProgress(today);
      
      // Complete the first chore
      let updatedProfile = updateChoreStatus(profile, 0, 'completed');
      
      // Verify initial XP gain
      expect(updatedProfile.history[today].xp.gained).toBe(APP_CONFIG.PROFILE.XP_FOR_CHORE);
      
      // Now un-complete the chore
      updatedProfile = updateChoreStatus(updatedProfile, 0, 'incomplete');
      
      // Verify chore status was updated
      expect(updatedProfile.history[today].chores[0].status).toBe('incomplete');
      
      // Verify completedAt timestamp was removed
      expect(updatedProfile.history[today].chores[0].completedAt).toBeUndefined();
      
      // Verify XP was removed
      expect(updatedProfile.history[today].xp.gained).toBe(0);
      expect(updatedProfile.history[today].xp.final).toBe(0);
    });
    
    test('Should handle N/A chore status correctly', () => {
      const profile = createTestProfile();
      const today = getLocalDateString();
      
      // Initialize today
      profile.history[today] = createDayProgress(today);
      
      // Mark first chore as completed, then N/A
      let updatedProfile = updateChoreStatus(profile, 0, 'completed');
      updatedProfile = updateChoreStatus(updatedProfile, 0, 'na');
      
      // Verify chore status was updated to N/A
      expect(updatedProfile.history[today].chores[0].status).toBe('na');
      
      // Verify completedAt timestamp was removed
      expect(updatedProfile.history[today].chores[0].completedAt).toBeUndefined();
      
      // Verify XP was removed (since it's no longer completed)
      expect(updatedProfile.history[today].xp.gained).toBe(0);
      expect(updatedProfile.history[today].xp.final).toBe(0);
    });
    
    test('Should track XP correctly with mixed chore statuses', () => {
      let profile = createTestProfile();
      const today = getLocalDateString();
      
      // Initialize today
      profile.history[today] = createDayProgress(today);
      
      // Set up various chore statuses
      // Complete 5 chores
      for (let i = 0; i < 5; i++) {
        profile = updateChoreStatus(profile, i, 'completed');
      }
      
      // Mark 3 chores as N/A
      for (let i = 5; i < 8; i++) {
        profile = updateChoreStatus(profile, i, 'na');
      }
      
      // Leave the rest incomplete
      
      // Verify XP calculation
      expect(profile.history[today].xp.gained).toBe(5 * APP_CONFIG.PROFILE.XP_FOR_CHORE);
      expect(profile.history[today].xp.final).toBe(5 * APP_CONFIG.PROFILE.XP_FOR_CHORE);
      
      // Finalize the day - fix the type issue
      const finalizedProfile = finalizeDayProgress(profile, today);
      // Merge the finalized profile with our profile that has level info
      profile = {
        ...profile,
        history: finalizedProfile.history
      };
      
      // Count incomplete chores
      const incompleteCount = profile.history[today].chores.filter(
        chore => chore.status === 'incomplete'
      ).length;
      
      // Verify penalties were applied
      const expectedPenalty = incompleteCount * APP_CONFIG.PROFILE.XP_PENALTY_FOR_CHORE;
      expect(profile.history[today].xp.penalties).toBe(expectedPenalty);
      
      // Verify final XP is correct
      expect(profile.history[today].xp.final).toBe(
        5 * APP_CONFIG.PROFILE.XP_FOR_CHORE - expectedPenalty
      );
    });
  });

  describe('Timer-Based Reward System', () => {
    test('Should correctly apply play time extension reward', () => {
      const profile = createTestProfile();
      const today = getLocalDateString();
      
      // Initialize today and add some rewards
      profile.history[today] = createDayProgress(today);
      profile.rewards.available = 2;
      
      // Record the default play time from config
      const originalPlayTime = APP_CONFIG.TIMER.PLAY_TIME_MINUTES;
      
      // Use the extend play time reward
      const updatedProfile = useReward(
        profile,
        RewardType.EXTEND_PLAY_TIME,
        60
      );
      
      // Verify reward was used
      expect(updatedProfile.rewards.available).toBe(1);
      
      // Verify reward was added to history
      expect(updatedProfile.history[today].rewardsUsed.length).toBe(1);
      expect(updatedProfile.history[today].rewardsUsed[0].type).toBe(RewardType.EXTEND_PLAY_TIME);
      expect(updatedProfile.history[today].rewardsUsed[0].value).toBe(60);
      
      // In the renderer, this would add 60 minutes to play time
      // We can't test this directly without mocking the renderer,
      // but we can verify the reward data structure is correct
    });
    
    test('Should correctly apply cooldown reduction reward', () => {
      const profile = createTestProfile();
      const today = getLocalDateString();
      
      // Initialize today and add some rewards
      profile.history[today] = createDayProgress(today);
      profile.rewards.available = 2;
      
      // Record the default cooldown time from config
      const originalCooldownTime = APP_CONFIG.TIMER.COOLDOWN_TIME_MINUTES;
      
      // Use the reduce cooldown reward
      const updatedProfile = useReward(
        profile,
        RewardType.REDUCE_COOLDOWN,
        60
      );
      
      // Verify reward was used
      expect(updatedProfile.rewards.available).toBe(1);
      
      // Verify reward was added to history
      expect(updatedProfile.history[today].rewardsUsed.length).toBe(1);
      expect(updatedProfile.history[today].rewardsUsed[0].type).toBe(RewardType.REDUCE_COOLDOWN);
      expect(updatedProfile.history[today].rewardsUsed[0].value).toBe(60);
      
      // In the renderer, this would reduce cooldown time by 60 minutes
      // We can't test this directly without mocking the renderer,
      // but we can verify the reward data structure is correct
    });
  });
}); 