import { APP_CONFIG } from '../config';
import {
  calculatePlayerStats,
  PlayerProfile,
  DayProgress,
  finalizeDayProgress,
  ChoreStatus
} from '../playerProfile';

describe('Level Down Simulation Tests', () => {
  // Helper function to create a day's progress with specific completion
  function createDayProgress(date: string, completedCount: number, incompleteCount: number): DayProgress {
    const statuses: ChoreStatus[] = [];

    // Add completed chores
    for (let i = 0; i < completedCount; i++) {
      statuses.push('completed');
    }

    // Add incomplete chores
    for (let i = 0; i < incompleteCount; i++) {
      statuses.push('incomplete');
    }

    // Calculate XP
    const xpGained = completedCount * APP_CONFIG.PROFILE.XP_FOR_CHORE;

    return {
      date,
      chores: statuses.map((status, i) => ({
        id: i,
        text: `Chore ${i + 1}`,
        status
      })),
      playTime: {
        sessions: [{
          start: `${date}T08:00:00`,
          end: `${date}T09:00:00`
        }]
      },
      xp: {
        gained: xpGained,
        penalties: 0, // Will be set during finalization
        final: xpGained // Will be updated during finalization
      },
      completed: false // Not finalized yet
    };
  }

  describe('Level Down Behavior', () => {
    let profile: PlayerProfile;
    let initialStats: ReturnType<typeof calculatePlayerStats>;

    beforeEach(() => {
      // Create profile with exactly 850 XP (level 2 with 10 XP into it)
      profile = {
        history: {
          '2023-01-01': {
            date: '2023-01-01',
            chores: [],
            playTime: { sessions: [] },
            xp: {
              gained: 850,
              penalties: 0,
              final: 850
            },
            completed: true
          }
        },
        rewards: {
          available: 0,
          permanent: {}
        }
      };

      // Calculate initial stats
      initialStats = calculatePlayerStats(profile);
    });

    test('Should start at level 2 with 10 XP', () => {
      // Verify initial state
      expect(initialStats.level).toBe(2);
      expect(initialStats.xp).toBe(10);
      expect(initialStats.xpToNextLevel).toBe(960);

      // Check total XP
      const totalXP = Object.values(profile.history).reduce((sum, day) => sum + day.xp.final, 0);
      expect(totalXP).toBe(850); // 840 + 10
    });

    test('Should maintain level with small XP loss', () => {
      // Add day with small XP loss (not enough to level down)
      const smallLossDay = '2023-01-02';
      profile.history[smallLossDay] = createDayProgress(smallLossDay, 0, 5);

      // Finalize day to apply penalties
      const updatedProfile1 = finalizeDayProgress(profile, smallLossDay);
      Object.assign(profile, updatedProfile1);

      // Check new stats
      const stats = calculatePlayerStats(profile);

      // Verify day XP values
      expect(profile.history[smallLossDay].xp.gained).toBe(0);
      expect(profile.history[smallLossDay].xp.penalties).toBe(50);
      expect(profile.history[smallLossDay].xp.final).toBe(-50);

      // Verify level stats are maintained
      expect(stats.level).toBe(2);
      expect(stats.xp).toBe(10);

      // Check that only positive days are counted in total
      const positiveXpTotal = Object.values(profile.history).reduce(
        (sum, day) => sum + (day.xp.final > 0 ? day.xp.final : 0), 0
      );
      expect(positiveXpTotal).toBe(850);
    });

    test('Should maintain level with larger XP loss', () => {
      // Add day with larger XP loss
      const levelDownDay = '2023-01-03';
      profile.history[levelDownDay] = createDayProgress(levelDownDay, 0, 10);

      // Finalize day to apply penalties
      const updatedProfile2 = finalizeDayProgress(profile, levelDownDay);
      Object.assign(profile, updatedProfile2);

      // Check new stats
      const stats = calculatePlayerStats(profile);

      // Verify day XP values
      expect(profile.history[levelDownDay].xp.gained).toBe(0);
      expect(profile.history[levelDownDay].xp.penalties).toBe(100);
      expect(profile.history[levelDownDay].xp.final).toBe(-100);

      // Verify level stats are maintained (negative days should not reduce level)
      expect(stats.level).toBe(2);
      expect(stats.xp).toBe(10);

      // Calculate only positive XP total
      const positiveXpTotal = Object.values(profile.history).reduce(
        (sum, day) => sum + (day.xp.final > 0 ? day.xp.final : 0), 0
      );
      expect(positiveXpTotal).toBe(850);
    });

    test('Should add XP correctly on positive day', () => {
      // Add a positive day to gain additional XP
      const regainDay = '2023-01-04';
      profile.history[regainDay] = createDayProgress(regainDay, 12, 0);

      // Finalize day
      const updatedProfile3 = finalizeDayProgress(profile, regainDay);
      Object.assign(profile, updatedProfile3);

      // Check new stats
      const stats = calculatePlayerStats(profile);

      // Verify day XP values
      expect(profile.history[regainDay].xp.gained).toBe(120);
      expect(profile.history[regainDay].xp.penalties).toBe(0);
      expect(profile.history[regainDay].xp.final).toBe(120);

      // Verify level stats are updated correctly
      expect(stats.level).toBe(2);
      expect(stats.xp).toBe(130); // 10 + 120 = 130

      // Calculate positive XP total
      const positiveXpTotal = Object.values(profile.history).reduce(
        (sum, day) => sum + (day.xp.final > 0 ? day.xp.final : 0), 0
      );
      expect(positiveXpTotal).toBe(970); // 850 + 120 = 970
    });

    test('Should decrease level when reducing initial XP', () => {
      // Replace initial day with much lower XP
      delete profile.history['2023-01-01'];
      profile.history['2023-01-01'] = {
        date: '2023-01-01',
        chores: [],
        playTime: { sessions: [] },
        xp: {
          gained: 400, // Much less than before
          penalties: 0,
          final: 400
        },
        completed: true
      };

      // Add a positive day
      const regainDay = '2023-01-04';
      profile.history[regainDay] = createDayProgress(regainDay, 12, 0);
      const updatedProfile = finalizeDayProgress(profile, regainDay);
      Object.assign(profile, updatedProfile);

      // Check new stats after reducing initial XP
      const stats = calculatePlayerStats(profile);

      // Calculate positive XP total
      const positiveXpTotal = Object.values(profile.history).reduce(
        (sum, day) => sum + (day.xp.final > 0 ? day.xp.final : 0), 0
      );
      expect(positiveXpTotal).toBe(520); // 400 + 120 = 520

      // Verify we're now at level 1 since total XP is below 840
      expect(stats.level).toBe(1);
      expect(stats.xp).toBe(520);
      expect(stats.xpToNextLevel).toBe(840);
    });
  });
}); 