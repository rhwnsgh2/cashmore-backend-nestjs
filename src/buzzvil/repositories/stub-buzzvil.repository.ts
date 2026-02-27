import type {
  IBuzzvilRepository,
  InsertBuzzvilPointAction,
  BuzzvilReward,
} from '../interfaces/buzzvil-repository.interface';

export class StubBuzzvilRepository implements IBuzzvilRepository {
  private pointActions: InsertBuzzvilPointAction[] = [];

  async existsByTransactionId(transactionId: string): Promise<boolean> {
    return this.pointActions.some(
      (a) => a.additional_data.transaction_id === transactionId,
    );
  }

  async insertPointAction(data: InsertBuzzvilPointAction): Promise<void> {
    this.pointActions.push(data);
  }

  async findRewardByCampaignId(
    userId: string,
    campaignId: number,
  ): Promise<BuzzvilReward | null> {
    const found = this.pointActions.find(
      (a) =>
        a.user_id === userId &&
        a.additional_data.campaign_id === campaignId,
    );
    if (!found) return null;
    return {
      user_id: found.user_id,
      point_amount: found.point_amount,
      campaign_id: found.additional_data.campaign_id,
      transaction_id: found.additional_data.transaction_id,
    };
  }

  getAll(): InsertBuzzvilPointAction[] {
    return this.pointActions;
  }

  clear(): void {
    this.pointActions = [];
  }
}
