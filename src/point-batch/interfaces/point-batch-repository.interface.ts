export interface MonthlyEarnedPointRow {
  user_id: string;
  year_month: string;
  earned_points: number;
}

export interface MonthlyEarnedPoint {
  userId: string;
  earnedPoints: number;
}

export interface ExpirationTarget {
  userId: string;
  expiringPoints: number;
}

export interface WithdrawRule {
  type: string;
  statuses: readonly string[];
}

export interface IPointBatchRepository {
  /**
   * 특정 월의 유저별 적립 포인트를 집계하여 조회 (SELECT only)
   */
  calculateMonthlyEarnedPoints(
    yearMonth: string,
    earnTypes: readonly string[],
  ): Promise<MonthlyEarnedPoint[]>;

  /**
   * 집계 결과를 monthly_earned_points에 upsert
   */
  upsertMonthlyEarnedPoints(
    yearMonth: string,
    targets: MonthlyEarnedPoint[],
  ): Promise<number>;

  /**
   * 소멸 대상 유저 목록 조회
   * 6개월 전까지의 적립 총합 - 전체 출금 총합 > 0 인 유저
   */
  findExpirationTargets(
    expirationMonth: string,
    withdrawRules: readonly WithdrawRule[],
  ): Promise<ExpirationTarget[]>;

  /**
   * 포인트 소멸 레코드를 point_actions에 일괄 삽입
   */
  insertExpirationActions(
    targets: ExpirationTarget[],
    baseDate: string,
    expirationMonth: string,
  ): Promise<number>;

  /**
   * 특정 소멸 기준월의 POINT_EXPIRATION 레코드를 삭제 (롤백)
   */
  deleteExpirationActions(expirationMonth: string): Promise<number>;
}

export const POINT_BATCH_REPOSITORY = Symbol('POINT_BATCH_REPOSITORY');
