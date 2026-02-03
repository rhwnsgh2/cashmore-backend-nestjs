import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import type { IStepRewardsRepository } from './interfaces/step-rewards-repository.interface';
import { STEP_REWARDS_REPOSITORY } from './interfaces/step-rewards-repository.interface';
import {
  LOTTERY_TYPE_MAP,
  REWARD_CONFIG,
  type ClaimType,
} from './constants/reward-config';
import { LotteryService } from '../lottery/lottery.service';
import type { LotteryType } from '../lottery/interfaces/lottery-repository.interface';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class StepRewardsService {
  constructor(
    @Inject(STEP_REWARDS_REPOSITORY)
    private stepRewardsRepository: IStepRewardsRepository,
    private lotteryService: LotteryService,
  ) {}

  async getStatus(userId: string) {
    const today = dayjs().tz('Asia/Seoul').format('YYYY-MM-DD');

    const claims = await this.stepRewardsRepository.findClaimsByUserAndDate(
      userId,
      today,
    );

    const claimedLevels = claims.map((c) => c.level);

    return {
      claimed_levels: claimedLevels,
      reward_config: REWARD_CONFIG,
    };
  }

  async claimReward(
    userId: string,
    stepCount: number,
    claimLevel: number,
    type: ClaimType,
  ) {
    const rewardLevel = REWARD_CONFIG.find((r) => r.level === claimLevel);
    if (!rewardLevel) {
      throw new BadRequestException('INVALID_LEVEL');
    }

    if (stepCount < rewardLevel.required_steps) {
      throw new BadRequestException('STEP_NOT_ENOUGH');
    }

    const today = dayjs().tz('Asia/Seoul').format('YYYY-MM-DD');

    const existingClaim =
      await this.stepRewardsRepository.findClaimByUserDateAndLevel(
        userId,
        today,
        claimLevel,
      );

    if (existingClaim) {
      throw new ConflictException('ALREADY_CLAIMED');
    }

    await this.stepRewardsRepository.insertClaim({
      user_id: userId,
      claim_date: today,
      level: claimLevel,
      current_step_count: stepCount,
    });

    const lotteryType = LOTTERY_TYPE_MAP[type] as LotteryType;
    const lottery = await this.lotteryService.issueLottery(
      userId,
      lotteryType,
      `STEP_REWARD_LEVEL_${claimLevel}`,
    );

    return {
      success: true,
      lottery_id: lottery.id,
    };
  }
}
