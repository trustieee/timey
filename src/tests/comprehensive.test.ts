import { APP_CONFIG } from '../config';
import { 
  getXpRequiredForLevel, 
  calculatePlayerStats,
  PlayerProfile,
  DayProgress,
  finalizeDayProgress,
  ChoreStatus,
  addXp,
  removeXp
} from '../playerProfile';

console.log('===== COMPREHENSIVE XP & LEVELING TESTS =====');

// ===============================================================
// PART 1: XP REQUIREMENTS VERIFICATION
// ===============================================================
console.log('\n=== PART 1: XP REQUIREMENTS VERIFICATION ===');

// Test 1: Verify XP required for different levels
console.log('\nTest 1.1: XP required for different levels');
console.log('Level 1:', getXpRequiredForLevel(1)); // Should be 840 (7 days)
console.log('Level 2:', getXpRequiredForLevel(2)); // Should be 960 (8 days)
console.log('Level 3:', getXpRequiredForLevel(3)); // Should be 1080 (9 days)
console.log('Level 4:', getXpRequiredForLevel(4)); // Should be 1200 (10 days)
console.log('Level 5:', getXpRequiredForLevel(5)); // Should be 1200 (10 days)
console.log('Level 10:', getXpRequiredForLevel(10)); // Should be 1200 (10 days)

// Check formula against configuration
console.log('\nTest 1.2: Verify formula matches configuration');
for (let level = 1; level <= 5; level++) {
  const xpRequired = getXpRequiredForLevel(level);
  const daysNeeded = xpRequired / (APP_CONFIG.PROFILE.XP_FOR_CHORE * 12);
  console.log(`Level ${level}: ${xpRequired} XP (${daysNeeded.toFixed(1)} days of tasks)`);
}

// ===============================================================
// PART 2: LEVEL CALCULATION FROM TOTAL XP
// ===============================================================
console.log('\n=== PART 2: LEVEL CALCULATION FROM TOTAL XP ===');

function testProfileWithXp(totalXp: number): PlayerProfile {
  // Create a mock profile with a single day containing the given XP
  return {
    history: {
      '2025-01-01': {
        date: '2025-01-01',
        chores: [],
        playTime: { totalMinutes: 0, sessions: [] },
        xp: {
          gained: totalXp,
          penalties: 0,
          final: totalXp
        },
        completed: true
      }
    }
  };
}

// Test with various XP totals
const testCases = [
  0,      // Should be level 1, 0/840 XP
  839,    // Should be level 1, 839/840 XP
  840,    // Should be level 2, 0/960 XP
  1799,   // Should be level 2, 959/960 XP
  1800,   // Should be level 3, 0/1080 XP
  2879,   // Should be level 3, 1079/1080 XP
  2880,   // Should be level 4, 0/1200 XP
  4080,   // Should be level 5, 0/1200 XP
  5280,   // Should be level 6, 0/1200 XP
  10000   // Should be around level 9
];

console.log('\nTest 2.1: Calculate level from total XP');
testCases.forEach(xp => {
  const profile = testProfileWithXp(xp);
  const stats = calculatePlayerStats(profile);
  console.log(`XP: ${xp} → Level: ${stats.level}, Progress: ${stats.xp}/${stats.xpToNextLevel}`);
});

// ===============================================================
// PART 3: MULTI-DAY XP CALCULATION
// ===============================================================
console.log('\n=== PART 3: MULTI-DAY XP CALCULATION ===');

const multiDayProfile: PlayerProfile = {
  history: {
    '2025-01-01': {
      date: '2025-01-01',
      chores: [],
      playTime: { totalMinutes: 0, sessions: [] },
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
      playTime: { totalMinutes: 0, sessions: [] },
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
      playTime: { totalMinutes: 0, sessions: [] },
      xp: {
        gained: 90,
        penalties: 10,
        final: 80
      },
      completed: true
    }
  }
};

const multiDayStats = calculatePlayerStats(multiDayProfile);
console.log('\nTest 3.1: Calculate XP from multiple days');
console.log(`Multiple days total XP: 120 + 80 + 80 = 280`);
console.log(`Level: ${multiDayStats.level}, Progress: ${multiDayStats.xp}/${multiDayStats.xpToNextLevel}`);

