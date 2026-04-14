import type {
  IBuzzvilRepository,
  BuzzvilReward,
} from '../interfaces/buzzvil-repository.interface';
import type { StubPointWriteRepository } from '../../point-write/repositories/stub-point-write.repository';

export class StubBuzzvilRepository implements IBuzzvilRepository {
  constructor(private pointWriteRepository: StubPointWriteRepository) {}

  private buzzvilActions() {
    return this.pointWriteRepository
      .getInsertedActions()
      .filter((a) => a.type === 'BUZZVIL_REWARD');
  }

  existsByTransactionId(transactionId: string): Promise<boolean> {
    return Promise.resolve(
      this.buzzvilActions().some(
        (a) => a.additionalData.transaction_id === transactionId,
      ),
    );
  }

  findRewardByCampaignId(
    userId: string,
    campaignId: number,
  ): Promise<BuzzvilReward | null> {
    const found = this.buzzvilActions().find(
      (a) => a.userId === userId && a.additionalData.campaign_id === campaignId,
    );
    if (!found) return Promise.resolve(null);
    return Promise.resolve({
      user_id: found.userId,
      point_amount: found.amount,
      campaign_id: found.additionalData.campaign_id as number | null,
      transaction_id: found.additionalData.transaction_id as string,
      title: (found.additionalData.title as string) ?? '',
    });
  }

  findRewardsSince(userId: string, _since: string): Promise<BuzzvilReward[]> {
    const rewards = this.buzzvilActions()
      .filter((a) => a.userId === userId)
      .map((a) => ({
        user_id: a.userId,
        point_amount: a.amount,
        campaign_id: a.additionalData.campaign_id as number | null,
        transaction_id: a.additionalData.transaction_id as string,
        title: (a.additionalData.title as string) ?? '',
      }));
    return Promise.resolve(rewards);
  }
}
