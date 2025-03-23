import { APP_CONFIG } from '../config';
import { 
  getXpRequiredForLevel, 
  calculatePlayerStats,
  PlayerProfile,
  DayProgress,
  finalizeDayProgress,
  ChoreStatus
} from '../playerProfile';

console.log('===== 30-DAY XP SIMULATION TEST =====');

// Helper function to create a random day's progress
function createRandomDayProgress(date: string): DayProgress {
  const totalChores = 12;
  const statuses: ChoreStatus[] = ['completed', 'incomplete', 'na'];
  
  // Randomly determine how many chores were completed (0-12)
  const randomChores: ChoreStatus[] = [];
  
  for (let i = 0; i < totalChores; i++) {
    // Generate random probability for this chore
    const rand = Math.random();
    
    // 60% completed, 30% incomplete, 10% N/A
    let status: ChoreStatus;
    if (rand < 0.6) {
      status = 'completed';
    } else if (rand < 0.9) {
      status = 'incomplete';
    } else {
      status = 'na';
    }
    
    randomChores.push(status);
  }
  
  // Count completed chores to calculate gained XP
  const completedCount = randomChores.filter(status => status === 'completed').length;
  const incompleteCount = randomChores.filter(status => status === 'incomplete').length;
  const xpGained = completedCount * APP_CONFIG.PROFILE.XP_FOR_CHORE;
  const xpPenalty = incompleteCount * APP_CONFIG.PROFILE.XP_PENALTY_FOR_CHORE;
  
  return {
    date,
    chores: randomChores.map((status, i) => ({
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
function verifyXpCalculations(profile: PlayerProfile): boolean {
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
  
  // Compare
  console.log(`Expected total XP (only positive days): ${expectedTotalXp}`);
  console.log(`Actual total XP (from levels): ${actualTotalXp}`);
  
  return Math.abs(expectedTotalXp - actualTotalXp) < 1; // Allow tiny floating point differences
}

// Run the 30-day simulation
function runXpSimulation(days: number): void {
  console.log(`\nSimulating ${days} days of random XP gains and losses`);
  
  // Create empty profile
  const profile: PlayerProfile = {
    history: {}
  };
  
  // Track XP and level progression
  const dailyStats: Array<{
    day: number,
    date: string,
    xpGained: number,
    xpPenalty: number,
    xpNet: number,
    xpTotal: number,
    positiveXpTotal: number, // Track only positive XP
    level: number,
    xpIntoLevel: number,
    xpToNextLevel: number
  }> = [];
  
  // Generate random activity for each day
  for (let day = 1; day <= days; day++) {
    // Create date for this day
    const date = new Date(2023, 0, day).toISOString().split('T')[0];
    
    // Create random day progress
    profile.history[date] = createRandomDayProgress(date);
    
    // Before finalization
    console.log(`\nDay ${day} (${date}): Before finalization`);
    console.log(`Gained: ${profile.history[date].xp.gained} XP`);
    
    // Finalize day and apply penalties
    const updatedProfile = finalizeDayProgress(profile, date);
    Object.assign(profile, updatedProfile);
    
    // Calculate stats after finalization
    const stats = calculatePlayerStats(profile);
    
    // After finalization
    console.log(`Day ${day} (${date}): After finalization`);
    console.log(`Gained: ${profile.history[date].xp.gained} XP`);
    console.log(`Penalty: ${profile.history[date].xp.penalties} XP`);
    console.log(`Final: ${profile.history[date].xp.final} XP`);
    
    // Calculate total XP, counting only positive days
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
      positiveXpTotal, // Add this new field
      level: stats.level,
      xpIntoLevel: stats.xp,
      xpToNextLevel: stats.xpToNextLevel
    });
  }
  
  // Print summary
  console.log('\n===== SIMULATION SUMMARY =====');
  console.log('Day | XP Gained | XP Penalty | XP Net | Total XP | Positive XP | Level | XP In Level | Next Level');
  console.log('-----|-----------|------------|--------|----------|-------------|-------|-------------|----------');
  
  for (const dayStat of dailyStats) {
    console.log(
      `${dayStat.day.toString().padStart(3)} | ` +
      `${dayStat.xpGained.toString().padStart(9)} | ` +
      `${dayStat.xpPenalty.toString().padStart(10)} | ` +
      `${dayStat.xpNet.toString().padStart(6)} | ` +
      `${dayStat.xpTotal.toString().padStart(8)} | ` +
      `${dayStat.positiveXpTotal.toString().padStart(11)} | ` +
      `${dayStat.level.toString().padStart(5)} | ` +
      `${dayStat.xpIntoLevel.toString().padStart(11)} | ` +
      `${dayStat.xpToNextLevel.toString().padStart(10)}`
    );
  }
  
  // Verify the XP calculations match expectations
  console.log('\n===== VERIFICATION =====');
  console.log('XP calculations match expected totals: ' + 
    (verifyXpCalculations(profile) ? 'PASS ✓' : 'FAIL ✗'));
  
  // Verify level transitions
  console.log('\nLevel transitions:');
  for (let i = 1; i < dailyStats.length; i++) {
    const prevDay = dailyStats[i-1];
    const currDay = dailyStats[i];
    
    // Check for level changes
    if (prevDay.level !== currDay.level) {
      console.log(`Day ${currDay.day}: Level changed from ${prevDay.level} to ${currDay.level}`);
      
      // Verify level transition is correct
      if (currDay.level > prevDay.level) {
        // Level up - verify XP calculation
        console.log(`  Level up: Previous positive total XP: ${prevDay.positiveXpTotal}, Current positive total XP: ${currDay.positiveXpTotal}`);
        console.log(`  XP needed for level ${prevDay.level}: ${getXpRequiredForLevel(prevDay.level)}`);
        console.log(`  XP in level ${prevDay.level}: ${prevDay.xpIntoLevel}, XP gained: ${currDay.xpNet > 0 ? currDay.xpNet : 0}`);
        
        // Calculate expected new level from positive XP only
        let tempXp = currDay.positiveXpTotal;
        let tempLevel = 1;
        while (tempXp >= getXpRequiredForLevel(tempLevel)) {
          tempXp -= getXpRequiredForLevel(tempLevel);
          tempLevel++;
        }
        
        console.log(`  Expected new level: ${tempLevel}, Actual new level: ${currDay.level}`);
        console.log(`  Level transition correct: ${tempLevel === currDay.level ? 'PASS ✓' : 'FAIL ✗'}`);
      } else {
        // Level down - verify XP calculation
        console.log(`  Level down: Previous positive total XP: ${prevDay.positiveXpTotal}, Current positive total XP: ${currDay.positiveXpTotal}`);
        console.log(`  XP change: ${currDay.xpNet}`);
        
        // Calculate expected new level from positive XP only
        let tempXp = currDay.positiveXpTotal;
        let tempLevel = 1;
        while (tempXp >= getXpRequiredForLevel(tempLevel)) {
          tempXp -= getXpRequiredForLevel(tempLevel);
          tempLevel++;
        }
        
        console.log(`  Expected new level: ${tempLevel}, Actual new level: ${currDay.level}`);
        console.log(`  Level transition correct: ${tempLevel === currDay.level ? 'PASS ✓' : 'FAIL ✗'}`);
      }
    }
  }
  
  // Verify XP requirements match config
  console.log('\nXP requirements match config:');
  for (let level = 1; level <= 10; level++) {
    const expected = level <= APP_CONFIG.PROFILE.XP_PER_LEVEL.length
      ? APP_CONFIG.PROFILE.XP_PER_LEVEL[level - 1]
      : APP_CONFIG.PROFILE.DEFAULT_XP_PER_LEVEL;
    
    const actual = getXpRequiredForLevel(level);
    
    console.log(`Level ${level}: Expected ${expected}, Actual ${actual} - ${expected === actual ? 'PASS ✓' : 'FAIL ✗'}`);
  }
}

// Run simulation for 30 days
runXpSimulation(30);

console.log('\n===== XP SIMULATION TEST COMPLETED ====='); 