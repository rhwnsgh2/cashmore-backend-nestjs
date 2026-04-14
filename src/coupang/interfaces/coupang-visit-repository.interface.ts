export interface CoupangVisitRecord {
  id: number;
  userId: string;
  pointAmount: number;
  createdAt: string;
}

export interface ICoupangVisitRepository {
  findTodayVisit(userId: string): Promise<CoupangVisitRecord | null>;
}

export const COUPANG_VISIT_REPOSITORY = Symbol('COUPANG_VISIT_REPOSITORY');
