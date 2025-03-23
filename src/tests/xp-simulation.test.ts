import { APP_CONFIG } from '../config';
import { 
  getXpRequiredForLevel, 
  calculatePlayerStats,
  PlayerProfile,
  DayProgress,
  finalizeDayProgress,
  ChoreStatus
} from '../playerProfile';

describe('30-Day XP Simulation', () => {
  // Helper function to create a random day's progress
  function createRandomDayProgress(date: string, randomSeed = Math.random()): DayProgress {
    const totalChores = 12;
    const statuses: ChoreStatus[] = [];
    
    // Use the random seed to generate deterministic random values for tests
    const generateRandomValue = () => {
      // Simple pseudo-random number generator based on the seed
      randomSeed = (randomSeed * 9301 + 49297) % 233280;
      return randomSeed / 233280;
    };
    
    // Generate chore statuses
    for (let i = 0; i < totalChores; i++) {
      // Generate random probability for this chore
      const rand = generateRandomValue();
      
      // 60% completed, 30% incomplete, 10% N/A
      let status: ChoreStatus;
      if (rand < 0.6) {
        status = 'completed';
      } else if (rand < 0.9) {
        status = 'incomplete';
      } else {
        status = 'na';
      }
      
      statuses.push(status);
    }
    
    // Count completed chores to calculate gained XP
    const completedCount = statuses.filter(status => status === 'completed').length;
    const xpGained = completedCount * APP_CONFIG.PROFILE.XP_FOR_CHORE;
    
    return {
      date,
      chores: statuses.map((status, i) => ({
        id: i,
        text: `Chore ${i+1}`,
        status
      })),
      playTime: {
        totalMinutes: 60,
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

  // Function to verify XP calculations
  function verifyXpCalculations(profile: PlayerProfile): { expectedTotalXp: number, actualTotalXp: number, isMatching: boolean } {
    // Calculate expected total XP directly from history - only count positive XP
    let expectedTotalXp = 0;
    
    Object.values(profile.history).forEach(day => {
      if (day.xp && day.xp.final > 0) {
        expectedTotalXp += day.xp.final;
      }
    });
    
    // Get the stats as calculated by the actual function
    const stats = calculatePlayerStats(profile);
    
    // Calculate actual total XP from the stats
    let actualTotalXp = 0;
    
    // Add XP from previous levels
    for (let i = 1; i < stats.level; i++) {
      actualTotalXp += getXpRequiredForLevel(i);
    }
    
    // Add XP in current level
    actualTotalXp += stats.xp;
    
    // Compare and return result
    return {
      expectedTotalXp,
      actualTotalXp,
      isMatching: Math.abs(expectedTotalXp - actualTotalXp) < 1 // Allow tiny floating point differences
    };
  }

  // Calculate expected level from XP total
  function calculateExpectedLevel(xpTotal: number): { level: number, xpIntoLevel: number } {
    let tempXp = xpTotal;
    let tempLevel = 1;
    
    while (tempXp >= getXpRequiredForLevel(tempLevel)) {
      tempXp -= getXpRequiredForLevel(tempLevel);
      tempLevel++;
    }
    
    return { level: tempLevel, xpIntoLevel: tempXp };
  }

  describe('XP Calculation and Level Progression', () => {
    test('Should correctly calculate XP and level through 30 day simulation', () => {
      // Create empty profile
      const profile: PlayerProfile = {
        history: {},
        rewards: {
          available: 0,
          permanent: {}
        }
      };
      
      // Track XP and level progression
      const dailyStats: Array<{
        day: number,
        date: string,
        xpGained: number,
        xpPenalty: number,
        xpNet: number,
        xpTotal: number,
        positiveXpTotal: number,
        level: number,
        xpIntoLevel: number,
        xpToNextLevel: number
      }> = [];
      
      // Use fixed seed for deterministic randomness in tests
      let randomSeed = 12345;
      
      // Generate data for 30 days
      for (let day = 1; day <= 30; day++) {
        // Create date for this day
        const date = new Date(2023, 0, day).toISOString().split('T')[0];
        
        // Create progress for this day with deterministic randomness
        profile.history[date] = createRandomDayProgress(date, randomSeed + day);
        
        // Save pre-finalization values for testing
        const preFinalizeGained = profile.history[date].xp.gained;
        
        // Finalize day and apply penalties
        const updatedProfile = finalizeDayProgress(profile, date);
        Object.assign(profile, updatedProfile);
        
        // Calculate stats after finalization
        const stats = calculatePlayerStats(profile);
        
        // Calculate positive XP total
        let positiveXpTotal = 0;
        Object.values(profile.history).forEach(day => {
          if (day.xp && day.xp.final > 0) {
            positiveXpTotal += day.xp.final;
          }
        });
        
        // Record stats for this day
        dailyStats.push({
          day,
          date,
          xpGained: profile.history[date].xp.gained,
          xpPenalty: profile.history[date].xp.penalties,
          xpNet: profile.history[date].xp.final,
          xpTotal: Object.values(profile.history).reduce((sum, day) => sum + day.xp.final, 0),
          positiveXpTotal,
          level: stats.level,
          xpIntoLevel: stats.xp,
          xpToNextLevel: stats.xpToNextLevel
        });
        
        // Test specific assertions for each day
        // 1. Verify finalization correctly calculates penalties
        expect(profile.history[date].xp.gained).toBe(preFinalizeGained);
        expect(profile.history[date].xp.final).toBe(preFinalizeGained - profile.history[date].xp.penalties);
        
        // 2. Verify stats are consistent with history
        const verification = verifyXpCalculations(profile);
        expect(verification.isMatching).toBe(true);
      }
      
      // Test for level transitions
      for (let i = 1; i < dailyStats.length; i++) {
        const prevDay = dailyStats[i-1];
        const currDay = dailyStats[i];
        
        // If level changed, verify it's correct
        if (prevDay.level !== currDay.level) {
          // Calculate expected level from positive XP total
          const expectedLevelInfo = calculateExpectedLevel(currDay.positiveXpTotal);
          
          // Verify new level matches calculation
          expect(currDay.level).toBe(expectedLevelInfo.level);
          expect(currDay.xpIntoLevel).toBe(expectedLevelInfo.xpIntoLevel);
        }
      }
      
      // Verify XP requirements match configuration
      for (let level = 1; level <= 10; level++) {
        const expected = level <= APP_CONFIG.PROFILE.XP_PER_LEVEL.length
          ? APP_CONFIG.PROFILE.XP_PER_LEVEL[level - 1]
          : APP_CONFIG.PROFILE.DEFAULT_XP_PER_LEVEL;
        
        const actual = getXpRequiredForLevel(level);
        expect(actual).toBe(expected);
      }
      
      // Verify final day's stats match expected values
      const finalDay = dailyStats[dailyStats.length - 1];
      const verification = verifyXpCalculations(profile);
      
      expect(verification.expectedTotalXp).toBe(finalDay.positiveXpTotal);
      expect(verification.actualTotalXp).toBe(
        (finalDay.level - 1) * getXpRequiredForLevel(finalDay.level - 1) + finalDay.xpIntoLevel
      );
    });
  });

  describe('XP Requirement Configuration', () => {
    test('Should have correct XP requirements for all levels', () => {
      // Verify XP requirements match configuration
      for (let level = 1; level <= 10; level++) {
        const expected = level <= APP_CONFIG.PROFILE.XP_PER_LEVEL.length
          ? APP_CONFIG.PROFILE.XP_PER_LEVEL[level - 1]
          : APP_CONFIG.PROFILE.DEFAULT_XP_PER_LEVEL;
        
        const actual = getXpRequiredForLevel(level);
        expect(actual).toBe(expected);
      }
    });
  });
}); 