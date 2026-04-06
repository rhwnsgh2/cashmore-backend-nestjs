export interface AccountInfo {
  id: number;
  userId: string;
  accountBank: string;
  accountNumber: string; // encrypted
  accountUserName: string;
  displayNumber: string;
  createdAt: string;
}

export interface IAccountInfoRepository {
  findLatestByUserId(userId: string): Promise<AccountInfo | null>;
  findLatestBulkByUserIds(userIds: string[]): Promise<AccountInfo[]>;
  create(data: {
    userId: string;
    accountBank: string;
    accountNumber: string;
    accountUserName: string;
    displayNumber: string;
  }): Promise<void>;
}

export const ACCOUNT_INFO_REPOSITORY = Symbol('ACCOUNT_INFO_REPOSITORY');
