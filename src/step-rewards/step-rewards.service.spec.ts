import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { StepRewardsService } from './step-rewards.service';
import { STEP_REWARDS_REPOSITORY } from './interfaces/step-rewards-repository.interface';
import { StubStepRewardsRepository } from './repositories/stub-step-rewards.repository';
import { LotteryService } from '../lottery/lottery.service';
import { REWARD_CONFIG } from './constants/reward-config';

describe('StepRewardsService', () => {
  let service: StepRewardsService;
  let repository: StubStepRewardsRepository;
  let lotteryService: { issueLottery: ReturnType<typeof vi.fn> };

  const userId = 'test-user-id';

  beforeEach(async () => {
    repository = new StubStepRewardsRepository();
    lotteryService = {
      issueLottery: vi.fn().mockResolvedValue({
        id: 'lottery-id-123',
        user_id: userId,
        lottery_type_id: 'MAX_500',
        status: 'ISSUED',
        reward_amount: 5,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StepRewardsService,
        {
          provide: STEP_REWARDS_REPOSITORY,
          useValue: repository,
        },
        {
          provide: LotteryService,
          useValue: lotteryService,
        },
      ],
    }).compile();

    service = module.get<StepRewardsService>(StepRewardsService);
  });

  describe('getStatus', () => {
    it('오늘 수령한 레벨 목록과 보상 설정을 반환한다', async () => {
      const today = new Date().toISOString().split('T')[0];
      repository.addClaim({
        user_id: userId,
        claim_date: today,
        level: 1,
        current_step_count: 0,
      });
      repository.addClaim({
        user_id: userId,
        claim_date: today,
        level: 2,
        current_step_count: 2500,
      });

      const result = await service.getStatus(userId);

      expect(result.claimed_levels).toContain(1);
      expect(result.claimed_levels).toContain(2);
      expect(result.reward_config).toEqual(REWARD_CONFIG);
    });

    it('수령 기록이 없으면 빈 배열을 반환한다', async () => {
      const result = await service.getStatus(userId);

      expect(result.claimed_levels).toEqual([]);
      expect(result.reward_config).toEqual(REWARD_CONFIG);
    });

    it('다른 날짜의 수령 기록은 포함하지 않는다', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      repository.addClaim({
        user_id: userId,
        claim_date: yesterday,
        level: 1,
        current_step_count: 0,
      });

      const result = await service.getStatus(userId);

      expect(result.claimed_levels).toEqual([]);
    });
  });

  describe('claimReward', () => {
    it('보상을 정상적으로 수령하면 복권 ID를 반환한다', async () => {
      const result = await service.claimReward(userId, 5000, 3, 'long');

      expect(result.success).toBe(true);
      expect(result.lottery_id).toBe('lottery-id-123');
      expect(lotteryService.issueLottery).toHaveBeenCalledWith(
        userId,
        'MAX_500',
        'STEP_REWARD_LEVEL_3',
      );
    });

    it('short 타입이면 MAX_100 복권을 발급한다', async () => {
      await service.claimReward(userId, 5000, 3, 'short');

      expect(lotteryService.issueLottery).toHaveBeenCalledWith(
        userId,
        'MAX_100',
        'STEP_REWARD_LEVEL_3',
      );
    });

    it('레벨 1(첫걸음)은 걸음 수 0으로도 수령 가능하다', async () => {
      const result = await service.claimReward(userId, 0, 1, 'long');

      expect(result.success).toBe(true);
    });

    it('존재하지 않는 레벨이면 INVALID_LEVEL 에러를 던진다', async () => {
      await expect(
        service.claimReward(userId, 5000, 99, 'long'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.claimReward(userId, 5000, 99, 'long'),
      ).rejects.toThrow('INVALID_LEVEL');
    });

    it('걸음 수가 부족하면 STEP_NOT_ENOUGH 에러를 던진다', async () => {
      await expect(
        service.claimReward(userId, 1000, 2, 'long'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.claimReward(userId, 1000, 2, 'long'),
      ).rejects.toThrow('STEP_NOT_ENOUGH');
    });

    it('이미 수령한 레벨이면 ALREADY_CLAIMED 에러를 던진다', async () => {
      const today = new Date().toISOString().split('T')[0];
      repository.addClaim({
        user_id: userId,
        claim_date: today,
        level: 3,
        current_step_count: 5000,
      });

      await expect(
        service.claimReward(userId, 5000, 3, 'long'),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.claimReward(userId, 5000, 3, 'long'),
      ).rejects.toThrow('ALREADY_CLAIMED');
    });

    it('다른 날짜에 수령한 레벨은 오늘 다시 수령할 수 있다', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      repository.addClaim({
        user_id: userId,
        claim_date: yesterday,
        level: 3,
        current_step_count: 5000,
      });

      const result = await service.claimReward(userId, 5000, 3, 'long');

      expect(result.success).toBe(true);
    });
  });
});
