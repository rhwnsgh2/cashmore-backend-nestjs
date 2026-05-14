export interface CoupangVisitRecord {
  id: number;
  userId: string;
  createdAtDate: string;
  pointAmount: number;
  createdAt: string;
}

export interface ICoupangVisitRepository {
  findByUserIdAndDate(
    userId: string,
    date: string,
  ): Promise<CoupangVisitRecord | null>;

  findLatestByUserId(userId: string): Promise<CoupangVisitRecord | null>;

  insertVisit(
    userId: string,
    date: string,
    pointAmount: number,
  ): Promise<CoupangVisitRecord>;
}

export const COUPANG_VISIT_REPOSITORY = Symbol('COUPANG_VISIT_REPOSITORY');
