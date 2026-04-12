export type CashExchangeStatus = 'pending' | 'done' | 'cancelled' | 'rejected';

export interface CashExchange {
  id: number;
  user_id: string;
  amount: number;
  status: CashExchangeStatus;
  reason: string | null;
  point_action_id: number | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InsertCashExchangeData {
  user_id: string;
  amount: number;
  point_action_id: number;
}

export interface ICashExchangeRepository {
  insert(data: InsertCashExchangeData): Promise<{ id: number }>;
  updateStatus(
    pointActionId: number,
    status: CashExchangeStatus,
    extra?: {
      reason?: string;
      cancelled_at?: string;
      confirmed_at?: string;
      rejected_at?: string;
    },
  ): Promise<void>;
  updateStatusBulk(
    pointActionIds: number[],
    status: CashExchangeStatus,
    extra?: {
      confirmed_at?: string;
    },
  ): Promise<void>;
  findByStatus(status: CashExchangeStatus): Promise<CashExchange[]>;
  findByUserId(userId: string): Promise<CashExchange[]>;
  findByUserIds(userIds: string[], limit: number): Promise<CashExchange[]>;
  findByPointActionId(pointActionId: number): Promise<CashExchange | null>;
  findByPointActionIds(pointActionIds: number[]): Promise<CashExchange[]>;
  findById(id: number): Promise<CashExchange | null>;
}

export const CASH_EXCHANGE_REPOSITORY = Symbol('CASH_EXCHANGE_REPOSITORY');