// ===============================================================
// PART 4: DAY SIMULATION WITH LEVEL PROGRESSION
// ===============================================================
console.log('\n=== PART 4: DAY SIMULATION WITH LEVEL PROGRESSION ===');

// Create a profile with empty history
let simulationProfile: PlayerProfile & {level: number, xp: number, xpToNextLevel: number} = {
  history: {},
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
      text: `Chore ${i+1}`,
      status: i < completedChores ? 'completed' : 'incomplete'
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
      penalties: 0, // No penalties during the day
      final: xpGained
    },
    completed: true
  };
}

// Simulate 15 days, with controlled progression
console.log('\nTest 4.1: Simulating 15 days of chore completion for level progression');
console.log('Day 0:', { level: simulationProfile.level, xp: simulationProfile.xp, xpToNextLevel: simulationProfile.xpToNextLevel });

// Specific completion pattern to control level progression
const completionPattern = [
  12, 12, 12, 12, 12, 12, 12, // 7 days with all tasks = 840 XP (level 2)
  12, 12, 12, 12, 12, 12, 12, 12, // 8 days with all tasks = 960 XP (level 3)
];

for (let day = 1; day <= completionPattern.length; day++) {
  // Format date as YYYY-MM-DD
  const date = new Date(2025, 0, day).toISOString().split('T')[0];
  
  // Use the predefined completion count
  const completedChores = completionPattern[day - 1];
  
  // Add the day to history
  simulationProfile.history[date] = createDay(date, completedChores);
  
  // Recalculate stats
  const stats = calculatePlayerStats(simulationProfile);
  simulationProfile.level = stats.level;
  simulationProfile.xp = stats.xp;
  simulationProfile.xpToNextLevel = stats.xpToNextLevel;
  
  // Log day, completed chores, and current stats
  console.log(
    `Day ${day}: ${completedChores} chores completed (+${completedChores * 10} XP)`, 
    `→ Level ${simulationProfile.level}, XP: ${simulationProfile.xp}/${simulationProfile.xpToNextLevel}`
  );
}

// ===============================================================
// PART 5: XP PENALTIES & TASK STATUS TESTS
// ===============================================================
console.log('\n=== PART 5: XP PENALTIES & TASK STATUS TESTS ===');

// Create a test profile
let penaltyProfile: PlayerProfile = {
  history: {}
};

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
      penalties: 0, // Penalties will be calculated during finalization
      final: xpGained // Will be updated during finalization
    },
    completed: false // Not finalized yet
  };
}

// Test 5.1: Day with all chores completed
console.log('\nTest 5.1: Day with all chores completed');
const allCompletedDay = '2025-01-01';
penaltyProfile.history[allCompletedDay] = createDayWithChores(
  allCompletedDay,
  Array(12).fill('completed' as ChoreStatus)
);

console.log('Before finalization:', penaltyProfile.history[allCompletedDay].xp);
penaltyProfile = finalizeDayProgress(penaltyProfile, allCompletedDay) as PlayerProfile;
console.log('After finalization:', penaltyProfile.history[allCompletedDay].xp);
console.log(`Expected: ${12 * APP_CONFIG.PROFILE.XP_FOR_CHORE} XP gained, 0 XP penalty, ${12 * APP_CONFIG.PROFILE.XP_FOR_CHORE} XP final`);

// Test 5.2: Day with some incomplete chores
console.log('\nTest 5.2: Day with some incomplete chores');
const someIncompleteDay = '2025-01-02';
penaltyProfile.history[someIncompleteDay] = createDayWithChores(
  someIncompleteDay,
  [
    'completed', 'completed', 'completed',
    'completed', 'completed', 'completed',
    'completed', 'completed', 'incomplete',
    'incomplete', 'incomplete', 'incomplete'
  ]
);

console.log('Before finalization:', penaltyProfile.history[someIncompleteDay].xp);
penaltyProfile = finalizeDayProgress(penaltyProfile, someIncompleteDay) as PlayerProfile;
console.log('After finalization:', penaltyProfile.history[someIncompleteDay].xp);
console.log(`Expected: ${8 * APP_CONFIG.PROFILE.XP_FOR_CHORE} XP gained, ${4 * APP_CONFIG.PROFILE.XP_PENALTY_FOR_CHORE} XP penalty (4 incomplete), ${8 * APP_CONFIG.PROFILE.XP_FOR_CHORE - 4 * APP_CONFIG.PROFILE.XP_PENALTY_FOR_CHORE} XP final`);

