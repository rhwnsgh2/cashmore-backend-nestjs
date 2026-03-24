export type NaverPayAccountStatus = 'connected' | 'disconnected' | 'failed';

export interface NaverPayAccount {
  id: string;
  user_id: string;
  naver_unique_id: string;
  dau_user_key: string | null;
  dau_masking_id: string | null;
  status: NaverPayAccountStatus;
  error_code: string | null;
  connected_at: string | null;
  disconnected_at: string | null;
  created_at: string;
}

export interface CreateNaverPayAccountData {
  user_id: string;
  naver_unique_id: string;
  dau_user_key: string | null;
  dau_masking_id: string | null;
  status: NaverPayAccountStatus;
  error_code: string | null;
  connected_at: string | null;
}

export type NaverPayExchangeStatus =
  | 'pending'
  | 'approved'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'rejected';

export interface NaverPayExchange {
  id: string;
  user_id: string;
  naver_pay_account_id: string;
  cashmore_point: number;
  naverpay_point: number;
  exchange_rate: number;
  status: NaverPayExchangeStatus;
  point_action_id: number | null;
  partner_tx_no: string | null;
  tx_no: string | null;
  error_code: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface CreateNaverPayExchangeData {
  user_id: string;
  naver_pay_account_id: string;
  cashmore_point: number;
  naverpay_point: number;
  exchange_rate: number;
}

export interface INaverPayRepository {
  // 계정
  findConnectedAccount(userId: string): Promise<NaverPayAccount | null>;
  countTodayFailedAttempts(userId: string): Promise<number>;
  createAccount(data: CreateNaverPayAccountData): Promise<NaverPayAccount>;
  disconnectAccount(accountId: string): Promise<void>;

  // 전환
  createExchange(data: CreateNaverPayExchangeData): Promise<NaverPayExchange>;
  findExchangeById(exchangeId: string): Promise<NaverPayExchange | null>;
  findExchangesByUserId(userId: string): Promise<NaverPayExchange[]>;
  findExchangesByStatus(
    status?: string,
  ): Promise<(NaverPayExchange & { user_email?: string })[]>;
  findPendingExchangesByUserId(userId: string): Promise<NaverPayExchange[]>;
  countTodayExchanges(userId: string): Promise<number>;
  updateExchangeStatus(
    exchangeId: string,
    status: NaverPayExchangeStatus,
    processedAt?: string,
  ): Promise<void>;
  updateExchangePointActionId(
    exchangeId: string,
    pointActionId: number,
  ): Promise<void>;
  deleteExchange(exchangeId: string): Promise<void>;
  updateExchangePartnerTxNo(
    exchangeId: string,
    partnerTxNo: string,
  ): Promise<void>;
  updateExchangeTxNo(exchangeId: string, txNo: string): Promise<void>;
  updateExchangeErrorCode(
    exchangeId: string,
    errorCode: string,
  ): Promise<void>;
}

export const NAVER_PAY_REPOSITORY = Symbol('NAVER_PAY_REPOSITORY');
