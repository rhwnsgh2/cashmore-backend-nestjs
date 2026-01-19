import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import dayjs from 'dayjs';
import { LotteryService } from './lottery.service';
import { LOTTERY_REPOSITORY } from './interfaces/lottery-repository.interface';
import { StubLotteryRepository } from './repositories/stub-lottery.repository';

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
});
