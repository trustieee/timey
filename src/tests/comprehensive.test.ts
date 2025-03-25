import { APP_CONFIG } from '../config';
import {
  getXpRequiredForLevel,
  calculatePlayerStats,
  PlayerProfile,
  DayProgress,
  finalizeDayProgress,
  ChoreStatus
} from '../playerProfile';

describe('Comprehensive XP & Leveling Tests', () => {
  // PART 1: XP REQUIREMENTS VERIFICATION
  describe('XP Requirements Verification', () => {
    test('Should have correct XP requirements for different levels', () => {
      // Verify XP required for different levels
      expect(getXpRequiredForLevel(1)).toBe(840); // Should be 840 (7 days)
      expect(getXpRequiredForLevel(2)).toBe(960); // Should be 960 (8 days)
      expect(getXpRequiredForLevel(3)).toBe(1080); // Should be 1080 (9 days)
      expect(getXpRequiredForLevel(4)).toBe(1200); // Should be 1200 (10 days)
      expect(getXpRequiredForLevel(5)).toBe(1200); // Should be 1200 (10 days)
      expect(getXpRequiredForLevel(10)).toBe(1200); // Should be 1200 (10 days)
    });

    test('XP formula should match configuration', () => {
      for (let level = 1; level <= 5; level++) {
        const xpRequired = getXpRequiredForLevel(level);
        const daysNeeded = xpRequired / (APP_CONFIG.PROFILE.XP_FOR_CHORE * 12);

        // Check that lower levels have progressively less XP required
        if (level < 4) {
          expect(xpRequired).toBeLessThan(getXpRequiredForLevel(level + 1));
        } else {
          // Levels 4 and above should have the same XP requirement
          expect(xpRequired).toBe(getXpRequiredForLevel(level + 1));
        }

        // Check that XP required is in multiples of days (each day = 12 chores * XP per chore)
        expect(daysNeeded).toBeCloseTo(Math.floor(daysNeeded + 0.1), 1);
      }
    });
  });

  // PART 2: LEVEL CALCULATION FROM TOTAL XP
  describe('Level Calculation From Total XP', () => {
    function testProfileWithXp(totalXp: number): PlayerProfile {
      // Create a mock profile with a single day containing the given XP
      return {
        history: {
          '2025-01-01': {
            date: '2025-01-01',
            chores: [],
            playTime: { sessions: [] },
            xp: {
              gained: totalXp,
              penalties: 0,
              final: totalXp
            },
            completed: true
          }
        },
        rewards: {
          available: 0,
          permanent: {}
        }
      };
    }

    test('Should calculate correct level and XP progress from total XP', () => {
      // Test a range of XP values and verify level and progress
      const testCases = [
        { xp: 0, expectedLevel: 1, expectedProgress: 0 },
        { xp: 839, expectedLevel: 1, expectedProgress: 839 },
        { xp: 840, expectedLevel: 2, expectedProgress: 0 },
        { xp: 1799, expectedLevel: 2, expectedProgress: 959 },
        { xp: 1800, expectedLevel: 3, expectedProgress: 0 },
        { xp: 2879, expectedLevel: 3, expectedProgress: 1079 },
        { xp: 2880, expectedLevel: 4, expectedProgress: 0 },
        { xp: 4080, expectedLevel: 5, expectedProgress: 0 },
        { xp: 5280, expectedLevel: 6, expectedProgress: 0 },
        { xp: 10000, expectedLevel: 9, expectedProgress: 1120 }
      ];

      testCases.forEach(({ xp, expectedLevel, expectedProgress }) => {
        const profile = testProfileWithXp(xp);
        const stats = calculatePlayerStats(profile);

        expect(stats.level).toBe(expectedLevel);
        expect(stats.xp).toBe(expectedProgress);
      });
    });
  });

  // PART 3: MULTI-DAY XP CALCULATION
  describe('Multi-Day XP Calculation', () => {
    test('Should correctly total XP from multiple days', () => {
      const multiDayProfile: PlayerProfile = {
        history: {
          '2025-01-01': {
            date: '2025-01-01',
            chores: [
              { id: 0, text: 'Task 1', status: 'completed' as ChoreStatus, completedAt: '2025-01-01T08:00:00' },
              { id: 1, text: 'Task 2', status: 'completed' as ChoreStatus, completedAt: '2025-01-01T09:00:00' }
            ],
            playTime: {
              sessions: [{ start: '2025-01-01T08:00:00', end: '2025-01-01T09:00:00' }]
            },
            xp: {
              gained: 120,
              penalties: 0,
              final: 120
            },
            completed: true
          },
          '2025-01-02': {
            date: '2025-01-02',
            chores: [],
            playTime: { sessions: [] },
            xp: {
              gained: 100,
              penalties: 20,
              final: 80
            },
            completed: true
          },
          '2025-01-03': {
            date: '2025-01-03',
            chores: [],
            playTime: { sessions: [] },
            xp: {
              gained: 90,
              penalties: 10,
              final: 80
            },
            completed: true
          }
        },
        rewards: {
          available: 0,
          permanent: {}
        }
      };

      const multiDayStats = calculatePlayerStats(multiDayProfile);

      // Check that level and XP progress are correct
      expect(multiDayStats.level).toBe(1);
      expect(multiDayStats.xp).toBe(280);
      expect(multiDayStats.xpToNextLevel).toBe(840);
    });
  });

  // PART 4: DAY SIMULATION WITH LEVEL PROGRESSION
  describe('Day Simulation with Level Progression', () => {
    test('Should correctly level up after accumulating sufficient XP', () => {
      // Create a profile with empty history
      const simulationProfile: PlayerProfile & { level: number, xp: number, xpToNextLevel: number } = {
        history: {},
        rewards: {
          available: 0,
          permanent: {}
        },
        level: 1,
        xp: 0,
        xpToNextLevel: getXpRequiredForLevel(1)
      };

      // Helper to create a day entry
      function createDay(date: string, completedChores: number): DayProgress {
        const xpGained = completedChores * APP_CONFIG.PROFILE.XP_FOR_CHORE;

        return {
          date,
          chores: Array(12).fill(0).map((_, i) => ({
            id: i,
            text: `Chore ${i + 1}`,
            status: i < completedChores ? 'completed' : 'incomplete'
          })),
          playTime: {
            sessions: [{
              start: `${date}T08:00:00`,
              end: `${date}T09:00:00`
            }]
          },
          xp: {
            gained: xpGained,
            penalties: 0, // No penalties during the day
            final: xpGained
          },
          completed: true
        };
      }

      // Specific completion pattern to control level progression
      const completionPattern = [
        12, 12, 12, 12, 12, 12, 12, // 7 days with all tasks = 840 XP (level 2)
        12, 12, 12, 12, 12, 12, 12, 12, // 8 days with all tasks = 960 XP (level 3)
      ];

      // Add days one by one and verify level progression
      let day = 1;

      for (const completedChores of completionPattern) {
        // Format date as YYYY-MM-DD
        const date = new Date(2025, 0, day).toISOString().split('T')[0];

        // Add the day to history
        simulationProfile.history[date] = createDay(date, completedChores);

        // Recalculate stats
        const stats = calculatePlayerStats(simulationProfile);
        simulationProfile.level = stats.level;
        simulationProfile.xp = stats.xp;
        simulationProfile.xpToNextLevel = stats.xpToNextLevel;

        // Check for level ups at expected points
        if (day === 7) {
          expect(simulationProfile.level).toBe(2);
          expect(simulationProfile.xp).toBe(0);
        } else if (day === 5) {
          expect(simulationProfile.level).toBe(1);
          expect(simulationProfile.xp).toBe(600);
        } else if (day === 10) {
          expect(simulationProfile.level).toBe(2);
          expect(simulationProfile.xp).toBe(360);
        } else if (day === 15) {
          expect(simulationProfile.level).toBe(3);
          expect(simulationProfile.xp).toBe(0);
        }

        day++;
      }
    });
  });

  // PART 5: XP PENALTIES & TASK STATUS TESTS
  describe('XP Penalties & Task Status Tests', () => {
    // Helper function to create a day with specific chore statuses
    function createDayWithChores(
      date: string,
      choreStatuses: ChoreStatus[]
    ): DayProgress {
      // Count completed chores to calculate gained XP
      const completedCount = choreStatuses.filter(status => status === 'completed').length;
      const xpGained = completedCount * APP_CONFIG.PROFILE.XP_FOR_CHORE;

      return {
        date,
        chores: choreStatuses.map((status, i) => ({
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
          penalties: 0, // Penalties will be calculated during finalization
          final: xpGained // Will be updated during finalization
        },
        completed: false // Not finalized yet
      };
    }

    test('Should correctly handle day with all chores completed', () => {
      // Create test profile
      let penaltyProfile: PlayerProfile = {
        history: {},
        rewards: {
          available: 0,
          permanent: {}
        }
      };

      // Setup day with all chores completed
      const allCompletedDay = '2025-01-01';
      penaltyProfile.history[allCompletedDay] = createDayWithChores(
        allCompletedDay,
        Array(12).fill('completed' as ChoreStatus)
      );

      // Finalize day
      penaltyProfile = finalizeDayProgress(penaltyProfile, allCompletedDay) as PlayerProfile;

      // After finalization
      const afterXp = penaltyProfile.history[allCompletedDay].xp;

      // Expectations
      expect(afterXp.gained).toBe(12 * APP_CONFIG.PROFILE.XP_FOR_CHORE);
      expect(afterXp.penalties).toBe(0);
      expect(afterXp.final).toBe(12 * APP_CONFIG.PROFILE.XP_FOR_CHORE);
    });

    test('Should correctly apply penalties for incomplete chores', () => {
      // Create test profile
      let penaltyProfile: PlayerProfile = {
        history: {},
        rewards: {
          available: 0,
          permanent: {}
        }
      };

      // Setup day with 8 completed, 4 incomplete
      const someIncompleteDay = '2025-01-01';
      penaltyProfile.history[someIncompleteDay] = createDayWithChores(
        someIncompleteDay,
        [
          'completed', 'completed', 'completed',
          'completed', 'completed', 'completed',
          'completed', 'completed', 'incomplete',
          'incomplete', 'incomplete', 'incomplete'
        ]
      );

      // Finalize day
      penaltyProfile = finalizeDayProgress(penaltyProfile, someIncompleteDay) as PlayerProfile;

      // After finalization
      const afterXp = penaltyProfile.history[someIncompleteDay].xp;

      // Expectations
      expect(afterXp.gained).toBe(8 * APP_CONFIG.PROFILE.XP_FOR_CHORE);
      expect(afterXp.penalties).toBe(4 * APP_CONFIG.PROFILE.XP_PENALTY_FOR_CHORE);
      expect(afterXp.final).toBe(8 * APP_CONFIG.PROFILE.XP_FOR_CHORE - 4 * APP_CONFIG.PROFILE.XP_PENALTY_FOR_CHORE);
    });

    test('Should not apply penalties for N/A chores', () => {
      // Create test profile
      let penaltyProfile: PlayerProfile = {
        history: {},
        rewards: {
          available: 0,
          permanent: {}
        }
      };

      // Setup day with 6 completed, 6 N/A
      const naChoresday = '2025-01-01';
      penaltyProfile.history[naChoresday] = createDayWithChores(
        naChoresday,
        [
          'completed', 'completed', 'completed',
          'completed', 'completed', 'completed',
          'na', 'na', 'na',
          'na', 'na', 'na'
        ]
      );

      // Finalize day
      penaltyProfile = finalizeDayProgress(penaltyProfile, naChoresday) as PlayerProfile;

      // After finalization
      const afterXp = penaltyProfile.history[naChoresday].xp;

      // Expectations
      expect(afterXp.gained).toBe(6 * APP_CONFIG.PROFILE.XP_FOR_CHORE);
      expect(afterXp.penalties).toBe(0); // No penalties for N/A
      expect(afterXp.final).toBe(6 * APP_CONFIG.PROFILE.XP_FOR_CHORE);
    });

    test('Should correctly handle mixed statuses', () => {
      // Create test profile
      let penaltyProfile: PlayerProfile = {
        history: {},
        rewards: {
          available: 0,
          permanent: {}
        }
      };

      // Setup day with mix of completed, incomplete, and N/A
      const mixedDay = '2025-01-01';
      penaltyProfile.history[mixedDay] = createDayWithChores(
        mixedDay,
        [
          'completed', 'completed', 'completed',
          'completed', 'incomplete', 'incomplete',
          'incomplete', 'na', 'na',
          'na', 'na', 'na'
        ]
      );

      // Finalize day
      penaltyProfile = finalizeDayProgress(penaltyProfile, mixedDay) as PlayerProfile;

      // After finalization
      const afterXp = penaltyProfile.history[mixedDay].xp;

      // Expectations
      expect(afterXp.gained).toBe(4 * APP_CONFIG.PROFILE.XP_FOR_CHORE);
      expect(afterXp.penalties).toBe(3 * APP_CONFIG.PROFILE.XP_PENALTY_FOR_CHORE);
      expect(afterXp.final).toBe(4 * APP_CONFIG.PROFILE.XP_FOR_CHORE - 3 * APP_CONFIG.PROFILE.XP_PENALTY_FOR_CHORE);
    });

    test('Should calculate correct total stats across multiple days', () => {
      // Create test profile
      let penaltyProfile: PlayerProfile = {
        history: {},
        rewards: {
          available: 0,
          permanent: {}
        }
      };

      // Day 1: 12 completed
      const day1 = '2025-01-01';
      penaltyProfile.history[day1] = createDayWithChores(
        day1,
        Array(12).fill('completed' as ChoreStatus)
      );
      penaltyProfile = finalizeDayProgress(penaltyProfile, day1) as PlayerProfile;

      // Day 2: 8 completed, 4 incomplete
      const day2 = '2025-01-02';
      penaltyProfile.history[day2] = createDayWithChores(
        day2,
        [
          'completed', 'completed', 'completed',
          'completed', 'completed', 'completed',
          'completed', 'completed', 'incomplete',
          'incomplete', 'incomplete', 'incomplete'
        ]
      );
      penaltyProfile = finalizeDayProgress(penaltyProfile, day2) as PlayerProfile;

      // Day 3: 6 completed, 6 N/A
      const day3 = '2025-01-03';
      penaltyProfile.history[day3] = createDayWithChores(
        day3,
        [
          'completed', 'completed', 'completed',
          'completed', 'completed', 'completed',
          'na', 'na', 'na',
          'na', 'na', 'na'
        ]
      );
      penaltyProfile = finalizeDayProgress(penaltyProfile, day3) as PlayerProfile;

      // Day 4: 4 completed, 3 incomplete, 5 N/A
      const day4 = '2025-01-04';
      penaltyProfile.history[day4] = createDayWithChores(
        day4,
        [
          'completed', 'completed', 'completed',
          'completed', 'incomplete', 'incomplete',
          'incomplete', 'na', 'na',
          'na', 'na', 'na'
        ]
      );
      penaltyProfile = finalizeDayProgress(penaltyProfile, day4) as PlayerProfile;

      // Calculate total stats
      const penaltyStats = calculatePlayerStats(penaltyProfile);

      // Calculate expected total
      const expectedTotal =
        (12 * APP_CONFIG.PROFILE.XP_FOR_CHORE) + // Day 1: 12 completed
        (8 * APP_CONFIG.PROFILE.XP_FOR_CHORE - 4 * APP_CONFIG.PROFILE.XP_PENALTY_FOR_CHORE) + // Day 2: 8 completed, 4 incomplete
        (6 * APP_CONFIG.PROFILE.XP_FOR_CHORE) + // Day 3: 6 completed, 6 NA
        (4 * APP_CONFIG.PROFILE.XP_FOR_CHORE - 3 * APP_CONFIG.PROFILE.XP_PENALTY_FOR_CHORE); // Day 4: 4 completed, 3 incomplete, 5 NA

      // Check calculated XP matches expected
      expect(penaltyStats.level).toBe(1);
      expect(penaltyStats.xp).toBe(expectedTotal);
    });
  });

  // PART 6: LEVEL UP/DOWN WITH TASK STATUS CHANGES
  describe('Level Threshold Crossing', () => {
    test('Should level up when crossing XP threshold', () => {
      // Create a profile with 839 XP (1 XP away from level 2)
      const levelThresholdProfile: PlayerProfile = {
        history: {
          '2025-01-01': {
            date: '2025-01-01',
            chores: Array(12).fill(0).map((_, i) => ({
              id: i,
              text: `Chore ${i + 1}`,
              status: 'completed' as ChoreStatus
            })),
            playTime: { sessions: [] },
            xp: {
              gained: 839,
              penalties: 0,
              final: 839
            },
            completed: true
          }
        },
        rewards: {
          available: 0,
          permanent: {}
        }
      };

      // Verify starting state
      let thresholdStats = calculatePlayerStats(levelThresholdProfile);
      expect(thresholdStats.level).toBe(1);
      expect(thresholdStats.xp).toBe(839);

      // Add 1 XP to cross the threshold to level 2
      levelThresholdProfile.history['2025-01-02'] = {
        date: '2025-01-02',
        chores: [],
        playTime: { sessions: [] },
        xp: {
          gained: 1,
          penalties: 0,
          final: 1
        },
        completed: true
      };

      thresholdStats = calculatePlayerStats(levelThresholdProfile);
      expect(thresholdStats.level).toBe(2);
      expect(thresholdStats.xp).toBe(0);
    });

    test('Should return to previous level when XP is reduced', () => {
      // Start with a profile that's just reached level 2
      const levelThresholdProfile: PlayerProfile = {
        history: {
          '2025-01-01': {
            date: '2025-01-01',
            chores: [],
            playTime: { sessions: [] },
            xp: {
              gained: 839,
              penalties: 0,
              final: 839
            },
            completed: true
          },
          '2025-01-02': {
            date: '2025-01-02',
            chores: [],
            playTime: { sessions: [] },
            xp: {
              gained: 1,
              penalties: 0,
              final: 1
            },
            completed: true
          }
        },
        rewards: {
          available: 0,
          permanent: {}
        }
      };

      // Verify we're at level 2 with 0 XP
      let stats = calculatePlayerStats(levelThresholdProfile);
      expect(stats.level).toBe(2);
      expect(stats.xp).toBe(0);

      // Remove the second day's XP
      delete levelThresholdProfile.history['2025-01-02'];

      // Verify we're back to level 1
      stats = calculatePlayerStats(levelThresholdProfile);
      expect(stats.level).toBe(1);
      expect(stats.xp).toBe(839);
    });
  });

  // PART 7: PENALTIES AT DAY END AFFECTING LEVELS
  describe('Penalties at Day End', () => {
    test('Should maintain level when net XP is positive after penalties', () => {
      // Create a profile with exactly enough XP to be at level 2 with 0 XP into it
      let dayEndPenaltyProfile: PlayerProfile = {
        history: {
          '2025-01-01': {
            date: '2025-01-01',
            chores: Array(12).fill(0).map((_, i) => ({
              id: i,
              text: `Chore ${i + 1}`,
              status: 'completed' as ChoreStatus
            })),
            playTime: { sessions: [] },
            xp: {
              gained: 840,
              penalties: 0,
              final: 840
            },
            completed: true
          }
        },
        rewards: {
          available: 0,
          permanent: {}
        }
      };

      // Verify starting state is level 2 with 0 XP
      let dayEndStats = calculatePlayerStats(dayEndPenaltyProfile);
      expect(dayEndStats.level).toBe(2);
      expect(dayEndStats.xp).toBe(0);

      // Create a day that will result in net positive but with penalties
      // 7 completed (70 XP), 5 incomplete (-50 XP) = +20 XP net
      const penaltyTestDay = '2025-01-02';
      dayEndPenaltyProfile.history[penaltyTestDay] = {
        date: penaltyTestDay,
        chores: Array(12).fill(0).map((_, i) => ({
          id: i,
          text: `Chore ${i + 1}`,
          status: i < 7 ? 'completed' : 'incomplete'
        })),
        playTime: { sessions: [] },
        xp: {
          gained: 70,
          penalties: 0,
          final: 70
        },
        completed: false
      };

      // Finalize day to apply penalties
      dayEndPenaltyProfile = finalizeDayProgress(dayEndPenaltyProfile, penaltyTestDay) as PlayerProfile;

      // Verify penalties were applied correctly
      expect(dayEndPenaltyProfile.history[penaltyTestDay].xp.gained).toBe(70);
      expect(dayEndPenaltyProfile.history[penaltyTestDay].xp.penalties).toBe(50);
      expect(dayEndPenaltyProfile.history[penaltyTestDay].xp.final).toBe(20);

      // Verify level stayed the same with 20 XP added
      dayEndStats = calculatePlayerStats(dayEndPenaltyProfile);
      expect(dayEndStats.level).toBe(2);
      expect(dayEndStats.xp).toBe(20);
    });
  });

  // PART 8: MORE EXTREME PENALTY SCENARIO
  describe('Extreme Penalty Scenario', () => {
    test('Should calculate correct XP totals with extreme penalties', () => {
      // Create a profile with 850 XP total (level 2 with 10 XP into it)
      let extremePenaltyProfile: PlayerProfile = {
        history: {
          '2025-01-01': {
            date: '2025-01-01',
            chores: Array(12).fill(0).map((_, i) => ({
              id: i,
              text: `Chore ${i + 1}`,
              status: 'completed' as ChoreStatus
            })),
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

      // Verify starting state
      let extremeStats = calculatePlayerStats(extremePenaltyProfile);
      expect(extremeStats.level).toBe(2);
      expect(extremeStats.xp).toBe(10);

      // Create a day with extreme penalties
      // 1 completed (10 XP), 11 incomplete (-110 XP) = -100 XP net
      const extremePenaltyDay = '2025-01-02';
      extremePenaltyProfile.history[extremePenaltyDay] = {
        date: extremePenaltyDay,
        chores: Array(12).fill(0).map((_, i) => ({
          id: i,
          text: `Chore ${i + 1}`,
          status: i === 0 ? 'completed' : 'incomplete'
        })),
        playTime: { sessions: [] },
        xp: {
          gained: 10,
          penalties: 0,
          final: 10
        },
        completed: false
      };

      // Finalize day
      extremePenaltyProfile = finalizeDayProgress(extremePenaltyProfile, extremePenaltyDay) as PlayerProfile;

      // Verify penalties were applied
      expect(extremePenaltyProfile.history[extremePenaltyDay].xp.gained).toBe(10);
      expect(extremePenaltyProfile.history[extremePenaltyDay].xp.penalties).toBe(110);
      expect(extremePenaltyProfile.history[extremePenaltyDay].xp.final).toBe(-100);

      // Calculate total XP
      const totalXpAfterPenalty = Object.values(extremePenaltyProfile.history).reduce((sum, day) => sum + day.xp.final, 0);
      expect(totalXpAfterPenalty).toBe(750); // 850 - 100 = 750

      // Verify level is still 2 since negative XP days don't reduce level
      extremeStats = calculatePlayerStats(extremePenaltyProfile);
      expect(extremeStats.level).toBe(2);
      expect(extremeStats.xp).toBe(10);
    });
  });
}); 