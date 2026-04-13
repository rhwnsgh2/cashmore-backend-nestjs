import type {
  IExchangePointRepository,
  ExchangePoint,
  InsertExchangePointData,
  InsertRestoreActionData,
} from '../interfaces/exchange-point-repository.interface';

export class StubExchangePointRepository implements IExchangePointRepository {
  private exchanges: Map<string, ExchangePoint[]> = new Map();
  private totalPoints: Map<string, number> = new Map();
  private nextId = 1;

  setExchanges(userId: string, exchanges: ExchangePoint[]): void {
    this.exchanges.set(userId, exchanges);
  }

  getExchangesByUserId(userId: string): ExchangePoint[] {
    return this.exchanges.get(userId) ?? [];
  }

  setTotalPoints(userId: string, total: number): void {
    this.totalPoints.set(userId, total);
  }

  clear(): void {
    this.exchanges.clear();
    this.totalPoints.clear();
    this.nextId = 1;
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

  insertRestoreAction(data: InsertRestoreActionData): Promise<{ id: number }> {
    const id = this.nextId++;
    const additionalData: Record<string, unknown> = {
      original_point_action_id: data.original_point_action_id,
    };
    if (data.reason) {
      additionalData.reason = data.reason;
    }

    const exchange: ExchangePoint = {
      id,
      user_id: data.user_id,
      type: 'EXCHANGE_POINT_TO_CASH',
      point_amount: data.amount, // 양수 (복원)
      status: 'done',
      created_at: new Date().toISOString(),
      additional_data: additionalData,
    };

    const userExchanges = this.exchanges.get(data.user_id) || [];
    userExchanges.push(exchange);
    this.exchanges.set(data.user_id, userExchanges);

    // 잔액 복원
    const currentTotal = this.totalPoints.get(data.user_id) ?? 0;
    this.totalPoints.set(data.user_id, currentTotal + data.amount);

    return Promise.resolve({ id });
  }

  findById(id: number, userId: string): Promise<ExchangePoint | null> {
    const userExchanges = this.exchanges.get(userId) || [];
    const found = userExchanges.find((e) => e.id === id) || null;
    return Promise.resolve(found);
  }

  findByIds(ids: number[]): Promise<ExchangePoint[]> {
    const results: ExchangePoint[] = [];
    for (const exchanges of this.exchanges.values()) {
      results.push(...exchanges.filter((e) => ids.includes(e.id)));
    }
    return Promise.resolve(results);
  }

  findRelatedToExchange(
    originalPointActionId: number,
  ): Promise<ExchangePoint[]> {
    const results: ExchangePoint[] = [];
    for (const exchanges of this.exchanges.values()) {
      for (const e of exchanges) {
        if (e.type !== 'EXCHANGE_POINT_TO_CASH') continue;
        const isOriginal = e.id === originalPointActionId;
        const isRestore =
          e.additional_data &&
          typeof e.additional_data === 'object' &&
          e.additional_data.original_point_action_id === originalPointActionId;
        if (isOriginal || isRestore) {
          results.push(e);
        }
      }
    }
    return Promise.resolve(
      results.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      ),
    );
  }

  approveExchangeRequests(ids: number[]): Promise<void> {
    for (const exchanges of this.exchanges.values()) {
      for (const exchange of exchanges) {
        if (ids.includes(exchange.id)) {
          exchange.status = 'done';
          exchange.additional_data = {
            confirmed_at: new Date().toISOString(),
            rejected_at: null,
            cancelled_at: null,
          };
        }
      }
    }
    return Promise.resolve();
  }

  rejectExchangeRequest(id: number, reason: string): Promise<void> {
    for (const exchanges of this.exchanges.values()) {
      const exchange = exchanges.find((e) => e.id === id);
      if (exchange) {
        exchange.status = 'rejected';
        exchange.additional_data = {
          confirmed_at: null,
          rejected_at: new Date().toISOString(),
          cancelled_at: null,
          reason,
        };
      }
    }
    return Promise.resolve();
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
