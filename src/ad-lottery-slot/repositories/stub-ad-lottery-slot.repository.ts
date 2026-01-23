import dayjs from 'dayjs';
import type {
  IAdLotterySlotRepository,
  AdLotterySlot,
  SlotTime,
} from '../interfaces/ad-lottery-slot-repository.interface';

/**
 * 테스트용 Stub Repository
 * 인메모리 데이터를 설정하고 테스트에서 사용
 */
export class StubAdLotterySlotRepository implements IAdLotterySlotRepository {
  private slots: Map<string, AdLotterySlot[]> = new Map();

  // 데이터 설정 메서드
  setSlots(userId: string, slots: AdLotterySlot[]): void {
    this.slots.set(userId, slots);
  }

  addSlot(slot: AdLotterySlot): void {
    const userSlots = this.slots.get(slot.user_id) || [];
    userSlots.push(slot);
    this.slots.set(slot.user_id, userSlots);
  }

  clear(): void {
    this.slots.clear();
  }

  // IAdLotterySlotRepository 구현
  hasWatchedInSlot(
    userId: string,
    slotTime: SlotTime,
    startTime: string,
  ): Promise<boolean> {
    const userSlots = this.slots.get(userId) || [];
    const startMoment = dayjs(startTime);

    const result = userSlots.some(
      (slot) =>
        slot.slot_time === slotTime &&
        (dayjs(slot.created_at).isAfter(startMoment) ||
          dayjs(slot.created_at).isSame(startMoment)),
    );

    return Promise.resolve(result);
  }
}
