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

export interface InsertLotteryData {
  user_id: string;
  lottery_type_id: LotteryType;
  status: LotteryStatus;
  issued_at: string;
  expires_at: string;
  reward_amount: number;
  reason?: string | null;
}

export interface InsertPointActionData {
  user_id: string;
  type: string;
  point_amount: number;
  additional_data: Record<string, unknown>;
  status: string;
}

export type SlotTime = '09:00' | '13:00' | '18:00' | '22:00';

export interface InsertAdLotterySlotData {
  user_id: string;
  slot_time: SlotTime;
  reward_type: string;
  reward_metadata: Record<string, unknown>;
}

export interface MaxRewardLottery {
  user_id: string;
  reward_amount: number;
  lottery_type_id: LotteryType;
  used_at: string;
  nickname: string | null;
}

// Repository 인터페이스
export interface ILotteryRepository {
  findAvailableLotteries(userId: string): Promise<Lottery[]>;
  findLotteryById(lotteryId: string): Promise<Lottery | null>;
  insertLottery(data: InsertLotteryData): Promise<Lottery>;
  updateLotteryStatus(
    lotteryId: string,
    status: LotteryStatus,
    usedAt: string,
  ): Promise<void>;
  insertPointAction(data: InsertPointActionData): Promise<void>;
  insertAdLotterySlot(data: InsertAdLotterySlotData): Promise<void>;
  findMaxRewardLotteries(limit: number): Promise<MaxRewardLottery[]>;
}

// DI 토큰
export const LOTTERY_REPOSITORY = Symbol('LOTTERY_REPOSITORY');
