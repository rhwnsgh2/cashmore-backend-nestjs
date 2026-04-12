import type {
  ICashExchangeRepository,
  CashExchange,
  CashExchangeStatus,
  InsertCashExchangeData,
} from '../interfaces/cash-exchange-repository.interface';

export class StubCashExchangeRepository implements ICashExchangeRepository {
  private exchanges: CashExchange[] = [];
  private nextId = 1;

  getAll(): CashExchange[] {
    return this.exchanges;
  }

  clear(): void {
    this.exchanges = [];
    this.nextId = 1;
  }

  insert(data: InsertCashExchangeData): Promise<{ id: number }> {
    const id = this.nextId++;
    const exchange: CashExchange = {
      id,
      user_id: data.user_id,
      amount: data.amount,
      status: 'pending',
      reason: null,
      point_action_id: data.point_action_id,
      confirmed_at: null,
      cancelled_at: null,
      rejected_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.exchanges.push(exchange);
    return Promise.resolve({ id });
  }

  findByStatus(status: CashExchangeStatus): Promise<CashExchange[]> {
    return Promise.resolve(this.exchanges.filter((e) => e.status === status));
  }

  findByUserId(userId: string): Promise<CashExchange[]> {
    return Promise.resolve(this.exchanges.filter((e) => e.user_id === userId));
  }

  findByPointActionId(pointActionId: number): Promise<CashExchange | null> {
    const found = this.exchanges.find(
      (e) => e.point_action_id === pointActionId,
    );
    return Promise.resolve(found ?? null);
  }

  findByPointActionIds(pointActionIds: number[]): Promise<CashExchange[]> {
    if (pointActionIds.length === 0) {
      return Promise.resolve([]);
    }
    const result = this.exchanges.filter(
      (e) =>
        e.point_action_id !== null &&
        pointActionIds.includes(e.point_action_id),
    );
    return Promise.resolve(result);
  }

  findByUserIds(userIds: string[], limit: number): Promise<CashExchange[]> {
    if (userIds.length === 0) {
      return Promise.resolve([]);
    }
    const result = this.exchanges
      .filter((e) => userIds.includes(e.user_id))
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .slice(0, limit);
    return Promise.resolve(result);
  }

  updateStatusBulk(
    pointActionIds: number[],
    status: CashExchangeStatus,
    extra?: { confirmed_at?: string },
  ): Promise<void> {
    for (const exchange of this.exchanges) {
      if (
        exchange.point_action_id !== null &&
        pointActionIds.includes(exchange.point_action_id)
      ) {
        exchange.status = status;
        exchange.updated_at = new Date().toISOString();
        if (extra?.confirmed_at) exchange.confirmed_at = extra.confirmed_at;
      }
    }
    return Promise.resolve();
  }

  updateStatus(
    pointActionId: number,
    status: CashExchangeStatus,
    extra?: {
      reason?: string;
      cancelled_at?: string;
      confirmed_at?: string;
      rejected_at?: string;
    },
  ): Promise<void> {
    const exchange = this.exchanges.find(
      (e) => e.point_action_id === pointActionId,
    );
    if (exchange) {
      exchange.status = status;
      exchange.updated_at = new Date().toISOString();
      if (extra?.reason) exchange.reason = extra.reason;
      if (extra?.cancelled_at) exchange.cancelled_at = extra.cancelled_at;
      if (extra?.confirmed_at) exchange.confirmed_at = extra.confirmed_at;
      if (extra?.rejected_at) exchange.rejected_at = extra.rejected_at;
    }
    return Promise.resolve();
  }
}
