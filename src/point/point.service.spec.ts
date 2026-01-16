import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { PointService } from './point.service';
import { POINT_REPOSITORY } from './interfaces/point-repository.interface';
import { StubPointRepository } from './repositories/stub-point.repository';

describe('PointService', () => {
  let service: PointService;
  let repository: StubPointRepository;

  beforeEach(async () => {
    repository = new StubPointRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PointService,
        {
          provide: POINT_REPOSITORY,
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<PointService>(PointService);
  });

  describe('getPointTotal', () => {
    const userId = 'test-user-id';

    beforeEach(() => {
      repository.clear();
    });

    it('스냅샷이 있으면 스냅샷 기준으로 포인트를 계산한다', async () => {
      repository.setSnapshot(userId, {
        point_balance: 5000,
        updated_at: '2024-01-01T00:00:00Z',
      });

      repository.setPointActions(userId, [
        {
          id: 1,
          type: 'EVERY_RECEIPT',
          created_at: '2024-01-02T00:00:00Z',
          point_amount: 100,
          status: 'done',
        },
      ]);

      const result = await service.getPointTotal(userId);

      expect(result.totalPoint).toBe(5100);
    });

    it('스냅샷이 없으면 전체 액션을 조회해서 계산한다', async () => {
      repository.setPointActions(userId, [
        {
          id: 1,
          type: 'EVERY_RECEIPT',
          created_at: '2024-01-01',
          point_amount: 1000,
          status: 'done',
        },
        {
          id: 2,
          type: 'ATTENDANCE',
          created_at: '2024-01-02',
          point_amount: 50,
          status: 'done',
        },
      ]);

      const result = await service.getPointTotal(userId);

      expect(result.totalPoint).toBe(1050);
    });

    it('소멸 예정 포인트를 계산한다', async () => {
      repository.setMonthlyEarnedPoints(userId, [
        { earned_points: 3000 },
        { earned_points: 2000 },
      ]);

      repository.setWithdrawalActions(userId, [
        {
          type: 'EXCHANGE_POINT_TO_CASH',
          point_amount: -1000,
          status: 'done',
        },
      ]);

      const result = await service.getPointTotal(userId);

      // 5000 (6개월전 적립) - 1000 (출금) = 4000
      expect(result.expiringPoints).toBe(4000);
    });

    it('응답에 expiringDate가 포함된다', async () => {
      const result = await service.getPointTotal(userId);

      expect(result.expiringDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
