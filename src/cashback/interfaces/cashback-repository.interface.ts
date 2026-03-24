// 캐시백 아이템 타입
export type CashbackItemType =
  | 'claim'
  | 'dropCardCashback'
  | 'dropBrandCardCashback'
  | 'everyReceipt'
  | 'exchangePointToCash'
  | 'invitationReward'
  | 'invitedUserMissionReward_2'
  | 'invitedUserMissionReward_5'
  | 'inviteStepReward'
  | 'invitationRewardRandom'
  | 'coupangVisit'
  | 'lottery'
  | 'onboardingEvent'
  | 'affiliateCashback'
  | 'attendance'
  | 'attendanceWeeklyBonus'
  | 'stepReward'
  | 'pointExpiration'
  | 'dividend'
  | 'buzzvilReward'
  | 'invitationReceipt'
  | 'exchangePointToNaverpay';

export interface CashbackItem {
  id: string;
  type: CashbackItemType;
  createdAt: string;
  amount: number;
  status?: string;
  data?: Record<string, unknown>;
}

export interface CashbackListResult {
  items: CashbackItem[];
  nextCursor: string | null;
}

// point_actions에서 조회할 타입들
export const CASHBACK_POINT_ACTION_TYPES = [
  'EXCHANGE_POINT_TO_CASH',
  'INVITE_REWARD',
  'INVITED_USER_REWARD',
  'INVITE_5_REWARD',
  'INVITE_2_REWARD',
  'INVITE_STEP_REWARD',
  'INVITED_USER_REWARD_RANDOM',
  'COUPANG_VISIT',
  'ONBOARDING_EVENT',
  'LOTTERY',
  'WEEKLY_ATTENDANCE_BONUS',
  'POINT_EXPIRATION',
  'DIVIDEND',
  'BUZZVIL_REWARD',
  'INVITATION_RECEIPT',
] as const;

// point_action type → CashbackItemType 매핑
export const POINT_ACTION_TYPE_MAP: Record<string, CashbackItemType> = {
  EXCHANGE_POINT_TO_CASH: 'exchangePointToCash',
  INVITE_REWARD: 'invitationReward',
  INVITED_USER_REWARD: 'invitationReward',
  INVITE_5_REWARD: 'invitedUserMissionReward_5',
  INVITE_2_REWARD: 'invitedUserMissionReward_2',
  INVITE_STEP_REWARD: 'inviteStepReward',
  INVITED_USER_REWARD_RANDOM: 'invitationRewardRandom',
  COUPANG_VISIT: 'coupangVisit',
  ONBOARDING_EVENT: 'onboardingEvent',
  LOTTERY: 'lottery',
  WEEKLY_ATTENDANCE_BONUS: 'attendanceWeeklyBonus',
  POINT_EXPIRATION: 'pointExpiration',
  DIVIDEND: 'dividend',
  BUZZVIL_REWARD: 'buzzvilReward',
  INVITATION_RECEIPT: 'invitationReceipt',
};

// 각 테이블에서 가져온 raw 데이터 타입들
export interface RawEveryReceipt {
  id: number;
  created_at: string;
  point: number | null;
  status: string | null;
  image_url: string | null;
}

export interface RawPointAction {
  id: number;
  created_at: string;
  point_amount: number | null;
  type: string;
  status: string | null;
  additional_data: Record<string, unknown> | null;
}

export interface RawStepReward {
  id: number;
  created_at: string;
  point_amount: number | null;
  step_count: number | null;
}

export interface RawAffiliateData {
  id: number;
  created_at: string;
  point_amount: number | null;
  status: string | null;
  approval_date: string | null;
  instant_amount: number | null;
  prepayment_metadata: Record<string, unknown> | null;
  data: Record<string, unknown> | null;
}

export interface RawAttendance {
  id: number;
  created_at: string;
  created_at_date: string | null;
}

export interface RawAttendancePointAction {
  id: number;
  point_amount: number | null;
  additional_data: Record<string, unknown> | null;
  type: string;
}

export interface RawClaim {
  id: number;
  created_at: string;
  cashback_amount: number | null;
  status: string | null;
  location_info: { title: string } | null;
}

export interface RawNaverPayExchange {
  id: string;
  created_at: string;
  cashmore_point: number;
  naverpay_point: number;
  status: string;
}

// Repository 인터페이스
export interface ICashbackRepository {
  findEveryReceipts(
    userId: string,
    cursor: string | null,
    limit: number,
  ): Promise<RawEveryReceipt[]>;

  findPointActions(
    userId: string,
    cursor: string | null,
    limit: number,
  ): Promise<RawPointAction[]>;

  findStepRewards(
    userId: string,
    cursor: string | null,
    limit: number,
  ): Promise<RawStepReward[]>;

  findAffiliateData(
    userId: string,
    cursor: string | null,
    limit: number,
  ): Promise<RawAffiliateData[]>;

  findAttendances(
    userId: string,
    cursor: string | null,
    limit: number,
  ): Promise<RawAttendance[]>;

  findAttendancePointActions(
    userId: string,
  ): Promise<RawAttendancePointAction[]>;

  findClaims(
    userId: string,
    cursor: string | null,
    limit: number,
  ): Promise<RawClaim[]>;

  findNaverPayExchanges(
    userId: string,
    cursor: string | null,
    limit: number,
  ): Promise<RawNaverPayExchange[]>;
}

// DI 토큰
export const CASHBACK_REPOSITORY = Symbol('CASHBACK_REPOSITORY');
