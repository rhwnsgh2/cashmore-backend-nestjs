export type EveryReceiptStatus = 'pending' | 'completed' | 'rejected';

export type ReReviewStatus = 'pending' | 'completed' | 'rejected';

export interface ScoreData {
  items: { score: number; reason: string };
  store_name: { score: number; reason: string };
  total_score: number;
  receipt_type: { score: number; reason: string; type?: string };
  date_validity: { score: number; reason: string };
  image_quality: { score: number; reason: string; image_quality: number };
  store_details: { score: number; reason: string };
  payment_amount: { score: number; reason: string };
  payment_method: { score: number; reason: string };
  is_duplicate_receipt: boolean;
  same_store_count_with_in_7_days: { score: number; reason: string };
}

export interface EveryReceipt {
  id: string;
  createdAt: string;
  pointAmount: number | null;
  status: EveryReceiptStatus;
  imageUrl: string | null;
}

export interface EveryReceiptDetail {
  id: number;
  createdAt: string;
  pointAmount: number | null;
  status: EveryReceiptStatus;
  imageUrl: string | null;
  scoreData: ScoreData | null;
}

export interface InsertEveryReceiptParams {
  userId: string;
  imageUrl: string;
  position: string | null;
}

export interface InsertedEveryReceipt {
  id: number;
}

export interface PendingEveryReceipt {
  id: number;
  userId: string;
  point: number;
  scoreData: ScoreData;
}

export interface ReReviewRecord {
  id: number;
  status: string;
  created_at: string;
}

export interface CreatedReReview {
  id: number;
  [key: string]: unknown;
}

export type PointReversalReason =
  | 'user_review'
  | 're_review_rejected'
  | 're_review_approved'
  | 'admin_adjust'
  | 'admin_delete';

export interface InsertPointReversalParams {
  userId: string;
  pointAmount: number;
  everyReceiptId: number;
  everyReceiptReReviewId?: number;
  reason: PointReversalReason;
  beforePoint?: number;
  afterPoint?: number;
}

export interface AdminEveryReceiptRow {
  id: number;
  user_id: string;
  status: EveryReceiptStatus | 're-review';
  point: number;
}

export interface AdminReReviewRow {
  id: number;
  every_receipt_id: number;
  status: string;
}

export interface IEveryReceiptRepository {
  findByUserId(userId: string, limit?: number): Promise<EveryReceipt[]>;
  findById(
    receiptId: number,
    userId: string,
  ): Promise<EveryReceiptDetail | null>;
  findReReviewStatus(receiptId: number): Promise<ReReviewStatus | null>;
  countCompletedByUserId(userId: string): Promise<number>;
  countByUserIdAndMonth(
    userId: string,
    year: number,
    month: number,
  ): Promise<number>;
  insert(params: InsertEveryReceiptParams): Promise<InsertedEveryReceipt>;
  findPendingWithScoreData(
    receiptId: number,
  ): Promise<PendingEveryReceipt | null>;
  updateToCompleted(receiptId: number): Promise<void>;
  updateToRejected(receiptId: number, reason: string): Promise<void>;
  updatePoint(receiptId: number, point: number): Promise<void>;
  createPointAction(
    userId: string,
    receiptId: number,
    point: number,
  ): Promise<void>;
  isFirstReceipt(userId: string, receiptId: number): Promise<boolean>;
  findReReviewsSince(userId: string, since: string): Promise<ReReviewRecord[]>;

  findEveryReceiptForReReview(
    receiptId: number,
    userId: string,
  ): Promise<{
    id: number;
    point: number;
    score_data: Record<string, unknown> | null;
  } | null>;

  hasExistingReReview(receiptId: number): Promise<boolean>;

  insertPointReversal(params: InsertPointReversalParams): Promise<void>;

  createReReview(params: {
    everyReceiptId: number;
    requestedItems: string[];
    userNote: string;
    userId: string;
    beforeScoreData: Record<string, unknown> | null;
  }): Promise<CreatedReReview>;

  updateStatusToReReview(receiptId: number): Promise<void>;

  // Admin 전용 ----------------------------------------------------------------

  findReceiptForAdmin(receiptId: number): Promise<AdminEveryReceiptRow | null>;

  deleteReceipt(receiptId: number): Promise<void>;

  updateReceiptPoint(receiptId: number, newPoint: number): Promise<void>;

  findReReviewByReceiptId(
    everyReceiptId: number,
  ): Promise<AdminReReviewRow | null>;

  updateReReviewToRejected(reReviewId: number): Promise<void>;

  updateReReviewToCompleted(
    reReviewId: number,
    afterScoreData: Record<string, unknown>,
  ): Promise<void>;

  updateReceiptAfterReReview(
    receiptId: number,
    afterScoreData: Record<string, unknown>,
    afterPoint: number,
  ): Promise<void>;

  updateReceiptStatusToCompleted(receiptId: number): Promise<void>;
}

export const EVERY_RECEIPT_REPOSITORY = Symbol('EVERY_RECEIPT_REPOSITORY');
