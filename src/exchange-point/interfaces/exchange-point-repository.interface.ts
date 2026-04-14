export type ExchangePointStatus = 'pending' | 'done' | 'rejected' | 'cancelled';

export interface ExchangePoint {
  id: number;
  user_id: string;
  type: string;
  point_amount: number;
  status: ExchangePointStatus;
  created_at: string;
  additional_data: Record<string, unknown> | null;
}

export interface IExchangePointRepository {
  getTotalPoints(userId: string): Promise<number>;
  /**
   * 한 출금 거래(deduct 행)에 연관된 모든 point_actions 조회
   * - deduct 행 (id = originalPointActionId)
   * - restore 행들 (additional_data.original_point_action_id = originalPointActionId)
   */
  findRelatedToExchange(
    originalPointActionId: number,
  ): Promise<ExchangePoint[]>;
}

export const EXCHANGE_POINT_REPOSITORY = Symbol('EXCHANGE_POINT_REPOSITORY');
