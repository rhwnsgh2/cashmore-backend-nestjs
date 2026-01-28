import type { ScoreData } from '../interfaces/every-receipt-repository.interface';

export type ReceiptType = 'offline' | 'online' | 'delivery' | 'unknown';
export type StoreInfo = 'name_only' | 'address_only' | 'both' | 'none';
export type PaymentInfo = 'amount_only' | 'method_only' | 'both' | 'none';
export type QualityLevel = 1 | 2 | 3 | 4 | 5;
export type Grade = 'S' | 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D' | 'E' | 'F';

export function extractReceiptType(score: number): ReceiptType {
  if (score === 25) return 'offline';
  if (score === 8) return 'delivery';
  if (score === 5) return 'online';
  return 'unknown';
}

export function getStoreInfo(
  hasStoreName: boolean,
  hasStoreAddress: boolean,
): StoreInfo {
  if (hasStoreName && hasStoreAddress) return 'both';
  if (hasStoreName) return 'name_only';
  if (hasStoreAddress) return 'address_only';
  return 'none';
}

export function getPaymentInfo(
  hasTotalAmount: boolean,
  hasPaymentMethod: boolean,
): PaymentInfo {
  if (hasTotalAmount && hasPaymentMethod) return 'both';
  if (hasTotalAmount) return 'amount_only';
  if (hasPaymentMethod) return 'method_only';
  return 'none';
}

export function dateValidityToLevel(score: number): QualityLevel {
  if (score === 15) return 5;
  if (score === 8) return 4;
  if (score === 5) return 3;
  if (score === 3) return 2;
  return 1;
}

export function imageQualityToLevel(): QualityLevel {
  return 5;
}

export function storeRevisitToLevel(score: number): QualityLevel {
  if (score === 0) return 1;
  if (score === -10) return 2;
  if (score === -20) return 3;
  if (score === -30) return 4;
  return 5;
}

export function getGradeFromPoint(point: number): Grade {
  if (point >= 40) return 'S';
  if (point >= 30) return 'A+';
  if (point >= 25) return 'A';
  if (point >= 20) return 'B+';
  if (point >= 15) return 'B';
  if (point >= 10) return 'C';
  if (point >= 5) return 'D';
  if (point >= 3) return 'E';
  return 'F';
}

export function buildScoreResponse(scoreData: ScoreData, point: number) {
  const hasStoreName = scoreData.store_name.score > 0;
  const hasStoreAddress = scoreData.store_details.score > 0;
  const hasTotalAmount = scoreData.payment_amount.score > 0;
  const hasPaymentMethod = scoreData.payment_method.score > 0;

  return {
    receiptType: extractReceiptType(scoreData.receipt_type.score),
    storeInfo: getStoreInfo(hasStoreName, hasStoreAddress),
    paymentInfo: getPaymentInfo(hasTotalAmount, hasPaymentMethod),
    hasItems: scoreData.items.score > 5,
    dateValidity: dateValidityToLevel(scoreData.date_validity.score),
    imageQuality: imageQualityToLevel(),
    storeRevisit: storeRevisitToLevel(
      scoreData.same_store_count_with_in_7_days.score,
    ),
    isDuplicateReceipt: scoreData.is_duplicate_receipt,
    totalScore: scoreData.total_score,
    grade: getGradeFromPoint(point),
  };
}
