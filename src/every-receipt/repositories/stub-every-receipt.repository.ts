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

  clear(): void {
    this.receipts.clear();
    this.details.clear();
    this.reReviewStatuses.clear();
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

  findReReviewStatus(receiptId: number): Promise<ReReviewStatus | null> {
    return Promise.resolve(this.reReviewStatuses.get(receiptId) ?? null);
  }
}
