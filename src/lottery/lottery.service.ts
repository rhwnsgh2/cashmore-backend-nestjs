import {
  Inject,
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import type {
  ILotteryRepository,
  Lottery,
  LotteryType,
  MaxRewardLottery,
} from './interfaces/lottery-repository.interface';
import { LOTTERY_REPOSITORY } from './interfaces/lottery-repository.interface';
import { FcmService } from '../fcm/fcm.service';

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

export interface MaxRewardUserResponse {
  maskedNickname: string;
  amount: number;
  lotteryType: LotteryType;
  usedAt: string;
}

// STANDARD_5는 MAX_500으로 변환
function convertLotteryType(typeId: string): LotteryType {
  if (typeId === 'STANDARD_5') {
    return 'MAX_500';
  }
  return typeId as LotteryType;
}

// 닉네임을 마스킹하는 함수 (앞 3글자만 보이고 나머지는 ****)
function maskNickname(nickname: string | null): string {
  if (!nickname) return '익명****';
  if (nickname.length <= 3) return nickname + '****';
  return nickname.substring(0, 3) + '****';
}

@Injectable()
export class LotteryService {
  constructor(
    @Inject(LOTTERY_REPOSITORY)
    private lotteryRepository: ILotteryRepository,
    private fcmService: FcmService,
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

  async useLottery(userId: string, lotteryId: string) {
    const lottery = await this.lotteryRepository.findLotteryById(lotteryId);

    if (!lottery) {
      throw new NotFoundException('복권을 찾을 수 없습니다.');
    }

    if (lottery.user_id !== userId) {
      throw new BadRequestException('본인의 복권만 사용할 수 있습니다.');
    }

    if (lottery.status !== 'ISSUED') {
      throw new BadRequestException('복권 상태가 올바르지 않습니다.');
    }

    const usedAt = dayjs().toISOString();

    await this.lotteryRepository.updateLotteryStatus(lotteryId, 'USED', usedAt);

    await this.lotteryRepository.insertPointAction({
      user_id: userId,
      type: 'LOTTERY',
      point_amount: lottery.reward_amount,
      additional_data: {
        description: `복권 당첨금 ${lottery.reward_amount}원`,
        reference_id: lotteryId,
      },
      status: 'done',
    });

    // 클라이언트에게 복권 업데이트 알림
    this.fcmService
      .sendRefreshMessage(userId, 'lottery_update')
      .catch((err) => {
        console.error('[Lottery] Failed to send FCM notification:', err);
      });

    return {
      id: lotteryId,
      userId,
      rewardAmount: lottery.reward_amount,
      status: 'USED' as const,
      usedAt,
    };
  }

  async getMaxRewardUsers(limit: number): Promise<MaxRewardUserResponse[]> {
    const lotteries: MaxRewardLottery[] =
      await this.lotteryRepository.findMaxRewardLotteries(limit);

    return lotteries.map((lottery: MaxRewardLottery) => ({
      maskedNickname: maskNickname(lottery.nickname),
      amount: lottery.reward_amount,
      lotteryType: convertLotteryType(lottery.lottery_type_id),
      usedAt: lottery.used_at,
    }));
  }
}
