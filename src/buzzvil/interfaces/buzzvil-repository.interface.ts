export interface BuzzvilReward {
  user_id: string;
  point_amount: number;
  campaign_id: number | null;
  transaction_id: string;
  title: string;
}

export interface IBuzzvilRepository {
  existsByTransactionId(transactionId: string): Promise<boolean>;
  findRewardByCampaignId(
    userId: string,
    campaignId: number,
  ): Promise<BuzzvilReward | null>;
  findRewardsSince(userId: string, since: string): Promise<BuzzvilReward[]>;
}

export const BUZZVIL_REPOSITORY = Symbol('BUZZVIL_REPOSITORY');
