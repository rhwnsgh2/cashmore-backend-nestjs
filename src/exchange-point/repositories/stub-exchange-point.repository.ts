import type {
  IExchangePointRepository,
  ExchangePoint,
} from '../interfaces/exchange-point-repository.interface';
import type { StubPointWriteRepository } from '../../point-write/repositories/stub-point-write.repository';

export class StubExchangePointRepository implements IExchangePointRepository {
  private seededExchanges: Map<string, ExchangePoint[]> = new Map();
  private seededTotalPoints: Map<string, number> = new Map();

  constructor(private pointWriteRepository: StubPointWriteRepository) {}

  setExchanges(userId: string, exchanges: ExchangePoint[]): void {
    this.seededExchanges.set(userId, exchanges);
  }

  setTotalPoints(userId: string, total: number): void {
    this.seededTotalPoints.set(userId, total);
  }

  getExchangesByUserId(userId: string): ExchangePoint[] {
    const seeded = this.seededExchanges.get(userId) ?? [];
    const written = this.pointWriteRepository
      .getInsertedActions()
      .filter((a) => a.type === 'EXCHANGE_POINT_TO_CASH' && a.userId === userId)
      .map<ExchangePoint>((a) => ({
        id: a.id,
        user_id: a.userId,
        type: a.type,
        point_amount: a.amount,
        status: a.status as ExchangePoint['status'],
        created_at: new Date().toISOString(),
        additional_data: { ...a.additionalData },
      }));
    return [...seeded, ...written];
  }

  getTotalPoints(userId: string): Promise<number> {
    const seeded = this.seededTotalPoints.get(userId) ?? 0;
    const written = this.pointWriteRepository
      .getInsertedActions()
      .filter((a) => a.userId === userId)
      .reduce((sum, a) => sum + a.amount, 0);
    return Promise.resolve(seeded + written);
  }

  findRelatedToExchange(
    originalPointActionId: number,
  ): Promise<ExchangePoint[]> {
    const all: ExchangePoint[] = [];
    for (const exchanges of this.seededExchanges.values()) {
      all.push(...exchanges);
    }
    const written = this.pointWriteRepository
      .getInsertedActions()
      .filter((a) => a.type === 'EXCHANGE_POINT_TO_CASH')
      .map<ExchangePoint>((a) => ({
        id: a.id,
        user_id: a.userId,
        type: a.type,
        point_amount: a.amount,
        status: a.status as ExchangePoint['status'],
        created_at: new Date().toISOString(),
        additional_data: { ...a.additionalData },
      }));
    all.push(...written);

    const matched = all.filter((e) => {
      if (e.type !== 'EXCHANGE_POINT_TO_CASH') return false;
      if (e.id === originalPointActionId) return true;
      if (
        e.additional_data &&
        typeof e.additional_data === 'object' &&
        e.additional_data.original_point_action_id === originalPointActionId
      ) {
        return true;
      }
      return false;
    });

    return Promise.resolve(
      matched.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      ),
    );
  }
}
