// 타입 정의
export type LotteryType = 'STANDARD_5' | 'MAX_100' | 'MAX_500' | 'MAX_1000';
export type LotteryStatus = 'ISSUED' | 'USED' | 'EXPIRED';

export interface Lottery {
  id: string;
  user_id: string;
  lottery_type_id: LotteryType;
  status: LotteryStatus;
  issued_at: string;
  expires_at: string;
  reward_amount: number;
  used_at: string | null;
}

// Repository 인터페이스
export interface ILotteryRepository {
  /**
   * 사용자의 사용 가능한 복권 목록 조회
   * - status: ISSUED
   * - expires_at > now
   * - 최신순 정렬, 최대 20개
   */
  findAvailableLotteries(userId: string): Promise<Lottery[]>;
}

// DI 토큰
export const LOTTERY_REPOSITORY = Symbol('LOTTERY_REPOSITORY');
