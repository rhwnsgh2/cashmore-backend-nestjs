import { Injectable } from '@nestjs/common';
import type {
  ICouponSendLogRepository,
  CouponSendLogRow,
} from '../interfaces/coupon-send-log-repository.interface';

@Injectable()
export class StubCouponSendLogRepository implements ICouponSendLogRepository {
  private store: CouponSendLogRow[] = [];
  private nextId = 1;

  async insert(
    exchangeId: number,
    receiverPhone: string,
  ): Promise<CouponSendLogRow> {
    const row: CouponSendLogRow = {
      id: this.nextId++,
      exchange_id: exchangeId,
      receiver_phone: receiverPhone,
      sent_at: new Date().toISOString(),
    };
    this.store.push(row);
    return row;
  }

  async findByExchangeId(exchangeId: number): Promise<CouponSendLogRow[]> {
    return this.store
      .filter((r) => r.exchange_id === exchangeId)
      .sort((a, b) => a.sent_at.localeCompare(b.sent_at));
  }

  clear(): void {
    this.store = [];
    this.nextId = 1;
  }
}
