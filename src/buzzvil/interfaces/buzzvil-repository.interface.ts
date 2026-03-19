export interface BuzzvilReward {
  user_id: string;
  point_amount: number;
  campaign_id: number | null;
  transaction_id: string;
  title: string;
}

export interface InsertBuzzvilPointAction {
  user_id: string;
  type: 'BUZZVIL_REWARD';
  point_amount: number;
  status: 'done';
  additional_data: {
    transaction_id: string;
    campaign_id: number | null;
    action_type: string;
    revenue_type: string;
    title: string;
    unit_id: string;
    event_at: number;
  };
}

export interface IBuzzvilRepository {
  existsByTransactionId(transactionId: string): Promise<boolean>;
  insertPointAction(data: InsertBuzzvilPointAction): Promise<void>;
  findRewardByCampaignId(
    userId: string,
    campaignId: number,
  ): Promise<BuzzvilReward | null>;
  findRewardsSince(userId: string, since: string): Promise<BuzzvilReward[]>;
}

export const BUZZVIL_REPOSITORY = Symbol('BUZZVIL_REPOSITORY');
