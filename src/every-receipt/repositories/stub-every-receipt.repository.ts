import type {
  InsertEveryReceiptParams,
  InsertedEveryReceipt,
  PendingEveryReceipt,
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

  private pendingReceipts = new Map<number, PendingEveryReceipt>();
  private completedReceiptIds: number[] = [];
  private rejectedReceiptList: { id: number; reason: string }[] = [];
  private pointUpdateList: { id: number; point: number }[] = [];
  private pointActionList: {
    userId: string;
    receiptId: number;
    point: number;
  }[] = [];
  private firstReceiptMap = new Map<string, number>();

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

  setPendingReceipt(receipt: PendingEveryReceipt): void {
    this.pendingReceipts.set(receipt.id, receipt);
  }

  setFirstReceiptId(userId: string, receiptId: number): void {
    this.firstReceiptMap.set(userId, receiptId);
  }

  getInsertedReceipts(): InsertEveryReceiptParams[] {
    return this.insertedReceipts;
  }

  getCompletedReceiptIds(): number[] {
    return this.completedReceiptIds;
  }

  getRejectedReceipts(): { id: number; reason: string }[] {
    return this.rejectedReceiptList;
  }

  getPointUpdates(): { id: number; point: number }[] {
    return this.pointUpdateList;
  }

  getPointActions(): { userId: string; receiptId: number; point: number }[] {
    return this.pointActionList;
  }

  clear(): void {
    this.receipts.clear();
    this.details.clear();
    this.reReviewStatuses.clear();
    this.nextInsertId = 1;
    this.insertedReceipts = [];
    this.pendingReceipts.clear();
    this.completedReceiptIds = [];
    this.rejectedReceiptList = [];
    this.pointUpdateList = [];
    this.pointActionList = [];
    this.firstReceiptMap.clear();
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

  findPendingWithScoreData(
    receiptId: number,
  ): Promise<PendingEveryReceipt | null> {
    return Promise.resolve(this.pendingReceipts.get(receiptId) ?? null);
  }

  updateToCompleted(receiptId: number): Promise<void> {
    this.completedReceiptIds.push(receiptId);
    return Promise.resolve();
  }

  updateToRejected(receiptId: number, reason: string): Promise<void> {
    this.rejectedReceiptList.push({ id: receiptId, reason });
    return Promise.resolve();
  }

  updatePoint(receiptId: number, point: number): Promise<void> {
    this.pointUpdateList.push({ id: receiptId, point });
    return Promise.resolve();
  }

  createPointAction(
    userId: string,
    receiptId: number,
    point: number,
  ): Promise<void> {
    this.pointActionList.push({ userId, receiptId, point });
    return Promise.resolve();
  }

  isFirstReceipt(userId: string, receiptId: number): Promise<boolean> {
    return Promise.resolve(this.firstReceiptMap.get(userId) === receiptId);
  }
}