// Test 5.3: Day with N/A chores
console.log('\nTest 5.3: Day with N/A chores');
const naChoresday = '2025-01-03';
penaltyProfile.history[naChoresday] = createDayWithChores(
  naChoresday,
  [
    'completed', 'completed', 'completed',
    'completed', 'completed', 'completed',
    'na', 'na', 'na',
    'na', 'na', 'na'
  ]
);

console.log('Before finalization:', penaltyProfile.history[naChoresday].xp);
penaltyProfile = finalizeDayProgress(penaltyProfile, naChoresday) as PlayerProfile;
console.log('After finalization:', penaltyProfile.history[naChoresday].xp);
console.log(`Expected: ${6 * APP_CONFIG.PROFILE.XP_FOR_CHORE} XP gained, 0 XP penalty (N/A chores don't penalize), ${6 * APP_CONFIG.PROFILE.XP_FOR_CHORE} XP final`);

// Test 5.4: Day with mix of completed, incomplete, and N/A
console.log('\nTest 5.4: Day with mix of all statuses');
const mixedDay = '2025-01-04';
penaltyProfile.history[mixedDay] = createDayWithChores(
  mixedDay,
  [
    'completed', 'completed', 'completed',
    'completed', 'incomplete', 'incomplete',
    'incomplete', 'na', 'na',
    'na', 'na', 'na'
  ]
);

console.log('Before finalization:', penaltyProfile.history[mixedDay].xp);
penaltyProfile = finalizeDayProgress(penaltyProfile, mixedDay) as PlayerProfile;
console.log('After finalization:', penaltyProfile.history[mixedDay].xp);
console.log(`Expected: ${4 * APP_CONFIG.PROFILE.XP_FOR_CHORE} XP gained, ${3 * APP_CONFIG.PROFILE.XP_PENALTY_FOR_CHORE} XP penalty (3 incomplete), ${4 * APP_CONFIG.PROFILE.XP_FOR_CHORE - 3 * APP_CONFIG.PROFILE.XP_PENALTY_FOR_CHORE} XP final`);

// Test 5.5: Calculate total stats after all days
console.log('\nTest 5.5: Total stats after all days');
const penaltyStats = calculatePlayerStats(penaltyProfile);
console.log('Total stats:', penaltyStats);
const expectedTotal = 
  (12 * APP_CONFIG.PROFILE.XP_FOR_CHORE) + // Day 1: 12 completed
  (8 * APP_CONFIG.PROFILE.XP_FOR_CHORE - 4 * APP_CONFIG.PROFILE.XP_PENALTY_FOR_CHORE) + // Day 2: 8 completed, 4 incomplete
  (6 * APP_CONFIG.PROFILE.XP_FOR_CHORE) + // Day 3: 6 completed, 6 NA
  (4 * APP_CONFIG.PROFILE.XP_FOR_CHORE - 3 * APP_CONFIG.PROFILE.XP_PENALTY_FOR_CHORE); // Day 4: 4 completed, 3 incomplete, 5 NA
console.log(`Expected total: ${expectedTotal} XP`);

// ===============================================================
// PART 6: LEVEL UP/DOWN WITH TASK STATUS CHANGES
// ===============================================================
console.log('\n=== PART 6: LEVEL UP/DOWN WITH TASK STATUS CHANGES ===');

// Create a profile with enough XP to be close to level threshold
console.log('\nTest 6.1: Level threshold crossing with task status changes');

// Create a profile with 839 XP (1 XP away from level 2)
let levelThresholdProfile: PlayerProfile = {
  history: {
    '2025-01-01': {
      date: '2025-01-01',
      chores: Array(12).fill(0).map((_, i) => ({
        id: i,
        text: `Chore ${i+1}`,
        status: 'completed' as ChoreStatus
      })),
      playTime: { totalMinutes: 0, sessions: [] },
      xp: {
        gained: 839,
        penalties: 0,
        final: 839
      },
      completed: true
    }
  }
};

// Verify starting state
let thresholdStats = calculatePlayerStats(levelThresholdProfile);
console.log('Starting state:', {
  level: thresholdStats.level,
  xp: thresholdStats.xp,
  xpToNextLevel: thresholdStats.xpToNextLevel
});

