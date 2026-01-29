import dayjs from 'dayjs';
import { randomUUID } from 'crypto';
import type {
  ILotteryRepository,
  InsertLotteryData,
  InsertPointActionData,
  InsertAdLotterySlotData,
  Lottery,
  LotteryStatus,
} from '../interfaces/lottery-repository.interface';

/**
 * 테스트용 Stub Repository
 * 인메모리 데이터를 설정하고 테스트에서 사용
 */
export class StubLotteryRepository implements ILotteryRepository {
  private lotteries: Map<string, Lottery[]> = new Map();

  // 데이터 설정 메서드
  setLotteries(userId: string, lotteries: Lottery[]): void {
    this.lotteries.set(userId, lotteries);
  }

  clear(): void {
    this.lotteries.clear();
  }

  // ILotteryRepository 구현
  findAvailableLotteries(userId: string): Promise<Lottery[]> {
    const userLotteries = this.lotteries.get(userId) || [];
    const now = dayjs();

    // status가 ISSUED이고 만료되지 않은 복권만 필터링
    const available = userLotteries
      .filter(
        (lottery) =>
          lottery.status === 'ISSUED' && dayjs(lottery.expires_at).isAfter(now),
      )
      .sort((a, b) => dayjs(b.issued_at).diff(dayjs(a.issued_at)))
      .slice(0, 20);

    return Promise.resolve(available);
  }

  insertLottery(data: InsertLotteryData): Promise<Lottery> {
    const lottery: Lottery = {
      id: randomUUID(),
      user_id: data.user_id,
      lottery_type_id: data.lottery_type_id,
      status: data.status,
      issued_at: data.issued_at,
      expires_at: data.expires_at,
      reward_amount: data.reward_amount,
      used_at: null,
    };

    const userLotteries = this.lotteries.get(data.user_id) || [];
    userLotteries.push(lottery);
    this.lotteries.set(data.user_id, userLotteries);

    return Promise.resolve(lottery);
  }

  updateLotteryStatus(
    lotteryId: string,
    status: LotteryStatus,
    usedAt: string,
  ): Promise<void> {
    for (const userLotteries of this.lotteries.values()) {
      const lottery = userLotteries.find((l) => l.id === lotteryId);
      if (lottery) {
        lottery.status = status;
        lottery.used_at = usedAt;
        break;
      }
    }
    return Promise.resolve();
  }

  insertPointAction(_data: InsertPointActionData): Promise<void> {
    return Promise.resolve();
  }

  insertAdLotterySlot(_data: InsertAdLotterySlotData): Promise<void> {
    return Promise.resolve();
  }
}
