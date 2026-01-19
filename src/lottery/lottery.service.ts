import { Inject, Injectable } from '@nestjs/common';
import type {
  ILotteryRepository,
  LotteryType,
} from './interfaces/lottery-repository.interface';
import { LOTTERY_REPOSITORY } from './interfaces/lottery-repository.interface';

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
