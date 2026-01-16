// 타입 정의
export interface PointAction {
  id: number;
  type: string;
  created_at: string;
  point_amount: number;
  status: string;
}

export interface PointSnapshot {
  point_balance: number;
  updated_at: string;
}

export interface MonthlyEarnedPoint {
  earned_points: number;
}

export interface WithdrawalAction {
  point_amount: number;
  status: string;
  type: string;
}

// Repository 인터페이스
export interface IPointRepository {
  findLatestSnapshot(userId: string): Promise<PointSnapshot | null>;
  findPointActionsSince(userId: string, since: string): Promise<PointAction[]>;
  findAllPointActions(userId: string): Promise<PointAction[]>;
  findMonthlyEarnedPointsUntil(
    userId: string,
    yearMonth: string,
  ): Promise<MonthlyEarnedPoint[]>;
  findWithdrawalActions(userId: string): Promise<WithdrawalAction[]>;
}

// DI 토큰
export const POINT_REPOSITORY = Symbol('POINT_REPOSITORY');
