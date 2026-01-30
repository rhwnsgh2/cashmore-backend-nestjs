import { describe, it, expect, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { PointBatchService } from './point-batch.service';
import { POINT_BATCH_REPOSITORY } from './interfaces/point-batch-repository.interface';
import { StubPointBatchRepository } from './repositories/stub-point-batch.repository';

describe('PointBatchService', () => {
  let service: PointBatchService;
  let stubRepository: StubPointBatchRepository;

  beforeEach(async () => {
    stubRepository = new StubPointBatchRepository();

    const module = await Test.createTestingModule({
      providers: [
        PointBatchService,
        { provide: POINT_BATCH_REPOSITORY, useValue: stubRepository },
      ],
    }).compile();

    service = module.get(PointBatchService);
  });

  describe('aggregate', () => {
    it('지난달 적립 포인트를 집계한다', async () => {
      stubRepository.setMonthlyEarnedPoints(
        Array.from({ length: 5000 }, (_, i) => ({
          userId: `user-${i}`,
          earnedPoints: 100,
        })),
      );

      const result = await service.aggregate('2026-02-01');

      expect(result.aggregatedUsers).toBe(5000);
      expect(result.targetMonth).toBe('2026-01');
    });
  });

  describe('expirePreview', () => {
    it('소멸 대상 유저와 포인트를 반환한다', async () => {
      stubRepository.setExpirationTargets([
        { userId: 'user-1', expiringPoints: 1000 },
        { userId: 'user-2', expiringPoints: 500 },
      ]);

      const result = await service.expirePreview('2026-02-01');

      expect(result.targets).toHaveLength(2);
      expect(result.totalExpiredPoints).toBe(1500);
      expect(result.expirationMonth).toBe('2025-07');
    });

    it('소멸 대상이 없으면 빈 배열 반환', async () => {
      stubRepository.setExpirationTargets([]);

      const result = await service.expirePreview('2026-02-01');

      expect(result.targets).toHaveLength(0);
      expect(result.totalExpiredPoints).toBe(0);
    });
  });

  describe('expire', () => {
    it('소멸 대상이 있으면 소멸을 실행한다', async () => {
      stubRepository.setExpirationTargets([
        { userId: 'user-1', expiringPoints: 2000 },
      ]);

      const result = await service.expire('2026-03-01');

      expect(result.expiredUsers).toBe(1);
      expect(result.totalExpiredPoints).toBe(2000);
      expect(result.expirationMonth).toBe('2025-08');

      const insertions = stubRepository.getInsertedExpirations();
      expect(insertions).toHaveLength(1);
      expect(insertions[0].baseDate).toBe('2026-03-01');
      expect(insertions[0].expirationMonth).toBe('2025-08');
    });

    it('소멸 대상이 없으면 insert하지 않는다', async () => {
      stubRepository.setExpirationTargets([]);

      const result = await service.expire('2026-02-01');

      expect(result.expiredUsers).toBe(0);
      expect(result.totalExpiredPoints).toBe(0);
      expect(stubRepository.getInsertedExpirations()).toHaveLength(0);
    });
  });

  describe('rollbackExpire', () => {
    it('특정 소멸 기준월의 레코드를 삭제한다', async () => {
      // 먼저 소멸 실행
      stubRepository.setExpirationTargets([
        { userId: 'user-1', expiringPoints: 1000 },
        { userId: 'user-2', expiringPoints: 500 },
      ]);
      await service.expire('2026-02-01');

      // 롤백
      const result = await service.rollbackExpire('2025-07');

      expect(result.deletedCount).toBe(2);
      expect(result.expirationMonth).toBe('2025-07');
      expect(stubRepository.getInsertedExpirations()).toHaveLength(0);
    });
  });

  describe('executeMonthlyBatch', () => {
    it('집계 + 소멸을 순차 실행한다', async () => {
      stubRepository.setMonthlyEarnedPoints(
        Array.from({ length: 5000 }, (_, i) => ({
          userId: `user-${i}`,
          earnedPoints: 100,
        })),
      );
      stubRepository.setExpirationTargets([
        { userId: 'user-1', expiringPoints: 1000 },
        { userId: 'user-2', expiringPoints: 500 },
      ]);

      const result = await service.executeMonthlyBatch('2026-02-01');

      expect(result.aggregatedUsers).toBe(5000);
      expect(result.targetMonth).toBe('2025-12');
      expect(result.expiredUsers).toBe(2);
      expect(result.totalExpiredPoints).toBe(1500);
      expect(result.expirationMonth).toBe('2025-07');
    });
  });
});
