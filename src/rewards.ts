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
        description: "+60 minutes to play timer",
        value: 60
    },
    {
        id: RewardType.REDUCE_COOLDOWN,
        name: "Reduced Cooldown",
        description: "-60 minutes from cooldown timer",
        value: 60
    }
]; 