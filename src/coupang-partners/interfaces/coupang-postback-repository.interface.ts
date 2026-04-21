export interface CoupangPostbackRecord {
  id: number;
  afcode: string;
  subid: string;
  os: string;
  adid: string;
  clickId: string;
  orderTime: string;
  orderPrice: number;
  purchaseCancel: string;
  rawBody: Record<string, unknown> | null;
  createdAt: string;
}

export interface ICoupangPostbackRepository {
  save(data: Omit<CoupangPostbackRecord, 'id' | 'createdAt'>): Promise<void>;
}

export const COUPANG_POSTBACK_REPOSITORY = Symbol(
  'COUPANG_POSTBACK_REPOSITORY',
);
