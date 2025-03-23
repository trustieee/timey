import { RewardType, REWARDS } from '../rewards';
import * as playerProfile from '../playerProfile';
import { getLocalDateString } from '../utils';
import { APP_CONFIG } from '../config';
import { DayProgress, PlayerProfile } from '../playerProfile';

describe('Rewards Functionality', () => {
    // Create a mock profile for testing
    let testProfile: playerProfile.PlayerProfile & { level: number, xp: number, xpToNextLevel: number };
    
    beforeEach(() => {
        // Create a fresh test profile before each test
        testProfile = {
            history: {
                [getLocalDateString()]: playerProfile.createDayProgress(getLocalDateString())
            },
            rewards: {
                available: 2 // Start with 2 rewards available
            },
            level: 1,
            xp: 0,
            xpToNextLevel: 840
        };
    });
    
    test('Should initialize with correct rewards', () => {
        // Verify the test profile has 2 rewards
        expect(testProfile.rewards?.available).toBe(2);
        
        // Verify REWARDS contains the expected reward types
        expect(REWARDS.length).toBe(2);
        expect(REWARDS.find(r => r.id === RewardType.EXTEND_PLAY_TIME)).toBeTruthy();
        expect(REWARDS.find(r => r.id === RewardType.REDUCE_COOLDOWN)).toBeTruthy();
    });
    
    test('Should use a reward and decrease available count', () => {
        // Use the extend play time reward
        const updatedProfile = playerProfile.useReward(
            testProfile,
            RewardType.EXTEND_PLAY_TIME,
            60
        );
        
        // Check that available rewards decreased
        expect(updatedProfile.rewards?.available).toBe(1);
        
        // Check that the reward was added to today's history
        const today = getLocalDateString();
        const todayProgress = updatedProfile.history[today];
        
        expect(todayProgress.rewardsUsed?.length).toBe(1);
        expect(todayProgress.rewardsUsed?.[0].type).toBe(RewardType.EXTEND_PLAY_TIME);
        expect(todayProgress.rewardsUsed?.[0].value).toBe(60);
    });
    
    test('Should not allow using rewards if none available', () => {
        // Start with 0 rewards
        testProfile.rewards.available = 0;
        
        // Try to use a reward
        const updatedProfile = playerProfile.useReward(
            testProfile,
            RewardType.EXTEND_PLAY_TIME,
            60
        );
        
        // Should not change the profile
        expect(updatedProfile.rewards?.available).toBe(0);
        
        // Should not add a reward usage to history
        const today = getLocalDateString();
        const todayProgress = updatedProfile.history[today];
        
        expect(todayProgress.rewardsUsed?.length).toBe(0);
    });
    
    test('Should award rewards when leveling up', () => {
        // Create a profile with enough XP to level up
        const today = getLocalDateString();
        
        // Create a day progress for today
        const todayProgress: DayProgress = {
            date: today,
            chores: [],
            playTime: { totalMinutes: 0, sessions: [] },
            xp: { gained: 0, penalties: 0, final: 0 },
            completed: false,
            rewardsUsed: []
        };
        
        // Create the profile
        const profile: PlayerProfile & { level: number, xp: number, xpToNextLevel: number } = {
            history: {
                [today]: todayProgress
            },
            rewards: { available: 2 },
            level: 1,
            xp: 0,
            xpToNextLevel: APP_CONFIG.PROFILE.XP_PER_LEVEL[0]
        };
        
        // Add enough XP to level up
        const addXpResult = playerProfile.addXp(profile, APP_CONFIG.PROFILE.XP_PER_LEVEL[0]);
        
        // Verify the level increased and a reward was added
        expect(addXpResult.level).toBe(2);
        expect(addXpResult.rewards.available).toBe(3); // 2 + 1
        
        // Add more XP for another level up
        const secondLevelUpResult = playerProfile.addXp(addXpResult, APP_CONFIG.PROFILE.XP_PER_LEVEL[1]);
        
        // Verify the level increased again and another reward was added
        expect(secondLevelUpResult.level).toBe(3);
        expect(secondLevelUpResult.rewards.available).toBe(4); // 3 + 1
    });
}); 