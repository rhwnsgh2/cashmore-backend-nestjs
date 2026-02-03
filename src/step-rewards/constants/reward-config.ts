export type RewardLevel = {
  level: number;
  required_steps: number;
  label: string;
};

export const REWARD_CONFIG: readonly RewardLevel[] = [
  { level: 1, required_steps: 0, label: '첫걸음' },
  { level: 2, required_steps: 2000, label: '2천걸음' },
  { level: 3, required_steps: 4000, label: '4천걸음' },
  { level: 4, required_steps: 6000, label: '6천걸음' },
  { level: 5, required_steps: 8000, label: '8천걸음' },
  { level: 6, required_steps: 10000, label: '1만걸음' },
] as const;

export type ClaimType = 'long' | 'short';

export const LOTTERY_TYPE_MAP = {
  long: 'MAX_500',
  short: 'MAX_100',
} as const;
