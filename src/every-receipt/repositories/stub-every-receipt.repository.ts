import {
  IEveryReceiptRepository,
  EveryReceipt,
} from '../interfaces/every-receipt-repository.interface';

export class StubEveryReceiptRepository implements IEveryReceiptRepository {
  private receipts = new Map<string, EveryReceipt[]>();

  setReceipts(userId: string, receipts: EveryReceipt[]): void {
    this.receipts.set(userId, receipts);
  }

  clear(): void {
    this.receipts.clear();
  }

  findByUserId(userId: string, limit?: number): Promise<EveryReceipt[]> {
    const userReceipts = this.receipts.get(userId) || [];
    const sortedReceipts = [...userReceipts].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    if (limit) {
      return Promise.resolve(sortedReceipts.slice(0, limit));
    }

    return Promise.resolve(sortedReceipts);
  }
}
