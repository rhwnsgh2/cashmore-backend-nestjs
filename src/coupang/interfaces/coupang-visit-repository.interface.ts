export interface CoupangVisitRecord {
  id: number;
  userId: string;
  pointAmount: number;
  createdAt: string;
}

export interface CoupangVisitDomainRecord {
  id: number;
  userId: string;
  createdAtDate: string;
  pointAmount: number;
  createdAt: string;
}

export interface ICoupangVisitRepository {
  /**
   * @deprecated point_actions 조회. 마이그레이션 완료 후 제거 예정.
   * 새로운 코드는 findByUserIdAndDate 사용.
   */
  findTodayVisit(userId: string): Promise<CoupangVisitRecord | null>;

  findByUserIdAndDate(
    userId: string,
    date: string,
  ): Promise<CoupangVisitDomainRecord | null>;

  insertVisit(
    userId: string,
    date: string,
    pointAmount: number,
  ): Promise<CoupangVisitDomainRecord>;
}

export const COUPANG_VISIT_REPOSITORY = Symbol('COUPANG_VISIT_REPOSITORY');
