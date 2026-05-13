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
  send_status: 'pending' | 'sent' | 'send_failed' | 'refunded' | 'rejected';
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
}

export type CouponExchangeStatus = CouponExchangeRow['send_status'];

export interface CouponExchangeInsertInput {
  user_id: string;
  point_action_id: number | null;
  amount: number;
  smartcon_goods_id: string;
  tr_id: string;
  idempotency_key?: string | null;
}

export interface CouponExchangeUpdatePointActionInput {
  point_action_id: number;
}

export interface CouponExchangeUpdateInput {
  send_status: 'sent' | 'send_failed' | 'refunded' | 'rejected';
  order_id?: string | null;
  barcode_num?: string | null;
  exp_date?: string | null; // YYYY-MM-DD
  result_code?: string | null;
  result_msg?: string | null;
}

export interface ICouponExchangeRepository {
  insert(input: CouponExchangeInsertInput): Promise<CouponExchangeRow>;

  /**
   * INSERT 시 idempotency_key UNIQUE 충돌이면 null 반환 (호출자가 findByIdempotencyKey로 재조회).
   * idempotency_key가 null이면 일반 insert와 동일.
   */
  insertOrConflict(
    input: CouponExchangeInsertInput,
  ): Promise<CouponExchangeRow | null>;

  findByIdempotencyKey(key: string): Promise<CouponExchangeRow | null>;

  updateSendResult(
    id: number,
    patch: CouponExchangeUpdateInput,
  ): Promise<CouponExchangeRow>;

  /** 차감 후 point_action_id를 채워넣기. */
  updatePointActionId(
    id: number,
    pointActionId: number,
  ): Promise<CouponExchangeRow>;

  findById(id: number): Promise<CouponExchangeRow | null>;
  findByUserId(userId: string, limit?: number): Promise<CouponExchangeRow[]>;

  /**
   * 어드민용 status별 조회.
   * pending은 created_at ASC (FIFO 큐), 그 외는 DESC (최근 순).
   * offset 기반 페이지네이션.
   */
  findByStatusPaged(
    status: CouponExchangeStatus,
    offset: number,
    limit: number,
  ): Promise<CouponExchangeRow[]>;

  /** 어드민용 status별 행 수. */
  countByStatus(status: CouponExchangeStatus): Promise<number>;

  /**
   * 통계용 — updated_at 범위 안의 sent 행 (amount만 필요).
   * 기간 [updatedAtFromIso, updatedAtToIso).
   */
  findSentByUpdatedAtRange(
    updatedAtFromIso: string,
    updatedAtToIso: string,
  ): Promise<Array<{ amount: number; updated_at: string }>>;
}

export const COUPON_EXCHANGE_REPOSITORY = Symbol('COUPON_EXCHANGE_REPOSITORY');
