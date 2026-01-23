// 슬롯 시간 타입 정의
export type SlotTime = '09:00' | '13:00' | '18:00' | '22:00';

// 광고 복권 슬롯 레코드
export interface AdLotterySlot {
  id: string;
  user_id: string;
  slot_time: SlotTime;
  created_at: string;
}

// 슬롯 시간 범위
export interface SlotTimeRange {
  slot: SlotTime;
  startTime: string;
  endTime: string;
}

// Repository 인터페이스
export interface IAdLotterySlotRepository {
  /**
   * 특정 슬롯 시간 범위 내에 사용자의 광고 시청 기록이 있는지 확인
   * @param userId 사용자 ID
   * @param slotTime 슬롯 시간 (09:00, 13:00, 18:00, 22:00)
   * @param startTime 범위 시작 시간
   * @returns 시청 기록이 있으면 true
   */
  hasWatchedInSlot(
    userId: string,
    slotTime: SlotTime,
    startTime: string,
  ): Promise<boolean>;
}

// DI 토큰
export const AD_LOTTERY_SLOT_REPOSITORY = Symbol('AD_LOTTERY_SLOT_REPOSITORY');
