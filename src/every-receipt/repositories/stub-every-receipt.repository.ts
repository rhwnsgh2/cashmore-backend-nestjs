import type {
  InsertEveryReceiptParams,
  InsertedEveryReceipt,
} from '../interfaces/every-receipt-repository.interface';
import {
  IEveryReceiptRepository,
  EveryReceipt,
  EveryReceiptDetail,
  ReReviewStatus,
} from '../interfaces/every-receipt-repository.interface';

export class StubEveryReceiptRepository implements IEveryReceiptRepository {
  private receipts = new Map<string, EveryReceipt[]>();
  private details = new Map<string, EveryReceiptDetail>();
  private reReviewStatuses = new Map<number, ReReviewStatus | null>();
  private nextInsertId = 1;
  private insertedReceipts: InsertEveryReceiptParams[] = [];

  setReceipts(userId: string, receipts: EveryReceipt[]): void {
    this.receipts.set(userId, receipts);
  }

  setDetail(
    receiptId: number,
    userId: string,
    detail: EveryReceiptDetail,
  ): void {
    this.details.set(`${userId}:${receiptId}`, detail);
  }

  setReReviewStatus(receiptId: number, status: ReReviewStatus | null): void {
    this.reReviewStatuses.set(receiptId, status);
  }

  getInsertedReceipts(): InsertEveryReceiptParams[] {
    return this.insertedReceipts;
  }

  clear(): void {
    this.receipts.clear();
    this.details.clear();
    this.reReviewStatuses.clear();
    this.nextInsertId = 1;
    this.insertedReceipts = [];
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

  findById(
    receiptId: number,
    userId: string,
  ): Promise<EveryReceiptDetail | null> {
    return Promise.resolve(this.details.get(`${userId}:${receiptId}`) ?? null);
  }

  countByUserIdAndMonth(
    userId: string,
    year: number,
    month: number,
  ): Promise<number> {
    const userReceipts = this.receipts.get(userId) || [];
    const count = userReceipts.filter((r) => {
      const date = new Date(r.createdAt);
      return (
        date.getFullYear() === year &&
        date.getMonth() + 1 === month &&
        r.status === 'completed'
      );
    }).length;
    return Promise.resolve(count);
  }

  findReReviewStatus(receiptId: number): Promise<ReReviewStatus | null> {
    return Promise.resolve(this.reReviewStatuses.get(receiptId) ?? null);
  }

  insert(params: InsertEveryReceiptParams): Promise<InsertedEveryReceipt> {
    this.insertedReceipts.push(params);
    const id = this.nextInsertId++;
    return Promise.resolve({ id });
  }
}