// Add 1 XP to cross the threshold to level 2
console.log('\nAdding 1 XP to cross level threshold:');
levelThresholdProfile.history['2025-01-02'] = {
  date: '2025-01-02',
  chores: [],
  playTime: { totalMinutes: 0, sessions: [] },
  xp: {
    gained: 1,
    penalties: 0,
    final: 1
  },
  completed: true
};

thresholdStats = calculatePlayerStats(levelThresholdProfile);
console.log('After adding 1 XP:', {
  level: thresholdStats.level,
  xp: thresholdStats.xp,
  xpToNextLevel: thresholdStats.xpToNextLevel
});

// Remove XP to go back to level 1
console.log('\nRemoving XP to go back to level 1:');
delete levelThresholdProfile.history['2025-01-02'];
thresholdStats = calculatePlayerStats(levelThresholdProfile);
console.log('After removing XP:', {
  level: thresholdStats.level,
  xp: thresholdStats.xp,
  xpToNextLevel: thresholdStats.xpToNextLevel
});

// Add 10 XP to cross the threshold again
console.log('\nAdding 10 XP to cross level threshold:');
levelThresholdProfile.history['2025-01-02'] = {
  date: '2025-01-02',
  chores: [],
  playTime: { totalMinutes: 0, sessions: [] },
  xp: {
    gained: 10,
    penalties: 0,
    final: 10
  },
  completed: true
};

thresholdStats = calculatePlayerStats(levelThresholdProfile);
console.log('After adding 10 XP:', {
  level: thresholdStats.level,
  xp: thresholdStats.xp,
  xpToNextLevel: thresholdStats.xpToNextLevel
});

// ===============================================================
// PART 7: PENALTIES AT DAY END AFFECTING LEVELS
// ===============================================================
console.log('\n=== PART 7: PENALTIES AT DAY END AFFECTING LEVELS ===');

// Create a profile with exactly enough XP to be at level 2 with 0 XP into level 2
// Level 1 = 840 XP, so total = exactly 840 XP
let dayEndPenaltyProfile: PlayerProfile = {
  history: {
    '2025-01-01': {
      date: '2025-01-01',
      chores: Array(12).fill(0).map((_, i) => ({
        id: i,
        text: `Chore ${i+1}`,
        status: 'completed' as ChoreStatus
      })),
      playTime: { totalMinutes: 0, sessions: [] },
      xp: {
        gained: 840,
        penalties: 0,
        final: 840
      },
      completed: true
    }
  }
};

// Verify starting state
let dayEndStats = calculatePlayerStats(dayEndPenaltyProfile);
console.log('Starting state:', {
  level: dayEndStats.level,
  xp: dayEndStats.xp,
  xpToNextLevel: dayEndStats.xpToNextLevel
});

// Create a new day with 7 completed and 5 incomplete tasks
const penaltyTestDay = '2025-01-02';
dayEndPenaltyProfile.history[penaltyTestDay] = createDayWithChores(
  penaltyTestDay,
  [
    'completed', 'completed', 'completed',
    'completed', 'completed', 'completed',
    'completed', 'incomplete', 'incomplete',
    'incomplete', 'incomplete', 'incomplete'
  ]
);

// Check state before penalties
console.log('\nBefore day finalization:');
console.log('Day XP:', dayEndPenaltyProfile.history[penaltyTestDay].xp);
dayEndStats = calculatePlayerStats(dayEndPenaltyProfile);
console.log('Profile stats:', {
  level: dayEndStats.level,
  xp: dayEndStats.xp,
  xpToNextLevel: dayEndStats.xpToNextLevel
});

// Apply penalties - 5 incomplete tasks * 10 XP = 50 XP penalty
// 7 completed tasks * 10 XP = 70 XP gained
// Net for the day: 70 - 50 = 20 XP
dayEndPenaltyProfile = finalizeDayProgress(dayEndPenaltyProfile, penaltyTestDay) as PlayerProfile;

// Check state after penalties
dayEndStats = calculatePlayerStats(dayEndPenaltyProfile);
console.log('\nAfter day finalization with penalties:');
console.log('Day XP:', dayEndPenaltyProfile.history[penaltyTestDay].xp);
console.log('Profile stats:', {
  level: dayEndStats.level,
  xp: dayEndStats.xp,
  xpToNextLevel: dayEndStats.xpToNextLevel
});
console.log(`Expected result: Level 2, 20 XP (7 completed = +70, 5 incomplete = -50, net +20)`);

