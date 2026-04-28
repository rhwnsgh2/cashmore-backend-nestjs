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
  'DIVIDEND',
  'BUZZVIL_REWARD',
  'INVITATION_RECEIPT',
] as const;

// 타입 정의
export interface PointAction {
  id: number;
  type: string;
  created_at: string;
  point_amount: number;
  status: string;
}

export interface PointBalance {
  totalPoint: number;
}

export interface EarnedPointAction {
  point_amount: number;
  created_at: string;
}

// Repository 인터페이스
export interface IPointRepository {
  findAllPointActions(userId: string): Promise<PointAction[]>;
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
  findBalance(userId: string): Promise<PointBalance | null>;
  findSumUpToId(userId: string, maxId: number): Promise<number>;
  findTotalPointSumViaRpc(userId: string, maxId: number): Promise<number>;
  findTotalPointSum(userId: string): Promise<number>;
}

// DI 토큰
export const POINT_REPOSITORY = Symbol('POINT_REPOSITORY');
