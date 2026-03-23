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

export interface INaverPayRepository {
  findConnectedAccount(userId: string): Promise<NaverPayAccount | null>;
  countTodayFailedAttempts(userId: string): Promise<number>;
  createAccount(data: CreateNaverPayAccountData): Promise<NaverPayAccount>;
  disconnectAccount(accountId: string): Promise<void>;
}

export const NAVER_PAY_REPOSITORY = Symbol('NAVER_PAY_REPOSITORY');