// ===============================================================
// PART 8: MORE EXTREME PENALTY SCENARIO (LEVEL DOWN)
// ===============================================================
console.log('\n=== PART 8: MORE EXTREME PENALTY SCENARIO (LEVEL DOWN) ===');

try {
  // Create a profile with 850 XP total (850 = 840 + 10, so Level 2 with 10 XP)
  let extremePenaltyProfile: PlayerProfile = {
    history: {
      '2025-01-01': {
        date: '2025-01-01',
        chores: Array(12).fill(0).map((_, i) => ({
          id: i,
          text: `Chore ${i+1}`,
          status: 'completed' as ChoreStatus
        })),
        playTime: { totalMinutes: 0, sessions: [] },
        xp: {
          gained: 850,
          penalties: 0,
          final: 850
        },
        completed: true
      }
    }
  };

  // Verify starting state
  let extremeStats = calculatePlayerStats(extremePenaltyProfile);
  console.log('Starting state:');
  console.log('Total XP:', Object.values(extremePenaltyProfile.history).reduce((sum, day) => sum + day.xp.final, 0));
  console.log('Stats:', {
    level: extremeStats.level,
    xp: extremeStats.xp,
    xpToNextLevel: extremeStats.xpToNextLevel
  });

  // Create a new day with 1 completed task and 11 incomplete tasks
  // 1 completed = +10 XP, 11 incomplete = -110 XP, net = -100 XP
  const extremePenaltyDay = '2025-01-02';
  extremePenaltyProfile.history[extremePenaltyDay] = createDayWithChores(
    extremePenaltyDay,
    [
      'completed', 'incomplete', 'incomplete',
      'incomplete', 'incomplete', 'incomplete',
      'incomplete', 'incomplete', 'incomplete',
      'incomplete', 'incomplete', 'incomplete'
    ]
  );

  // Check state before penalties
  console.log('\nBefore day finalization:');
  console.log('Day XP:', extremePenaltyProfile.history[extremePenaltyDay].xp);
  let beforeStats = calculatePlayerStats(extremePenaltyProfile);
  console.log('Total XP:', Object.values(extremePenaltyProfile.history).reduce((sum, day) => sum + day.xp.final, 0));
  console.log('Stats:', {
    level: beforeStats.level,
    xp: beforeStats.xp,
    xpToNextLevel: beforeStats.xpToNextLevel
  });

  // Apply penalties
  console.log('\nApplying finalizeDayProgress...');
  extremePenaltyProfile = finalizeDayProgress(extremePenaltyProfile, extremePenaltyDay) as PlayerProfile;
  console.log('finalizeDayProgress completed.');

  // Check state after penalties
  extremeStats = calculatePlayerStats(extremePenaltyProfile);
  console.log('\nAfter day finalization with extreme penalties:');
  console.log('Day 2 XP:', extremePenaltyProfile.history[extremePenaltyDay].xp);
  const totalXpAfterPenalty = Object.values(extremePenaltyProfile.history).reduce((sum, day) => sum + day.xp.final, 0);
  console.log('History:', JSON.stringify(extremePenaltyProfile.history, null, 2));
  console.log('Total XP:', totalXpAfterPenalty);
  console.log('Stats:', {
    level: extremeStats.level,
    xp: extremeStats.xp,
    xpToNextLevel: extremeStats.xpToNextLevel
  });

  // Calculate expected values
  const expectedFinalXp = 850 - 100; // 850 from day 1, -100 from day 2
  console.log(`Expected total XP: 850 + (-100) = ${expectedFinalXp}`);
  console.log(`Expected level/XP calculation: ${expectedFinalXp} total XP = Level 1 with ${expectedFinalXp - 840} XP`);
  console.log(`But actual calculation is: ${totalXpAfterPenalty} total XP = Level ${extremeStats.level} with ${extremeStats.xp} XP`);
  console.log(`Is the XP calculation matching expectations? ${expectedFinalXp === totalXpAfterPenalty ? 'Yes' : 'No'}`);
} catch (error) {
  console.error('Error in Part 8:', error);
}

console.log('\n===== ALL TESTS COMPLETED ====='); 