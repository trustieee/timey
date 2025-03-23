import { RewardType, REWARDS, calculateEffectivePlayTime, calculateEffectiveCooldown } from '../rewards';
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
                available: 2, // Start with 2 rewards available
                permanent: {} // Initialize empty permanent rewards
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
    
    test('Should use a reward and apply it permanently', () => {
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
        
        // Check that the reward was applied permanently
        expect(updatedProfile.rewards.permanent[RewardType.EXTEND_PLAY_TIME]).toBe(60);
        
        // Use another reward of the same type and verify it accumulates
        const furtherUpdatedProfile = playerProfile.useReward(
            updatedProfile,
            RewardType.EXTEND_PLAY_TIME,
            60
        );
        
        // Check accumulated permanent value
        expect(furtherUpdatedProfile.rewards.permanent[RewardType.EXTEND_PLAY_TIME]).toBe(120);
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
        
        // Should not add permanent reward
        expect(updatedProfile.rewards.permanent[RewardType.EXTEND_PLAY_TIME]).toBeUndefined();
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
            rewards: { available: 2, permanent: {} },
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
    
    test('Should retrieve permanent bonus values correctly', () => {
        // First set up some permanent rewards
        let profile = testProfile;
        
        // Make sure we have enough rewards to apply all bonuses
        profile.rewards.available = 3;
        
        // Add permanent play time bonus
        profile = playerProfile.useReward(profile, RewardType.EXTEND_PLAY_TIME, 60);
        profile = playerProfile.useReward(profile, RewardType.EXTEND_PLAY_TIME, 60);
        
        // Add permanent cooldown reduction
        profile = playerProfile.useReward(profile, RewardType.REDUCE_COOLDOWN, 30);
        
        // Log the rewards object for debugging
        console.log('Permanent rewards:', JSON.stringify(profile.rewards.permanent));
        
        // Check the getter functions
        expect(playerProfile.getPermanentPlayTimeBonus(profile)).toBe(120); // 60 + 60
        expect(playerProfile.getPermanentCooldownReduction(profile)).toBe(30);
    });
    
    test('Should calculate effective play time and cooldown correctly', () => {
        // Test calculating effective play time
        expect(calculateEffectivePlayTime(120, 60)).toBe(180); // Base 120 + permanent 60 = 180
        expect(calculateEffectivePlayTime(120, 0)).toBe(120);  // No bonus
        expect(calculateEffectivePlayTime(120, 120)).toBe(240); // Base 120 + permanent 120 = 240
        
        // Test calculating effective cooldown
        expect(calculateEffectiveCooldown(180, 60)).toBe(120); // Base 180 - reduction 60 = 120
        expect(calculateEffectiveCooldown(60, 30)).toBe(30);   // Base 60 - reduction 30 = 30
        expect(calculateEffectiveCooldown(60, 60)).toBe(0);    // Cooldown reduced to 0
        expect(calculateEffectiveCooldown(60, 120)).toBe(0);   // Cooldown cannot go below 0
    });
    
    // New test cases for edge cases and additional scenarios
    
    test('Should handle using multiple rewards of different types correctly', () => {
        // Ensure we have enough rewards
        testProfile.rewards.available = 5;
        
        // Apply multiple rewards of different types
        let updatedProfile = testProfile;
        
        // First, add play time bonuses
        updatedProfile = playerProfile.useReward(updatedProfile, RewardType.EXTEND_PLAY_TIME, 10);
        updatedProfile = playerProfile.useReward(updatedProfile, RewardType.EXTEND_PLAY_TIME, 15);
        
        // Then, add cooldown reductions
        updatedProfile = playerProfile.useReward(updatedProfile, RewardType.REDUCE_COOLDOWN, 5);
        updatedProfile = playerProfile.useReward(updatedProfile, RewardType.REDUCE_COOLDOWN, 10);
        
        // Check that both types of rewards are accumulated correctly
        expect(updatedProfile.rewards.permanent[RewardType.EXTEND_PLAY_TIME]).toBe(25); // 10 + 15
        expect(updatedProfile.rewards.permanent[RewardType.REDUCE_COOLDOWN]).toBe(15); // 5 + 10
        expect(updatedProfile.rewards.available).toBe(1); // 5 - 4 = 1 remaining
    });
    
    test('Should handle extremely large reward values', () => {
        // Start with 1 reward
        testProfile.rewards.available = 1;
        
        // Use reward with very large value
        const largeValue = 10000; // 10,000 minutes (extreme case)
        const updatedProfile = playerProfile.useReward(
            testProfile,
            RewardType.EXTEND_PLAY_TIME,
            largeValue
        );
        
        // Check that the large value was properly saved
        expect(updatedProfile.rewards.permanent[RewardType.EXTEND_PLAY_TIME]).toBe(largeValue);
        
        // Verify calculation works with large values
        expect(calculateEffectivePlayTime(60, largeValue)).toBe(60 + largeValue);
    });
    
    test('Should work with zero and negative reward values', () => {
        // Using zero as reward value
        testProfile.rewards.available = 2;
        let updatedProfile = playerProfile.useReward(
            testProfile,
            RewardType.EXTEND_PLAY_TIME,
            0
        );
        
        // Check that zero value was added
        expect(updatedProfile.rewards.permanent[RewardType.EXTEND_PLAY_TIME]).toBe(0);
        expect(updatedProfile.rewards.available).toBe(1);
        
        // Using negative value - should be converted to 0 by our validation
        updatedProfile = playerProfile.useReward(
            updatedProfile,
            RewardType.EXTEND_PLAY_TIME,
            -10
        );
        
        // Check that the validation prevented negative values
        expect(updatedProfile.rewards.permanent[RewardType.EXTEND_PLAY_TIME]).toBe(0); // 0 + 0
        expect(updatedProfile.rewards.available).toBe(0);
        
        // The effective calculation should handle this reasonably
        expect(calculateEffectivePlayTime(60, 0)).toBe(60);
    });
    
    test('Should persist permanent rewards correctly through profile save/load cycle', () => {
        // Set up a profile with rewards
        testProfile.rewards.available = 2;
        const profile = playerProfile.useReward(
            testProfile,
            RewardType.EXTEND_PLAY_TIME,
            45
        );
        
        // Create a snapshot of the profile that would be saved
        const storageProfile = {
            history: profile.history,
            rewards: profile.rewards
        };
        
        // Verify the reward was applied correctly
        expect(storageProfile.rewards.permanent[RewardType.EXTEND_PLAY_TIME]).toBe(45);
        expect(profile.rewards.available).toBe(1);
        
        // Verify the reward is correctly included in the profile
        const rewardType = RewardType.EXTEND_PLAY_TIME;
        const permanentValue = profile.rewards.permanent[rewardType];
        expect(permanentValue).toBe(45);
    });
    
    test('Should handle multiple reward applications to reach max values', () => {
        // Set up a scenario where cooldown would be reduced to 0
        const baseCooldown = APP_CONFIG.TIMER.COOLDOWN_TIME_MINUTES;
        testProfile.rewards.available = 10; // Plenty of rewards
        
        let profile = testProfile;
        
        // Apply enough cooldown reduction to exceed the base cooldown
        for (let i = 0; i < 10; i++) {
            profile = playerProfile.useReward(profile, RewardType.REDUCE_COOLDOWN, 1);
        }
        
        // Total reduction should be 10 minutes
        expect(profile.rewards.permanent[RewardType.REDUCE_COOLDOWN]).toBe(10);
        
        // When calculating effective cooldown, it should be capped at 0
        const effectiveCooldown = calculateEffectiveCooldown(
            baseCooldown, 
            profile.rewards.permanent[RewardType.REDUCE_COOLDOWN]
        );
        
        // If base cooldown is less than 10, it should be 0
        if (baseCooldown <= 10) {
            expect(effectiveCooldown).toBe(0);
        } else {
            expect(effectiveCooldown).toBe(baseCooldown - 10);
        }
    });
    
    test('Should apply rewards correctly when permanent object is missing', () => {
        // Create a profile with missing permanent field
        const profileWithoutPermanent: PlayerProfile & {level: number, xp: number, xpToNextLevel: number} = {
            ...testProfile,
            rewards: {
                available: 3
            } as any // Purposely create an incorrect type to simulate legacy data
        };
        
        // Use a reward
        const updatedProfile = playerProfile.useReward(
            profileWithoutPermanent,
            RewardType.EXTEND_PLAY_TIME,
            30
        );
        
        // The function should initialize the permanent field and apply the reward
        expect(updatedProfile.rewards.permanent).toBeDefined();
        expect(updatedProfile.rewards.permanent[RewardType.EXTEND_PLAY_TIME]).toBe(30);
    });
    
    test('Should retrieve correct permanentBonus value when rewards object is missing', () => {
        // Simulate profile with missing rewards object
        const profileWithoutRewards: PlayerProfile = {
            history: {},
        } as any; // Purposely incomplete to simulate corrupted data
        
        // Get permanent bonuses
        const playTimeBonus = playerProfile.getPermanentPlayTimeBonus(profileWithoutRewards);
        const cooldownReduction = playerProfile.getPermanentCooldownReduction(profileWithoutRewards);
        
        // Should return 0 as default value
        expect(playTimeBonus).toBe(0);
        expect(cooldownReduction).toBe(0);
    });
    
    test('Should add exactly the specified reward amounts', () => {
        // Start with several rewards
        testProfile.rewards.available = 5;
        
        // Apply specific amounts of rewards
        let profile = testProfile;
        
        // Play time rewards with specific values
        profile = playerProfile.useReward(profile, RewardType.EXTEND_PLAY_TIME, 5);
        profile = playerProfile.useReward(profile, RewardType.EXTEND_PLAY_TIME, 7);
        profile = playerProfile.useReward(profile, RewardType.EXTEND_PLAY_TIME, 13);
        
        // Cooldown rewards with specific values
        profile = playerProfile.useReward(profile, RewardType.REDUCE_COOLDOWN, 4);
        profile = playerProfile.useReward(profile, RewardType.REDUCE_COOLDOWN, 9);
        
        // Check exact values for play time
        expect(profile.rewards.permanent[RewardType.EXTEND_PLAY_TIME]).toBe(25); // 5 + 7 + 13
        // Check exact values for cooldown
        expect(profile.rewards.permanent[RewardType.REDUCE_COOLDOWN]).toBe(13); // 4 + 9
        // Check remaining rewards
        expect(profile.rewards.available).toBe(0); // All 5 used
    });
}); 