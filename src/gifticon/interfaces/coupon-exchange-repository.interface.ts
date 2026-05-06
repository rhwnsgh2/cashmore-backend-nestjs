export interface CouponExchangeRow {
  id: number;
  user_id: string;
  point_action_id: number | null;
  amount: number;
  smartcon_goods_id: string;
  tr_id: string;
  order_id: string | null;
  barcode_num: string | null;
  exp_date: string | null;
  result_code: string | null;
  result_msg: string | null;
  send_status: 'pending' | 'sent' | 'send_failed' | 'refunded';
  created_at: string;
  updated_at: string;
}

export interface CouponExchangeInsertInput {
  user_id: string;
  point_action_id: number | null;
  amount: number;
  smartcon_goods_id: string;
  tr_id: string;
}

export interface CouponExchangeUpdateInput {
  send_status: 'sent' | 'send_failed' | 'refunded';
  order_id?: string | null;
  barcode_num?: string | null;
  exp_date?: string | null; // YYYY-MM-DD
  result_code?: string | null;
  result_msg?: string | null;
}

export interface ICouponExchangeRepository {
  insert(input: CouponExchangeInsertInput): Promise<CouponExchangeRow>;
  updateSendResult(
    id: number,
    patch: CouponExchangeUpdateInput,
  ): Promise<CouponExchangeRow>;
  findById(id: number): Promise<CouponExchangeRow | null>;
  findByUserId(userId: string, limit?: number): Promise<CouponExchangeRow[]>;
}

export const COUPON_EXCHANGE_REPOSITORY = Symbol('COUPON_EXCHANGE_REPOSITORY');
