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
