import type {
  IBuzzvilRepository,
  InsertBuzzvilPointAction,
  BuzzvilReward,
} from '../interfaces/buzzvil-repository.interface';

export class StubBuzzvilRepository implements IBuzzvilRepository {
  private pointActions: InsertBuzzvilPointAction[] = [];

  existsByTransactionId(transactionId: string): Promise<boolean> {
    return Promise.resolve(
      this.pointActions.some(
        (a) => a.additional_data.transaction_id === transactionId,
      ),
    );
  }

  insertPointAction(data: InsertBuzzvilPointAction): Promise<void> {
    this.pointActions.push(data);
    return Promise.resolve();
  }

  findRewardByCampaignId(
    userId: string,
    campaignId: number,
  ): Promise<BuzzvilReward | null> {
    const found = this.pointActions.find(
      (a) =>
        a.user_id === userId && a.additional_data.campaign_id === campaignId,
    );
    if (!found) return Promise.resolve(null);
    return Promise.resolve({
      user_id: found.user_id,
      point_amount: found.point_amount,
      campaign_id: found.additional_data.campaign_id,
      transaction_id: found.additional_data.transaction_id,
    });
  }

  getAll(): InsertBuzzvilPointAction[] {
    return this.pointActions;
  }

  clear(): void {
    this.pointActions = [];
  }
}
