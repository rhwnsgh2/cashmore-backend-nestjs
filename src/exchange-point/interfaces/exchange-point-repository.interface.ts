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

export interface InsertExchangePointData {
  user_id: string;
  type: string;
  point_amount: number;
  status: string;
}

export interface InsertRestoreActionData {
  user_id: string;
  amount: number; // 양수 (복원 금액)
  original_point_action_id: number;
  reason?: string;
}

export interface IExchangePointRepository {
  getTotalPoints(userId: string): Promise<number>;
  insertExchangeRequest(data: InsertExchangePointData): Promise<{ id: number }>;
  insertRestoreAction(data: InsertRestoreActionData): Promise<{ id: number }>;
  findById(id: number, userId: string): Promise<ExchangePoint | null>;
  findByIds(ids: number[]): Promise<ExchangePoint[]>;
  /**
   * 한 출금 거래(deduct 행)에 연관된 모든 point_actions 조회
   * - deduct 행 (id = originalPointActionId)
   * - restore 행들 (additional_data.original_point_action_id = originalPointActionId)
   */
  findRelatedToExchange(
    originalPointActionId: number,
  ): Promise<ExchangePoint[]>;
  cancelExchangeRequest(id: number, userId: string): Promise<void>;
  approveExchangeRequests(ids: number[]): Promise<void>;
  rejectExchangeRequest(id: number, reason: string): Promise<void>;
}

export const EXCHANGE_POINT_REPOSITORY = Symbol('EXCHANGE_POINT_REPOSITORY');
