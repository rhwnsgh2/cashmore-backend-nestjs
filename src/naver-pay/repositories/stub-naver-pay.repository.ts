import type {
  INaverPayRepository,
  NaverPayAccount,
  NaverPayDailyStat,
  NaverPayExchange,
  NaverPayExchangeStatus,
  CreateNaverPayAccountData,
  CreateNaverPayExchangeData,
} from '../interfaces/naver-pay-repository.interface';
import { aggregateDailyStats } from '../utils/aggregate-daily-stats';

export class StubNaverPayRepository implements INaverPayRepository {
  private accounts: NaverPayAccount[] = [];
  private exchanges: NaverPayExchange[] = [];
  private nextAccountId = 1;
  private nextExchangeId = 1;

  // --- 테스트 헬퍼 ---

  setAccounts(accounts: NaverPayAccount[]): void {
    this.accounts = accounts;
  }

  getInsertedAccounts(): NaverPayAccount[] {
    return this.accounts;
  }

  setExchanges(exchanges: NaverPayExchange[]): void {
    this.exchanges = exchanges;
  }

  getInsertedExchanges(): NaverPayExchange[] {
    return this.exchanges;
  }

  clear(): void {
    this.accounts = [];
    this.exchanges = [];
    this.nextAccountId = 1;
    this.nextExchangeId = 1;
  }

  // --- 계정 ---

  async findConnectedAccount(userId: string): Promise<NaverPayAccount | null> {
    return (
      this.accounts.find(
        (a) => a.user_id === userId && a.status === 'connected',
      ) ?? null
    );
  }

  async countTodayFailedAttempts(userId: string): Promise<number> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    return this.accounts.filter(
      (a) =>
        a.user_id === userId &&
        a.status === 'failed' &&
        new Date(a.created_at) >= todayStart,
    ).length;
  }

  async createAccount(
    data: CreateNaverPayAccountData,
  ): Promise<NaverPayAccount> {
    const account: NaverPayAccount = {
      id: `account-${this.nextAccountId++}`,
      ...data,
      disconnected_at: null,
      created_at: new Date().toISOString(),
    };
    this.accounts.push(account);
    return account;
  }

  async disconnectAccount(accountId: string): Promise<void> {
    const account = this.accounts.find((a) => a.id === accountId);
    if (account) {
      account.status = 'disconnected';
      account.disconnected_at = new Date().toISOString();
      account.naver_unique_id = null as any;
      account.dau_user_key = null;
      account.dau_masking_id = null;
    }
  }

  // --- 전환 ---

  async createExchange(
    data: CreateNaverPayExchangeData,
  ): Promise<NaverPayExchange> {
    const exchange: NaverPayExchange = {
      id: `exchange-${this.nextExchangeId++}`,
      ...data,
      status: 'pending',
      point_action_id: null,
      partner_tx_no: null,
      tx_no: null,
      error_code: null,
      created_at: new Date().toISOString(),
      processed_at: null,
    };
    this.exchanges.push(exchange);
    return exchange;
  }

  async findExchangeById(exchangeId: string): Promise<NaverPayExchange | null> {
    return this.exchanges.find((e) => e.id === exchangeId) ?? null;
  }

  async findExchangesByUserId(userId: string): Promise<NaverPayExchange[]> {
    return this.exchanges.filter((e) => e.user_id === userId);
  }

  async findExchangesByStatus(
    status?: string,
  ): Promise<(NaverPayExchange & { user_email?: string })[]> {
    if (!status) {
      return this.exchanges;
    }
    return this.exchanges.filter((e) => e.status === status);
  }

  async getCompletedDailyStats(
    sinceIso: string,
  ): Promise<NaverPayDailyStat[]> {
    const filtered = this.exchanges.filter(
      (e) =>
        e.status === 'completed' &&
        e.processed_at !== null &&
        e.processed_at >= sinceIso,
    );
    return aggregateDailyStats(
      filtered.map((e) => ({
        processed_at: e.processed_at,
        cashmore_point: e.cashmore_point,
        naverpay_point: e.naverpay_point,
      })),
    );
  }

  async findPendingExchangesByUserId(
    userId: string,
  ): Promise<NaverPayExchange[]> {
    return this.exchanges.filter(
      (e) => e.user_id === userId && e.status === 'pending',
    );
  }

  async countTodayExchanges(userId: string): Promise<number> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    return this.exchanges.filter(
      (e) =>
        e.user_id === userId &&
        new Date(e.created_at) >= todayStart &&
        (e.status === 'pending' || e.status === 'completed'),
    ).length;
  }

  async updateExchangeStatus(
    exchangeId: string,
    status: NaverPayExchangeStatus,
    processedAt?: string,
  ): Promise<void> {
    const exchange = this.exchanges.find((e) => e.id === exchangeId);
    if (exchange) {
      exchange.status = status;
      if (processedAt) {
        exchange.processed_at = processedAt;
      }
    }
  }

  async updateExchangePointActionId(
    exchangeId: string,
    pointActionId: number,
  ): Promise<void> {
    const exchange = this.exchanges.find((e) => e.id === exchangeId);
    if (exchange) {
      exchange.point_action_id = pointActionId;
    }
  }

  async deleteExchange(exchangeId: string): Promise<void> {
    this.exchanges = this.exchanges.filter((e) => e.id !== exchangeId);
  }

  async updateExchangePartnerTxNo(
    exchangeId: string,
    partnerTxNo: string,
  ): Promise<void> {
    const exchange = this.exchanges.find((e) => e.id === exchangeId);
    if (exchange) {
      exchange.partner_tx_no = partnerTxNo;
    }
  }

  async updateExchangeTxNo(exchangeId: string, txNo: string): Promise<void> {
    const exchange = this.exchanges.find((e) => e.id === exchangeId);
    if (exchange) {
      exchange.tx_no = txNo;
    }
  }

  async updateExchangeErrorCode(
    exchangeId: string,
    errorCode: string,
  ): Promise<void> {
    const exchange = this.exchanges.find((e) => e.id === exchangeId);
    if (exchange) {
      exchange.error_code = errorCode;
    }
  }
}
