import type {
  IAccountInfoRepository,
  AccountInfo,
} from '../interfaces/account-info-repository.interface';

export class StubAccountInfoRepository implements IAccountInfoRepository {
  private accounts: AccountInfo[] = [];
  private nextId = 1;

  setAccounts(accounts: AccountInfo[]): void {
    this.accounts = [...accounts];
  }

  getInsertedAccounts(): AccountInfo[] {
    return [...this.accounts];
  }

  clear(): void {
    this.accounts = [];
    this.nextId = 1;
  }

  async findLatestByUserId(userId: string): Promise<AccountInfo | null> {
    const userAccounts = this.accounts
      .filter((a) => a.userId === userId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

    return userAccounts[0] ?? null;
  }

  async create(data: {
    userId: string;
    accountBank: string;
    accountNumber: string;
    accountUserName: string;
    displayNumber: string;
  }): Promise<void> {
    this.accounts.push({
      id: this.nextId++,
      userId: data.userId,
      accountBank: data.accountBank,
      accountNumber: data.accountNumber,
      accountUserName: data.accountUserName,
      displayNumber: data.displayNumber,
      createdAt: new Date().toISOString(),
    });
  }
}
