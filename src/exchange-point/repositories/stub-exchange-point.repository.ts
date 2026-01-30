import type {
  IExchangePointRepository,
  ExchangePoint,
  InsertExchangePointData,
} from '../interfaces/exchange-point-repository.interface';

export class StubExchangePointRepository implements IExchangePointRepository {
  private exchanges: Map<string, ExchangePoint[]> = new Map();
  private totalPoints: Map<string, number> = new Map();
  private nextId = 1;

  setExchanges(userId: string, exchanges: ExchangePoint[]): void {
    this.exchanges.set(userId, exchanges);
  }

  setTotalPoints(userId: string, total: number): void {
    this.totalPoints.set(userId, total);
  }

  clear(): void {
    this.exchanges.clear();
    this.totalPoints.clear();
    this.nextId = 1;
  }

  findByUserId(userId: string): Promise<ExchangePoint[]> {
    return Promise.resolve(this.exchanges.get(userId) || []);
  }

  getTotalPoints(userId: string): Promise<number> {
    return Promise.resolve(this.totalPoints.get(userId) ?? 0);
  }

  insertExchangeRequest(
    data: InsertExchangePointData,
  ): Promise<{ id: number }> {
    const id = this.nextId++;
    const exchange: ExchangePoint = {
      id,
      user_id: data.user_id,
      type: data.type,
      point_amount: data.point_amount,
      status: data.status as ExchangePoint['status'],
      created_at: new Date().toISOString(),
      additional_data: null,
    };

    const userExchanges = this.exchanges.get(data.user_id) || [];
    userExchanges.push(exchange);
    this.exchanges.set(data.user_id, userExchanges);

    // 잔액 차감
    const currentTotal = this.totalPoints.get(data.user_id) ?? 0;
    this.totalPoints.set(data.user_id, currentTotal + data.point_amount);

    return Promise.resolve({ id });
  }

  findById(id: number, userId: string): Promise<ExchangePoint | null> {
    const userExchanges = this.exchanges.get(userId) || [];
    const found = userExchanges.find((e) => e.id === id) || null;
    return Promise.resolve(found);
  }

  cancelExchangeRequest(id: number, userId: string): Promise<void> {
    const userExchanges = this.exchanges.get(userId) || [];
    const exchange = userExchanges.find((e) => e.id === id);
    if (exchange) {
      exchange.status = 'cancelled';
      exchange.additional_data = {
        confirmed_at: null,
        rejected_at: null,
        cancelled_at: new Date().toISOString(),
      };
      // 잔액 복구
      const currentTotal = this.totalPoints.get(userId) ?? 0;
      this.totalPoints.set(userId, currentTotal - exchange.point_amount);
    }
    return Promise.resolve();
  }
}
