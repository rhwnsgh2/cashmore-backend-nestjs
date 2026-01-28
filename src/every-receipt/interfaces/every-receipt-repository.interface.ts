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

export interface IEveryReceiptRepository {
  findByUserId(userId: string, limit?: number): Promise<EveryReceipt[]>;
  findById(
    receiptId: number,
    userId: string,
  ): Promise<EveryReceiptDetail | null>;
  findReReviewStatus(receiptId: number): Promise<ReReviewStatus | null>;
}

export const EVERY_RECEIPT_REPOSITORY = Symbol('EVERY_RECEIPT_REPOSITORY');
