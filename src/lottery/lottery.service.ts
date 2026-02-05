import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import type {
  ILotteryRepository,
  Lottery,
  LotteryType,
} from './interfaces/lottery-repository.interface';
import { LOTTERY_REPOSITORY } from './interfaces/lottery-repository.interface';

dayjs.extend(utc);
dayjs.extend(timezone);

export interface LotteryResponse {
  id: string;
  userId: string;
  lotteryTypeId: LotteryType;
  lotteryType: LotteryType;
  status: string;
  issuedAt: string;
  expiresAt: string;
  rewardAmount: number;
  usedAt?: string;
}

// STANDARD_5는 MAX_500으로 변환
function convertLotteryType(typeId: string): LotteryType {
  if (typeId === 'STANDARD_5') {
    return 'MAX_500';
  }
  return typeId as LotteryType;
}

@Injectable()
export class LotteryService {
  constructor(
    @Inject(LOTTERY_REPOSITORY)
    private lotteryRepository: ILotteryRepository,
  ) {}

  private static readonly MAX_500_REWARDS = [
    { amount: 5, probability: 93.9 },
    { amount: 10, probability: 5.52 },
    { amount: 30, probability: 0.5 },
    { amount: 500, probability: 0.08 },
  ];

  private static readonly MAX_100_REWARDS = [
    { amount: 3, probability: 81 },
    { amount: 5, probability: 15 },
    { amount: 10, probability: 3 },
    { amount: 30, probability: 0.8 },
    { amount: 100, probability: 0.2 },
  ];

  private static readonly MAX_1000_REWARDS = [
    { amount: 8, probability: 90.7 },
    { amount: 10, probability: 8.05 },
    { amount: 50, probability: 1 },
    { amount: 500, probability: 0.2 },
    { amount: 1000, probability: 0.05 },
  ];

  private getRewardTable(lotteryType: LotteryType) {
    switch (lotteryType) {
      case 'MAX_100':
        return LotteryService.MAX_100_REWARDS;
      case 'MAX_1000':
        return LotteryService.MAX_1000_REWARDS;
      case 'STANDARD_5':
      case 'MAX_500':
      default:
        return LotteryService.MAX_500_REWARDS;
    }
  }

  private calculateRewardAmount(lotteryType: LotteryType): number {
    const rewards = this.getRewardTable(lotteryType);
    const random = Math.random() * 100;
    let cumulative = 0;

    for (const reward of rewards) {
      cumulative += reward.probability;
      if (random < cumulative) {
        return reward.amount;
      }
    }

    return rewards[0].amount;
  }

  async issueLottery(
    userId: string,
    lotteryType: LotteryType,
    reason?: string,
  ): Promise<Lottery> {
    const validTypes: LotteryType[] = [
      'STANDARD_5',
      'MAX_100',
      'MAX_500',
      'MAX_1000',
    ];
    if (!validTypes.includes(lotteryType)) {
      throw new BadRequestException(`Invalid lottery type: ${lotteryType}`);
    }

    const rewardAmount = this.calculateRewardAmount(lotteryType);
    const issuedAt = dayjs().toISOString();
    const expiresAt = dayjs().tz('Asia/Seoul').endOf('day').toISOString();

    // STANDARD_5 → MAX_500 변환
    const actualType: LotteryType =
      lotteryType === 'STANDARD_5' ? 'MAX_500' : lotteryType;

    const lottery = await this.lotteryRepository.insertLottery({
      user_id: userId,
      lottery_type_id: actualType,
      status: 'ISSUED',
      issued_at: issuedAt,
      expires_at: expiresAt,
      reward_amount: rewardAmount,
      reason: reason ?? null,
    });

    return lottery;
  }

  async showAdAndClaim(
    userId: string,
    adId: string,
    slotTime: '09:00' | '13:00' | '18:00' | '22:00',
  ) {
    const lottery = await this.issueLottery(
      userId,
      'STANDARD_5',
      `ad_reward_${adId}`,
    );

    const usedAt = dayjs().toISOString();
    await this.lotteryRepository.updateLotteryStatus(
      lottery.id,
      'USED',
      usedAt,
    );

    await this.lotteryRepository.insertPointAction({
      user_id: userId,
      type: 'LOTTERY',
      point_amount: lottery.reward_amount,
      additional_data: {
        description: `복권 당첨금 ${lottery.reward_amount}원`,
        reference_id: lottery.id,
      },
      status: 'done',
    });

    // ad_lottery_slots에 광고 시청 기록
    await this.lotteryRepository.insertAdLotterySlot({
      user_id: userId,
      slot_time: slotTime,
      reward_type: 'LOTTERY',
      reward_metadata: {
        reason: '광고 시청 보상',
        reward_id: lottery.id,
        lottery_type: 'STANDARD_5',
      },
    });

    return {
      success: true,
      lottery: {
        id: lottery.id,
        userId: lottery.user_id,
        rewardAmount: lottery.reward_amount,
        status: 'USED' as const,
        usedAt,
      },
    };
  }

  async getMyLotteries(userId: string): Promise<LotteryResponse[]> {
    const lotteries =
      await this.lotteryRepository.findAvailableLotteries(userId);

    return lotteries.map((lottery) => {
      const convertedType = convertLotteryType(lottery.lottery_type_id);

      return {
        id: lottery.id,
        userId: lottery.user_id,
        lotteryTypeId: convertedType,
        lotteryType: convertedType,
        status: lottery.status,
        issuedAt: lottery.issued_at,
        expiresAt: lottery.expires_at,
        rewardAmount: lottery.reward_amount,
        usedAt: lottery.used_at ?? undefined,
      };
    });
  }
}
