export interface CouponSendLogRow {
  id: number;
  exchange_id: number;
  receiver_phone: string;
  sent_at: string;
}

export interface ICouponSendLogRepository {
  insert(exchangeId: number, receiverPhone: string): Promise<CouponSendLogRow>;
  findByExchangeId(exchangeId: number): Promise<CouponSendLogRow[]>;
}

export const COUPON_SEND_LOG_REPOSITORY = Symbol('COUPON_SEND_LOG_REPOSITORY');
