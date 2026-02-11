// 포인트 적립 타입 (status가 "done"일 때만)
export const POINT_ADD_TYPES = [
  'EVERY_RECEIPT',
  'INVITE_REWARD',
  'INVITED_USER_REWARD',
  'INVITE_2_REWARD',
  'INVITE_5_REWARD',
  'COUPANG_VISIT',
  'ONBOARDING_EVENT',
  'AFFILIATE',
  'EVERY_RECEIPT_MORE_POINT_AD_SHOW',
  'ATTENDANCE_AD',
  'ATTENDANCE',
  'WEEKLY_ATTENDANCE_BONUS',
  'INVITE_STEP_REWARD',
  'INVITED_USER_REWARD_RANDOM',
  'LOTTERY',
  'STEP_REWARD_3000',
  'STEP_REWARD_5000',
] as const;

// 포인트 차감 타입 (status가 "done" 또는 "pending"일 때)
export const POINT_SUBTRACT_TYPES = [
  'EXCHANGE_POINT_TO_CASH',
  'POINT_EXPIRATION',
] as const;

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

export interface EarnedPointAction {
  point_amount: number;
  created_at: string;
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
  findEarnedPointsBetween(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<number>;
  findEarnedPointActionsInRange(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<EarnedPointAction[]>;
}

// DI 토큰
export const POINT_REPOSITORY = Symbol('POINT_REPOSITORY');
