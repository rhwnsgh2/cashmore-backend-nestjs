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

  private byIdempotencyKey = new Map<string, number>();

  async insert(input: CouponExchangeInsertInput): Promise<CouponExchangeRow> {
    if (this.byTrId.has(input.tr_id)) {
      throw new Error(`duplicate tr_id: ${input.tr_id}`);
    }
    if (
      input.idempotency_key &&
      this.byIdempotencyKey.has(input.idempotency_key)
    ) {
      throw new Error(`duplicate idempotency_key: ${input.idempotency_key}`);
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
      idempotency_key: input.idempotency_key ?? null,
      created_at: now,
      updated_at: now,
    };
    this.store.set(row.id, row);
    this.byTrId.set(input.tr_id, row.id);
    if (input.idempotency_key) {
      this.byIdempotencyKey.set(input.idempotency_key, row.id);
    }
    return row;
  }

  async insertOrConflict(
    input: CouponExchangeInsertInput,
  ): Promise<CouponExchangeRow | null> {
    if (
      input.idempotency_key &&
      this.byIdempotencyKey.has(input.idempotency_key)
    ) {
      return null;
    }
    return this.insert(input);
  }

  async findByIdempotencyKey(key: string): Promise<CouponExchangeRow | null> {
    const id = this.byIdempotencyKey.get(key);
    return id ? (this.store.get(id) ?? null) : null;
  }

  async updatePointActionId(
    id: number,
    pointActionId: number,
  ): Promise<CouponExchangeRow> {
    const row = this.store.get(id);
    if (!row) throw new Error(`coupon_exchanges row not found: ${id}`);
    row.point_action_id = pointActionId;
    row.updated_at = new Date().toISOString();
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

  async findByStatus(
    status: CouponExchangeRow['send_status'],
    limit = 100,
  ): Promise<CouponExchangeRow[]> {
    return [...this.store.values()]
      .filter((r) => r.send_status === status)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(0, limit);
  }

  clear(): void {
    this.store.clear();
    this.byTrId.clear();
    this.byIdempotencyKey.clear();
    this.nextId = 1;
  }
}
