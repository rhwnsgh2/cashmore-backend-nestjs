export type EveryReceiptStatus = 'pending' | 'completed' | 'rejected';

export interface EveryReceipt {
  id: string;
  createdAt: string;
  pointAmount: number | null;
  status: EveryReceiptStatus;
  imageUrl: string | null;
}

export interface IEveryReceiptRepository {
  findByUserId(userId: string, limit?: number): Promise<EveryReceipt[]>;
}

export const EVERY_RECEIPT_REPOSITORY = Symbol('EVERY_RECEIPT_REPOSITORY');
