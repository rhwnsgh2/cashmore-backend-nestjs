import type {
  InsertEveryReceiptParams,
  InsertedEveryReceipt,
  PendingEveryReceipt,
  ReReviewRecord,
  CreatedReReview,
  AdminEveryReceiptRow,
  AdminReReviewRow,
} from '../interfaces/every-receipt-repository.interface';
import {
  IEveryReceiptRepository,
  EveryReceipt,
  EveryReceiptDetail,
  ReReviewStatus,
} from '../interfaces/every-receipt-repository.interface';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = 'Asia/Seoul';

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
  private firstReceiptMap = new Map<string, number>();
  private reReviewRecords = new Map<string, ReReviewRecord[]>();

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

  setReReviewRecords(userId: string, records: ReReviewRecord[]): void {
    this.reReviewRecords.set(userId, records);
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
    this.firstReceiptMap.clear();
    this.reReviewRecords.clear();
    this.reReviewReceiptData.clear();
    this.existingReReviews.clear();
    this.createdReReviews = [];
    this.reReviewStatusUpdates = [];
    this.adminReceiptData.clear();
    this.adminReReviewData.clear();
    this.deletedReceiptIds = [];
    this.receiptPointUpdates = [];
    this.reReviewRejected = [];
    this.reReviewCompleted = [];
    this.receiptAfterReReviewUpdates = [];
    this.receiptStatusCompletedUpdates = [];
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

  countCompletedByUserId(userId: string): Promise<number> {
    const userReceipts = this.receipts.get(userId) || [];
    const count = userReceipts.filter((r) => r.status === 'completed').length;
    return Promise.resolve(count);
  }

  countByUserIdAndMonth(
    userId: string,
    year: number,
    month: number,
  ): Promise<number> {
    const userReceipts = this.receipts.get(userId) || [];
    const count = userReceipts.filter((r) => {
      if (r.status !== 'completed') return false;
      const kst = dayjs(r.createdAt).tz(TIMEZONE);
      return kst.year() === year && kst.month() + 1 === month;
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

  isFirstReceipt(userId: string, receiptId: number): Promise<boolean> {
    return Promise.resolve(this.firstReceiptMap.get(userId) === receiptId);
  }

  findReReviewsSince(userId: string, since: string): Promise<ReReviewRecord[]> {
    const records = this.reReviewRecords.get(userId) || [];
    const filtered = records.filter((r) => r.created_at >= since);
    return Promise.resolve(filtered);
  }

  private reReviewReceiptData = new Map<
    string,
    {
      id: number;
      point: number;
      score_data: Record<string, unknown> | null;
    }
  >();
  private existingReReviews = new Set<number>();
  private createdReReviews: CreatedReReview[] = [];
  private reReviewStatusUpdates: number[] = [];

  setEveryReceiptForReReview(
    receiptId: number,
    userId: string,
    data: {
      id: number;
      point: number;
      score_data: Record<string, unknown> | null;
    },
  ): void {
    this.reReviewReceiptData.set(`${userId}:${receiptId}`, data);
  }

  setExistingReReview(receiptId: number): void {
    this.existingReReviews.add(receiptId);
  }

  getCreatedReReviews(): CreatedReReview[] {
    return this.createdReReviews;
  }

  getReReviewStatusUpdates(): number[] {
    return this.reReviewStatusUpdates;
  }

  findEveryReceiptForReReview(
    receiptId: number,
    userId: string,
  ): Promise<{
    id: number;
    point: number;
    score_data: Record<string, unknown> | null;
  } | null> {
    return Promise.resolve(
      this.reReviewReceiptData.get(`${userId}:${receiptId}`) ?? null,
    );
  }

  hasExistingReReview(receiptId: number): Promise<boolean> {
    return Promise.resolve(this.existingReReviews.has(receiptId));
  }

  createReReview(params: {
    everyReceiptId: number;
    requestedItems: string[];
    userNote: string;
    userId: string;
    beforeScoreData: Record<string, unknown> | null;
  }): Promise<CreatedReReview> {
    const reReview: CreatedReReview = {
      id: this.createdReReviews.length + 1,
      ...params,
    };
    this.createdReReviews.push(reReview);
    return Promise.resolve(reReview);
  }

  updateStatusToReReview(receiptId: number): Promise<void> {
    this.reReviewStatusUpdates.push(receiptId);
    return Promise.resolve();
  }

  // Admin ---------------------------------------------------------------------

  private adminReceiptData = new Map<number, AdminEveryReceiptRow>();
  private adminReReviewData = new Map<number, AdminReReviewRow>();
  private deletedReceiptIds: number[] = [];
  private receiptPointUpdates: { receiptId: number; newPoint: number }[] = [];
  private reReviewRejected: number[] = [];
  private reReviewCompleted: {
    reReviewId: number;
    afterScoreData: Record<string, unknown>;
  }[] = [];
  private receiptAfterReReviewUpdates: {
    receiptId: number;
    afterScoreData: Record<string, unknown>;
    afterPoint: number;
  }[] = [];
  private receiptStatusCompletedUpdates: number[] = [];

  setAdminReceipt(row: AdminEveryReceiptRow): void {
    this.adminReceiptData.set(row.id, row);
  }

  setAdminReReview(row: AdminReReviewRow): void {
    this.adminReReviewData.set(row.every_receipt_id, row);
  }

  getDeletedReceiptIds(): number[] {
    return this.deletedReceiptIds;
  }

  getReceiptPointUpdates(): { receiptId: number; newPoint: number }[] {
    return this.receiptPointUpdates;
  }

  getReReviewRejected(): number[] {
    return this.reReviewRejected;
  }

  getReReviewCompleted(): {
    reReviewId: number;
    afterScoreData: Record<string, unknown>;
  }[] {
    return this.reReviewCompleted;
  }

  getReceiptAfterReReviewUpdates(): {
    receiptId: number;
    afterScoreData: Record<string, unknown>;
    afterPoint: number;
  }[] {
    return this.receiptAfterReReviewUpdates;
  }

  getReceiptStatusCompletedUpdates(): number[] {
    return this.receiptStatusCompletedUpdates;
  }

  findReceiptForAdmin(receiptId: number): Promise<AdminEveryReceiptRow | null> {
    return Promise.resolve(this.adminReceiptData.get(receiptId) ?? null);
  }

  deleteReceipt(receiptId: number): Promise<void> {
    this.deletedReceiptIds.push(receiptId);
    this.adminReceiptData.delete(receiptId);
    return Promise.resolve();
  }

  updateReceiptPoint(receiptId: number, newPoint: number): Promise<void> {
    this.receiptPointUpdates.push({ receiptId, newPoint });
    const existing = this.adminReceiptData.get(receiptId);
    if (existing) {
      this.adminReceiptData.set(receiptId, { ...existing, point: newPoint });
    }
    return Promise.resolve();
  }

  findReReviewByReceiptId(
    everyReceiptId: number,
  ): Promise<AdminReReviewRow | null> {
    return Promise.resolve(this.adminReReviewData.get(everyReceiptId) ?? null);
  }

  updateReReviewToRejected(reReviewId: number): Promise<void> {
    this.reReviewRejected.push(reReviewId);
    return Promise.resolve();
  }

  updateReReviewToCompleted(
    reReviewId: number,
    afterScoreData: Record<string, unknown>,
  ): Promise<void> {
    this.reReviewCompleted.push({ reReviewId, afterScoreData });
    return Promise.resolve();
  }

  updateReceiptAfterReReview(
    receiptId: number,
    afterScoreData: Record<string, unknown>,
    afterPoint: number,
  ): Promise<void> {
    this.receiptAfterReReviewUpdates.push({
      receiptId,
      afterScoreData,
      afterPoint,
    });
    return Promise.resolve();
  }

  updateReceiptStatusToCompleted(receiptId: number): Promise<void> {
    this.receiptStatusCompletedUpdates.push(receiptId);
    return Promise.resolve();
  }
}
