import dayjs from 'dayjs';
import { randomUUID } from 'crypto';
import type {
  ILotteryRepository,
  InsertLotteryData,
  InsertPointActionData,
  InsertAdLotterySlotData,
  Lottery,
  LotteryStatus,
  MaxRewardLottery,
} from '../interfaces/lottery-repository.interface';

/**
 * 테스트용 Stub Repository
 * 인메모리 데이터를 설정하고 테스트에서 사용
 */
export class StubLotteryRepository implements ILotteryRepository {
  private lotteries: Map<string, Lottery[]> = new Map();
  private insertedReasons: {
    userId: string;
    reason: string;
    issuedAt: string;
  }[] = [];

  // 데이터 설정 메서드
  setLotteries(userId: string, lotteries: Lottery[]): void {
    this.lotteries.set(userId, lotteries);
  }

  addReason(userId: string, reason: string, issuedAt: string): void {
    this.insertedReasons.push({ userId, reason, issuedAt });
  }

  clear(): void {
    this.lotteries.clear();
    this.insertedReasons = [];
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

  findLotteryById(lotteryId: string): Promise<Lottery | null> {
    for (const userLotteries of this.lotteries.values()) {
      const lottery = userLotteries.find((l) => l.id === lotteryId);
      if (lottery) {
        return Promise.resolve(lottery);
      }
    }
    return Promise.resolve(null);
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

    if (data.reason) {
      this.insertedReasons.push({
        userId: data.user_id,
        reason: data.reason,
        issuedAt: data.issued_at,
      });
    }

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

  countByUserIdAndReasonToday(
    userId: string,
    reason: string,
    todayStart: string,
    _todayEnd: string,
  ): Promise<{ count: number; lastIssuedAt: string | null }> {
    // insertLottery에서 reason을 저장하지 않으므로 insertedReasons로 추적
    const matched = this.insertedReasons
      .filter(
        (r) =>
          r.userId === userId &&
          r.reason === reason &&
          r.issuedAt >= todayStart,
      )
      .sort((a, b) => (b.issuedAt > a.issuedAt ? 1 : -1));

    return Promise.resolve({
      count: matched.length,
      lastIssuedAt: matched.length > 0 ? matched[0].issuedAt : null,
    });
  }

  findMaxRewardLotteries(_limit: number): Promise<MaxRewardLottery[]> {
    // Stub: 빈 배열 반환
    return Promise.resolve([]);
  }
}
