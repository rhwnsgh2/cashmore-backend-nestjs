import { Injectable } from '@nestjs/common';
import type {
  ICouponExchangeRepository,
  CouponExchangeRow,
  CouponExchangeInsertInput,
  CouponExchangeUpdateInput,
} from '../interfaces/coupon-exchange-repository.interface';

@Injectable()
export class StubCouponExchangeRepository implements ICouponExchangeRepository {
  private store = new Map<number, CouponExchangeRow>();
  private byTrId = new Map<string, number>();
  private nextId = 1;

  async insert(input: CouponExchangeInsertInput): Promise<CouponExchangeRow> {
    if (this.byTrId.has(input.tr_id)) {
      throw new Error(`duplicate tr_id: ${input.tr_id}`);
    }
    const now = new Date().toISOString();
    const row: CouponExchangeRow = {
      id: this.nextId++,
      user_id: input.user_id,
      point_action_id: input.point_action_id,
      amount: input.amount,
      smartcon_goods_id: input.smartcon_goods_id,
      tr_id: input.tr_id,
      order_id: null,
      barcode_num: null,
      exp_date: null,
      result_code: null,
      result_msg: null,
      send_status: 'pending',
      created_at: now,
      updated_at: now,
    };
    this.store.set(row.id, row);
    this.byTrId.set(input.tr_id, row.id);
    return row;
  }

  async updateSendResult(
    id: number,
    patch: CouponExchangeUpdateInput,
  ): Promise<CouponExchangeRow> {
    const row = this.store.get(id);
    if (!row) throw new Error(`coupon_exchanges row not found: ${id}`);
    row.send_status = patch.send_status;
    if (patch.order_id !== undefined) row.order_id = patch.order_id;
    if (patch.barcode_num !== undefined) row.barcode_num = patch.barcode_num;
    if (patch.exp_date !== undefined) row.exp_date = patch.exp_date;
    if (patch.result_code !== undefined) row.result_code = patch.result_code;
    if (patch.result_msg !== undefined) row.result_msg = patch.result_msg;
    row.updated_at = new Date().toISOString();
    return row;
  }

  async findById(id: number): Promise<CouponExchangeRow | null> {
    return this.store.get(id) ?? null;
  }

  async findByUserId(userId: string, limit = 50): Promise<CouponExchangeRow[]> {
    return [...this.store.values()]
      .filter((r) => r.user_id === userId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  }

  clear(): void {
    this.store.clear();
    this.byTrId.clear();
    this.nextId = 1;
  }
}
