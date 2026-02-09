import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import dayjs from 'dayjs';
import { LotteryService } from './lottery.service';
import { LOTTERY_REPOSITORY } from './interfaces/lottery-repository.interface';
import { StubLotteryRepository } from './repositories/stub-lottery.repository';
import { FcmService } from '../fcm/fcm.service';

const mockFcmService = {
  sendRefreshMessage: async () => {},
};

describe('LotteryService', () => {
  let service: LotteryService;
  let repository: StubLotteryRepository;

  beforeEach(async () => {
    repository = new StubLotteryRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LotteryService,
        {
          provide: LOTTERY_REPOSITORY,
          useValue: repository,
        },
        {
          provide: FcmService,
          useValue: mockFcmService,
        },
      ],
    }).compile();

    service = module.get<LotteryService>(LotteryService);
  });

  describe('getMyLotteries', () => {
    const userId = 'test-user-id';

    beforeEach(() => {
      repository.clear();
    });

    it('사용 가능한 복권 목록을 반환한다', async () => {
      const futureDate = dayjs().add(7, 'day').toISOString();

      repository.setLotteries(userId, [
        {
          id: 'lottery-1',
          user_id: userId,
          lottery_type_id: 'MAX_500',
          status: 'ISSUED',
          issued_at: dayjs().subtract(1, 'day').toISOString(),
          expires_at: futureDate,
          reward_amount: 0,
          used_at: null,
        },
      ]);

      const result = await service.getMyLotteries(userId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('lottery-1');
      expect(result[0].lotteryType).toBe('MAX_500');
    });

    it('STANDARD_5 타입은 MAX_500으로 변환한다', async () => {
      const futureDate = dayjs().add(7, 'day').toISOString();

      repository.setLotteries(userId, [
        {
          id: 'lottery-1',
          user_id: userId,
          lottery_type_id: 'STANDARD_5',
          status: 'ISSUED',
          issued_at: dayjs().toISOString(),
          expires_at: futureDate,
          reward_amount: 0,
          used_at: null,
        },
      ]);

      const result = await service.getMyLotteries(userId);

      expect(result[0].lotteryType).toBe('MAX_500');
      expect(result[0].lotteryTypeId).toBe('MAX_500');
    });

    it('복권이 없으면 빈 배열을 반환한다', async () => {
      const result = await service.getMyLotteries(userId);

      expect(result).toEqual([]);
    });

    it('만료된 복권은 반환하지 않는다', async () => {
      const pastDate = dayjs().subtract(1, 'day').toISOString();
      const futureDate = dayjs().add(7, 'day').toISOString();

      repository.setLotteries(userId, [
        {
          id: 'expired-lottery',
          user_id: userId,
          lottery_type_id: 'MAX_500',
          status: 'ISSUED',
          issued_at: dayjs().subtract(10, 'day').toISOString(),
          expires_at: pastDate,
          reward_amount: 0,
          used_at: null,
        },
        {
          id: 'valid-lottery',
          user_id: userId,
          lottery_type_id: 'MAX_500',
          status: 'ISSUED',
          issued_at: dayjs().toISOString(),
          expires_at: futureDate,
          reward_amount: 0,
          used_at: null,
        },
      ]);

      const result = await service.getMyLotteries(userId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('valid-lottery');
    });

    it('USED 상태의 복권은 반환하지 않는다', async () => {
      const futureDate = dayjs().add(7, 'day').toISOString();

      repository.setLotteries(userId, [
        {
          id: 'used-lottery',
          user_id: userId,
          lottery_type_id: 'MAX_500',
          status: 'USED',
          issued_at: dayjs().subtract(1, 'day').toISOString(),
          expires_at: futureDate,
          reward_amount: 100,
          used_at: dayjs().toISOString(),
        },
        {
          id: 'issued-lottery',
          user_id: userId,
          lottery_type_id: 'MAX_500',
          status: 'ISSUED',
          issued_at: dayjs().toISOString(),
          expires_at: futureDate,
          reward_amount: 0,
          used_at: null,
        },
      ]);

      const result = await service.getMyLotteries(userId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('issued-lottery');
    });
  });

  describe('issueLottery', () => {
    const userId = 'test-user-id';

    it('복권을 발급한다', async () => {
      const result = await service.issueLottery(userId, 'MAX_500');

      expect(result.user_id).toBe(userId);
      expect(result.lottery_type_id).toBe('MAX_500');
      expect(result.status).toBe('ISSUED');
      expect(result.reward_amount).toBeGreaterThan(0);
      expect(result.id).toBeDefined();
    });

    it('STANDARD_5 타입은 MAX_500으로 변환하여 저장한다', async () => {
      const result = await service.issueLottery(userId, 'STANDARD_5');

      expect(result.lottery_type_id).toBe('MAX_500');
    });

    it('MAX_100 타입 복권을 발급한다', async () => {
      const result = await service.issueLottery(userId, 'MAX_100');

      expect(result.lottery_type_id).toBe('MAX_100');
      expect(result.reward_amount).toBeGreaterThan(0);
    });

    it('MAX_1000 타입 복권을 발급한다', async () => {
      const result = await service.issueLottery(userId, 'MAX_1000');

      expect(result.lottery_type_id).toBe('MAX_1000');
      expect(result.reward_amount).toBeGreaterThan(0);
    });

    it('잘못된 타입이면 BadRequestException을 던진다', async () => {
      await expect(
        service.issueLottery(userId, 'INVALID' as any),
      ).rejects.toThrow('Invalid lottery type');
    });

    it('reason을 포함하여 발급할 수 있다', async () => {
      const result = await service.issueLottery(
        userId,
        'MAX_500',
        'ad_reward_lottery_13:00',
      );

      expect(result).toBeDefined();
      expect(result.user_id).toBe(userId);
    });
  });

  describe('showAdAndClaim', () => {
    const userId = 'test-user-id';

    it('광고 시청 후 복권을 발급하고 즉시 사용한다', async () => {
      const result = await service.showAdAndClaim(userId, 'ad_123', '13:00');

      expect(result.success).toBe(true);
      expect(result.lottery.userId).toBe(userId);
      expect(result.lottery.status).toBe('USED');
      expect(result.lottery.rewardAmount).toBeGreaterThan(0);
      expect(result.lottery.usedAt).toBeDefined();
      expect(result.lottery.id).toBeDefined();
    });

    it('사용 후 복권 상태가 USED로 변경된다', async () => {
      const result = await service.showAdAndClaim(userId, 'ad_123', '09:00');

      const lotteries = await service.getMyLotteries(userId);
      const found = lotteries.find((l) => l.id === result.lottery.id);
      expect(found).toBeUndefined();
    });

    it('다른 슬롯 시간도 정상 동작한다', async () => {
      const result = await service.showAdAndClaim(userId, 'ad_456', '22:00');

      expect(result.success).toBe(true);
      expect(result.lottery.status).toBe('USED');
    });
  });

  describe('useLottery', () => {
    const userId = 'test-user-id';

    beforeEach(() => {
      repository.clear();
    });

    it('ISSUED 상태의 복권을 사용한다', async () => {
      const futureDate = dayjs().add(7, 'day').toISOString();

      repository.setLotteries(userId, [
        {
          id: 'lottery-1',
          user_id: userId,
          lottery_type_id: 'MAX_500',
          status: 'ISSUED',
          issued_at: dayjs().toISOString(),
          expires_at: futureDate,
          reward_amount: 100,
          used_at: null,
        },
      ]);

      const result = await service.useLottery(userId, 'lottery-1');

      expect(result.id).toBe('lottery-1');
      expect(result.userId).toBe(userId);
      expect(result.rewardAmount).toBe(100);
      expect(result.status).toBe('USED');
      expect(result.usedAt).toBeDefined();
    });

    it('사용 후 복권이 목록에서 조회되지 않는다', async () => {
      const futureDate = dayjs().add(7, 'day').toISOString();

      repository.setLotteries(userId, [
        {
          id: 'lottery-1',
          user_id: userId,
          lottery_type_id: 'MAX_500',
          status: 'ISSUED',
          issued_at: dayjs().toISOString(),
          expires_at: futureDate,
          reward_amount: 50,
          used_at: null,
        },
      ]);

      await service.useLottery(userId, 'lottery-1');

      const lotteries = await service.getMyLotteries(userId);
      expect(lotteries).toHaveLength(0);
    });

    it('존재하지 않는 복권이면 NotFoundException을 던진다', async () => {
      await expect(
        service.useLottery(userId, 'non-existent-lottery'),
      ).rejects.toThrow('복권을 찾을 수 없습니다.');
    });

    it('다른 사용자의 복권이면 BadRequestException을 던진다', async () => {
      const otherUserId = 'other-user-id';
      const futureDate = dayjs().add(7, 'day').toISOString();

      repository.setLotteries(otherUserId, [
        {
          id: 'lottery-other',
          user_id: otherUserId,
          lottery_type_id: 'MAX_500',
          status: 'ISSUED',
          issued_at: dayjs().toISOString(),
          expires_at: futureDate,
          reward_amount: 100,
          used_at: null,
        },
      ]);

      await expect(service.useLottery(userId, 'lottery-other')).rejects.toThrow(
        '본인의 복권만 사용할 수 있습니다.',
      );
    });

    it('USED 상태의 복권이면 BadRequestException을 던진다', async () => {
      const futureDate = dayjs().add(7, 'day').toISOString();

      repository.setLotteries(userId, [
        {
          id: 'lottery-used',
          user_id: userId,
          lottery_type_id: 'MAX_500',
          status: 'USED',
          issued_at: dayjs().subtract(1, 'day').toISOString(),
          expires_at: futureDate,
          reward_amount: 100,
          used_at: dayjs().toISOString(),
        },
      ]);

      await expect(service.useLottery(userId, 'lottery-used')).rejects.toThrow(
        '복권 상태가 올바르지 않습니다.',
      );
    });

    it('EXPIRED 상태의 복권이면 BadRequestException을 던진다', async () => {
      const futureDate = dayjs().add(7, 'day').toISOString();

      repository.setLotteries(userId, [
        {
          id: 'lottery-expired',
          user_id: userId,
          lottery_type_id: 'MAX_500',
          status: 'EXPIRED',
          issued_at: dayjs().subtract(10, 'day').toISOString(),
          expires_at: futureDate,
          reward_amount: 100,
          used_at: null,
        },
      ]);

      await expect(
        service.useLottery(userId, 'lottery-expired'),
      ).rejects.toThrow('복권 상태가 올바르지 않습니다.');
    });
  });
});
