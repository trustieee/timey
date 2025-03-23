import { APP_CONFIG } from '../config';
import { 
  getXpRequiredForLevel, 
  calculatePlayerStats,
  PlayerProfile,
  DayProgress,
  finalizeDayProgress,
  ChoreStatus
} from '../playerProfile';

console.log('===== LEVEL DOWN SIMULATION TEST =====');

// Helper function to create a day's progress with specific completion
function createDayProgress(date: string, completedCount: number, incompleteCount: number): DayProgress {
  const totalChores = completedCount + incompleteCount;
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

// Create profile with exactly 850 XP (level 2 with 10 XP into it)
console.log('\nCreating profile at level 2 with 10 XP into the level');

const profile: PlayerProfile = {
  history: {
    '2023-01-01': {
      date: '2023-01-01',
      chores: [],
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
let stats = calculatePlayerStats(profile);
console.log('Starting state:');
console.log(`Level: ${stats.level}, XP into level: ${stats.xp}, XP to next level: ${stats.xpToNextLevel}`);
console.log(`Total XP: ${Object.values(profile.history).reduce((sum, day) => sum + day.xp.final, 0)}`);
console.log(`Expected: Level 2 with 10 XP (Total 850 XP = 840 + 10)`);

// Test 1: Add day with small XP loss (not enough to level down)
console.log('\nTest 1: Add day with small XP loss (not enough to level down)');
const smallLossDay = '2023-01-02';
profile.history[smallLossDay] = createDayProgress(smallLossDay, 0, 5);

// Finalize day to apply penalties
const updatedProfile1 = finalizeDayProgress(profile, smallLossDay);
Object.assign(profile, updatedProfile1);

// Check new stats
stats = calculatePlayerStats(profile);
console.log('Day has 0 completed chores and 5 incomplete chores:');
console.log(`XP for the day: ${profile.history[smallLossDay].xp.final} (gained ${profile.history[smallLossDay].xp.gained}, penalties ${profile.history[smallLossDay].xp.penalties})`);
console.log(`New level: ${stats.level}, XP into level: ${stats.xp}, XP to next level: ${stats.xpToNextLevel}`);
console.log(`Total XP: ${Object.values(profile.history).reduce((sum, day) => sum + (day.xp.final > 0 ? day.xp.final : 0), 0)}`);
console.log(`Expected: Still Level 2 with 10 XP (negative XP days are ignored)`);

// Test 2: Add another day with XP loss enough to drop below level threshold
console.log('\nTest 2: Add day with enough XP loss - still doesn\'t drop level');
const levelDownDay = '2023-01-03';
profile.history[levelDownDay] = createDayProgress(levelDownDay, 0, 10);

// Finalize day to apply penalties
const updatedProfile2 = finalizeDayProgress(profile, levelDownDay);
Object.assign(profile, updatedProfile2);

// Check new stats
stats = calculatePlayerStats(profile);
console.log('Day has 0 completed chores and 10 incomplete chores:');
console.log(`XP for the day: ${profile.history[levelDownDay].xp.final} (gained ${profile.history[levelDownDay].xp.gained}, penalties ${profile.history[levelDownDay].xp.penalties})`);
console.log(`New level: ${stats.level}, XP into level: ${stats.xp}, XP to next level: ${stats.xpToNextLevel}`);

// Calculate only positive XP total since negative days don't count
let positiveXpTotal = 0;
Object.values(profile.history).forEach(day => {
  if (day.xp && day.xp.final > 0) {
    positiveXpTotal += day.xp.final;
  }
});
console.log(`Positive XP total: ${positiveXpTotal}`);

console.log(`Expected: Still Level 2 with 10 XP (negative XP days are ignored)`);

// Test 3: Add a positive day to gain additional XP
console.log('\nTest 3: Add positive day to gain additional XP');
const regainDay = '2023-01-04';
profile.history[regainDay] = createDayProgress(regainDay, 12, 0);

// Finalize day
const updatedProfile3 = finalizeDayProgress(profile, regainDay);
Object.assign(profile, updatedProfile3);

// Check new stats
stats = calculatePlayerStats(profile);
console.log('Day has 12 completed chores and 0 incomplete chores:');
console.log(`XP for the day: ${profile.history[regainDay].xp.final} (gained ${profile.history[regainDay].xp.gained}, penalties ${profile.history[regainDay].xp.penalties})`);
console.log(`New level: ${stats.level}, XP into level: ${stats.xp}, XP to next level: ${stats.xpToNextLevel}`);

// Recalculate positive XP total
positiveXpTotal = 0;
Object.values(profile.history).forEach(day => {
  if (day.xp && day.xp.final > 0) {
    positiveXpTotal += day.xp.final;
  }
});
console.log(`Positive XP total: ${positiveXpTotal}`);
console.log(`Expected: Level 2 with 130 XP (850 + 120 = 970 total, which is 840 + 130)`);

// Test 4: What happens if we reduce initial XP by simulating fewer complete days?
console.log('\nTest 4: What if we reduce our initial positive XP?');
delete profile.history['2023-01-01'];
profile.history['2023-01-01'] = {
  date: '2023-01-01',
  chores: [],
  playTime: { totalMinutes: 0, sessions: [] },
  xp: {
    gained: 400, // Much less than before
    penalties: 0,
    final: 400
  },
  completed: true
};

// Check new stats after reducing initial XP
stats = calculatePlayerStats(profile);
console.log('Reduced initial XP to 400:');

// Recalculate positive XP total
positiveXpTotal = 0;
Object.values(profile.history).forEach(day => {
  if (day.xp && day.xp.final > 0) {
    positiveXpTotal += day.xp.final;
  }
});
console.log(`Positive XP total: ${positiveXpTotal}`);
console.log(`Level: ${stats.level}, XP into level: ${stats.xp}, XP to next level: ${stats.xpToNextLevel}`);
console.log(`Expected: Level 1 with 520 XP (400 + 120 = 520 total, which is less than 840 for level 2)`);

console.log('\n===== LEVEL DOWN TEST COMPLETED ====='); 