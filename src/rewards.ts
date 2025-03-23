export enum RewardType {
    EXTEND_PLAY_TIME = 'EXTEND_PLAY_TIME',
    REDUCE_COOLDOWN = 'REDUCE_COOLDOWN'
}

export interface Reward {
    id: RewardType;
    name: string;
    description: string;
    value: number; // In minutes
}

export const REWARDS: Reward[] = [
    {
        id: RewardType.EXTEND_PLAY_TIME,
        name: "Extra Play Time",
        description: "+5 minutes to play timer (permanent)",
        value: 5
    },
    {
        id: RewardType.REDUCE_COOLDOWN,
        name: "Reduced Cooldown",
        description: "-5 minutes from cooldown timer (permanent)",
        value: 5
    }
];

// Calculate effective play time based on base play time and permanent bonuses
export function calculateEffectivePlayTime(basePlayTimeMinutes: number, permanentBonusMinutes: number): number {
    // Ensure both inputs are valid numbers
    const base = typeof basePlayTimeMinutes === 'number' ? Math.max(0, basePlayTimeMinutes) : 0;
    const bonus = typeof permanentBonusMinutes === 'number' ? Math.max(0, permanentBonusMinutes) : 0;
    
    // Calculate total play time (base + bonus)
    const totalPlayTime = base + bonus;
    
    // Return the calculated value, ensuring it's at least 1 minute
    return Math.max(1, totalPlayTime);
}

// Calculate effective cooldown based on base cooldown and permanent reduction
export function calculateEffectiveCooldown(baseCooldownMinutes: number, permanentReductionMinutes: number): number {
    // Ensure both inputs are valid numbers
    const base = typeof baseCooldownMinutes === 'number' ? Math.max(0, baseCooldownMinutes) : 0;
    const reduction = typeof permanentReductionMinutes === 'number' ? Math.max(0, permanentReductionMinutes) : 0;
    
    // Calculate reduced cooldown time (base - reduction)
    const reducedCooldown = base - reduction;
    
    // Ensure cooldown is never negative
    return Math.max(0, reducedCooldown);
} 