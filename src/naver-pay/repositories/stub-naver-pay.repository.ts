import type {
  INaverPayRepository,
  NaverPayAccount,
  CreateNaverPayAccountData,
} from '../interfaces/naver-pay-repository.interface';

export class StubNaverPayRepository implements INaverPayRepository {
  private accounts: NaverPayAccount[] = [];
  private nextId = 1;

  setAccounts(accounts: NaverPayAccount[]): void {
    this.accounts = accounts;
  }

  getInsertedAccounts(): NaverPayAccount[] {
    return this.accounts;
  }

  clear(): void {
    this.accounts = [];
    this.nextId = 1;
  }

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
      id: `account-${this.nextId++}`,
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
    }
  }
}
