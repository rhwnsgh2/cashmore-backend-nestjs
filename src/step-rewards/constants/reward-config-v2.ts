export type LotteryTypeV2 = 'MAX_100' | 'MAX_500' | 'MAX_1000';
export type AdType = 'rewarded' | 'interstitial';

export type RewardLevelV2 = {
  required_steps: number;
  label: string;
  lottery_type: LotteryTypeV2;
  ad_type: AdType;
};

export const REWARD_CONFIG_V2: readonly RewardLevelV2[] = [
  {
    required_steps: 0,
    label: '첫걸음',
    lottery_type: 'MAX_500',
    ad_type: 'rewarded',
  },
  {
    required_steps: 1000,
    label: '1천걸음',
    lottery_type: 'MAX_100',
    ad_type: 'interstitial',
  },
  {
    required_steps: 2000,
    label: '2천걸음',
    lottery_type: 'MAX_100',
    ad_type: 'interstitial',
  },
  {
    required_steps: 3000,
    label: '3천걸음',
    lottery_type: 'MAX_100',
    ad_type: 'interstitial',
  },
  {
    required_steps: 4000,
    label: '4천걸음',
    lottery_type: 'MAX_100',
    ad_type: 'interstitial',
  },
  {
    required_steps: 5000,
    label: '5천걸음',
    lottery_type: 'MAX_500',
    ad_type: 'rewarded',
  },
  {
    required_steps: 6000,
    label: '6천걸음',
    lottery_type: 'MAX_100',
    ad_type: 'interstitial',
  },
  {
    required_steps: 7000,
    label: '7천걸음',
    lottery_type: 'MAX_100',
    ad_type: 'interstitial',
  },
  {
    required_steps: 8000,
    label: '8천걸음',
    lottery_type: 'MAX_100',
    ad_type: 'interstitial',
  },
  {
    required_steps: 9000,
    label: '9천걸음',
    lottery_type: 'MAX_100',
    ad_type: 'interstitial',
  },
  {
    required_steps: 10000,
    label: '1만걸음',
    lottery_type: 'MAX_1000',
    ad_type: 'rewarded',
  },
] as const;
