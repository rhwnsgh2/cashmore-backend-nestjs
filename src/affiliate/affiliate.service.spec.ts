import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AffiliateService } from './affiliate.service';
import { AFFILIATE_REPOSITORY } from './interfaces/affiliate-repository.interface';
import { StubAffiliateRepository } from './repositories/stub-affiliate.repository';
import { POINT_WRITE_SERVICE } from '../point-write/point-write.interface';
import { PointWriteService } from '../point-write/point-write.service';
import { StubPointWriteRepository } from '../point-write/repositories/stub-point-write.repository';
import { SlackService } from '../slack/slack.service';

class StubSlackService {
  reports: string[] = [];

  reportBugToSlack(content: string): Promise<void> {
    this.reports.push(content);
    return Promise.resolve();
  }
}

describe('AffiliateService', () => {
  let service: AffiliateService;
  let repository: StubAffiliateRepository;
  let pointWriteRepo: StubPointWriteRepository;
  let slackService: StubSlackService;

  beforeEach(async () => {
    repository = new StubAffiliateRepository();
    pointWriteRepo = new StubPointWriteRepository();
    slackService = new StubSlackService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AffiliateService,
        { provide: AFFILIATE_REPOSITORY, useValue: repository },
        {
          provide: POINT_WRITE_SERVICE,
          useFactory: () => new PointWriteService(pointWriteRepo),
        },
        { provide: SlackService, useValue: slackService },
      ],
    }).compile();

    service = module.get<AffiliateService>(AffiliateService);
  });

  describe('processApprovals', () => {
    it('pending 건이 없으면 빈 결과를 반환한다', async () => {
      const result = await service.processApprovals();

      expect(result).toEqual({
        processed: 0,
        successful: 0,
        failed: 0,
        details: [],
      });
      expect(pointWriteRepo.getInsertedActions()).toHaveLength(0);
      expect(repository.getCompleted()).toHaveLength(0);
    });

    it('pending 건에 대해 AFFILIATE 포인트를 지급하고 완료 처리한다', async () => {
      repository.setPending([
        {
          id: 101,
          userId: 'user-1',
          pointAmount: 1500,
          merchantId: 'aliexpress',
        },
      ]);

      const result = await service.processApprovals();

      expect(result.processed).toBe(1);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.details).toEqual([{ id: 101, success: true }]);

      const actions = pointWriteRepo.getInsertedActions();
      expect(actions).toHaveLength(1);
      expect(actions[0]).toMatchObject({
        userId: 'user-1',
        amount: 1500,
        type: 'AFFILIATE',
        status: 'done',
        additionalData: {
          affiliate_callback_id: 101,
          merchant_id: 'aliexpress',
        },
      });

      const completed = repository.getCompleted();
      expect(completed).toHaveLength(1);
      expect(completed[0].id).toBe(101);
    });

    it('여러 건이 있으면 모두 순차 처리한다', async () => {
      repository.setPending([
        { id: 1, userId: 'user-a', pointAmount: 500, merchantId: 'a' },
        { id: 2, userId: 'user-b', pointAmount: 1000, merchantId: 'b' },
        { id: 3, userId: 'user-c', pointAmount: 2000, merchantId: 'c' },
      ]);

      const result = await service.processApprovals();

      expect(result.processed).toBe(3);
      expect(result.successful).toBe(3);
      expect(pointWriteRepo.getInsertedActions()).toHaveLength(3);
      expect(repository.getCompleted()).toHaveLength(3);
    });

    it('merchant_id가 unknown이어도 정상 처리된다', async () => {
      repository.setPending([
        { id: 1, userId: 'user-a', pointAmount: 100, merchantId: 'unknown' },
      ]);

      const result = await service.processApprovals();

      expect(result.successful).toBe(1);
      expect(
        pointWriteRepo.getInsertedActions()[0].additionalData.merchant_id,
      ).toBe('unknown');
    });

    it('성공 후 Slack 알림에 총 지급액이 포함된다', async () => {
      repository.setPending([
        { id: 1, userId: 'user-a', pointAmount: 500, merchantId: 'a' },
        { id: 2, userId: 'user-b', pointAmount: 1500, merchantId: 'b' },
      ]);

      await service.processApprovals();

      expect(slackService.reports).toHaveLength(1);
      const message = slackService.reports[0];
      expect(message).toContain('2건');
      expect(message).toContain('성공: 2건');
      expect(message).toContain('2,000원');
    });

    it('pending 건이 없으면 Slack 알림을 보내지 않는다', async () => {
      await service.processApprovals();
      expect(slackService.reports).toHaveLength(0);
    });

    it('개별 건 실패는 다른 건 처리에 영향을 주지 않는다', async () => {
      repository.setPending([
        { id: 1, userId: 'user-a', pointAmount: 500, merchantId: 'a' },
        { id: 2, userId: 'user-b', pointAmount: 1000, merchantId: 'b' },
      ]);

      const originalMarkCompleted =
        repository.markCompleted.bind(repository);
      repository.markCompleted = (id: number, completedAt: string) => {
        if (id === 1) {
          return Promise.reject(new Error('DB 오류'));
        }
        return originalMarkCompleted(id, completedAt);
      };

      const result = await service.processApprovals();

      expect(result.processed).toBe(2);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.details).toEqual([
        { id: 1, success: false, error: 'DB 오류' },
        { id: 2, success: true },
      ]);
      // 포인트는 두 건 모두 지급됐지만, 1건은 completed 업데이트가 실패
      expect(pointWriteRepo.getInsertedActions()).toHaveLength(2);
      expect(repository.getCompleted()).toHaveLength(1);
      expect(repository.getCompleted()[0].id).toBe(2);
    });

    it('포인트 지급 실패 시 해당 건을 failed로 기록하고 다음 건을 계속 처리한다', async () => {
      repository.setPending([
        { id: 1, userId: 'user-a', pointAmount: 500, merchantId: 'a' },
        { id: 2, userId: 'user-b', pointAmount: 1000, merchantId: 'b' },
      ]);

      let callCount = 0;
      const originalInsert =
        pointWriteRepo.insertPointAction.bind(pointWriteRepo);
      pointWriteRepo.insertPointAction = (
        userId,
        amount,
        type,
        status,
        additionalData,
      ) => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Insert 실패'));
        }
        return originalInsert(userId, amount, type, status, additionalData);
      };

      const result = await service.processApprovals();

      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.details[0]).toEqual({
        id: 1,
        success: false,
        error: 'Insert 실패',
      });
      expect(result.details[1]).toEqual({ id: 2, success: true });
    });
  });
});
