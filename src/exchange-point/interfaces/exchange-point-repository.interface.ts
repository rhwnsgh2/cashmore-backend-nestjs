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

export interface IExchangePointRepository {
  findByUserId(userId: string): Promise<ExchangePoint[]>;
  getTotalPoints(userId: string): Promise<number>;
  insertExchangeRequest(data: InsertExchangePointData): Promise<{ id: number }>;
  findById(id: number, userId: string): Promise<ExchangePoint | null>;
  cancelExchangeRequest(id: number, userId: string): Promise<void>;
}

export const EXCHANGE_POINT_REPOSITORY = Symbol('EXCHANGE_POINT_REPOSITORY');
