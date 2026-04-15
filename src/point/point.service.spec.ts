import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { PointService } from './point.service';
import { POINT_REPOSITORY } from './interfaces/point-repository.interface';
import { StubPointRepository } from './repositories/stub-point.repository';
import { POINT_WRITE_SERVICE } from '../point-write/point-write.interface';
import { PointWriteService } from '../point-write/point-write.service';
import { StubPointWriteRepository } from '../point-write/repositories/stub-point-write.repository';
import { SlackService } from '../slack/slack.service';

dayjs.extend(utc);
dayjs.extend(timezone);

class StubSlackService {
  reports: string[] = [];
  reportBugToSlack(content: string): Promise<void> {
    this.reports.push(content);
    return Promise.resolve();
  }
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('PointService', () => {
  let service: PointService;
  let repository: StubPointRepository;
  let slackService: StubSlackService;

  beforeEach(async () => {
    repository = new StubPointRepository();
    slackService = new StubSlackService();
    const stubPointWriteRepo = new StubPointWriteRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PointService,
        {
          provide: POINT_REPOSITORY,
          useValue: repository,
        },
        {
          provide: POINT_WRITE_SERVICE,
          useFactory: () => new PointWriteService(stubPointWriteRepo),
        },
        {
          provide: SlackService,
          useValue: slackService,
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

    it('응답에 expiringDate가 포함된다', async () => {
      const result = await service.getPointTotal(userId);

      expect(result.expiringDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('응답에 lastWeekPoint와 weeklyPoint가 포함된다', async () => {
      const result = await service.getPointTotal(userId);

      expect(result.lastWeekPoint).toBeDefined();
      expect(result.weeklyPoint).toBeDefined();
      expect(typeof result.lastWeekPoint).toBe('number');
      expect(typeof result.weeklyPoint).toBe('number');
    });

    it('이번주 적립 포인트를 계산한다 (POINT_ADD_TYPES + status=done)', async () => {
      const now = dayjs().tz('Asia/Seoul');
      const thisWeekStart =
        now.day() === 0
          ? now.subtract(6, 'day').startOf('day')
          : now.startOf('week').add(1, 'day');

      repository.setPointActions(userId, [
        {
          id: 1,
          type: 'EVERY_RECEIPT', // POINT_ADD_TYPES에 포함
          created_at: thisWeekStart.add(1, 'hour').toISOString(),
          point_amount: 100,
          status: 'done',
        },
        {
          id: 2,
          type: 'ATTENDANCE', // POINT_ADD_TYPES에 포함
          created_at: thisWeekStart.add(2, 'hour').toISOString(),
          point_amount: 50,
          status: 'done',
        },
        {
          id: 3,
          type: 'EXCHANGE_POINT_TO_CASH', // POINT_ADD_TYPES에 미포함
          created_at: thisWeekStart.add(3, 'hour').toISOString(),
          point_amount: -500,
          status: 'done',
        },
        {
          id: 4,
          type: 'EVERY_RECEIPT',
          created_at: thisWeekStart.add(4, 'hour').toISOString(),
          point_amount: 200,
          status: 'pending', // status가 done이 아님
        },
      ]);

      const result = await service.getPointTotal(userId);

      // 100 + 50 = 150 (POINT_ADD_TYPES + done만 합산)
      expect(result.weeklyPoint).toBe(150);
    });

    it('지난주 적립 포인트를 계산한다', async () => {
      const now = dayjs().tz('Asia/Seoul');
      const thisWeekStart =
        now.day() === 0
          ? now.subtract(6, 'day').startOf('day')
          : now.startOf('week').add(1, 'day');
      const lastWeekStart = thisWeekStart.subtract(7, 'day');

      repository.setPointActions(userId, [
        {
          id: 1,
          type: 'EVERY_RECEIPT',
          created_at: lastWeekStart.add(1, 'day').toISOString(),
          point_amount: 300,
          status: 'done',
        },
        {
          id: 2,
          type: 'ATTENDANCE',
          created_at: lastWeekStart.add(3, 'day').toISOString(),
          point_amount: 100,
          status: 'done',
        },
      ]);

      const result = await service.getPointTotal(userId);

      expect(result.lastWeekPoint).toBe(400);
    });
  });

  // user_point_balance 검증 일시 중단 (정합성 설계 재검토 중)
  describe.skip('verifyBalance (병행 검증)', () => {
    const userId = 'verify-user';

    beforeEach(() => {
      repository.clear();
    });

    it('balance row가 없으면 알림 없음', async () => {
      repository.setPointActions(userId, [
        { id: 1, type: 'EVERY_RECEIPT', created_at: '2024-01-01T00:00:00Z', point_amount: 100, status: 'done' },
      ]);

      await service.getPointTotal(userId);
      await flush();

      expect(slackService.reports).toHaveLength(0);
    });

    it('balance가 last_id까지의 SUM과 일치하면 알림 없음', async () => {
      repository.setPointActions(userId, [
        { id: 1, type: 'EVERY_RECEIPT', created_at: '2024-01-01T00:00:00Z', point_amount: 100, status: 'done' },
        { id: 2, type: 'ATTENDANCE', created_at: '2024-01-02T00:00:00Z', point_amount: 50, status: 'done' },
      ]);
      repository.setBalance(userId, { totalPoint: 150, lastPointActionId: 2 });

      await service.getPointTotal(userId);
      await flush();

      expect(slackService.reports).toHaveLength(0);
    });

    it('balance가 last_id까지의 SUM보다 작으면 drift 알림', async () => {
      repository.setPointActions(userId, [
        { id: 1, type: 'EVERY_RECEIPT', created_at: '2024-01-01T00:00:00Z', point_amount: 100, status: 'done' },
        { id: 2, type: 'ATTENDANCE', created_at: '2024-01-02T00:00:00Z', point_amount: 50, status: 'done' },
      ]);
      repository.setBalance(userId, { totalPoint: 100, lastPointActionId: 2 });

      await service.getPointTotal(userId);
      await flush();

      expect(slackService.reports).toHaveLength(1);
      const msg = slackService.reports[0];
      expect(msg).toContain('drift 감지');
      expect(msg).toContain('balance: 100');
      expect(msg).toContain('expected (SUM up to last_id): 150');
      expect(msg).toContain('diff: -50');
    });

    it('balance.last_id보다 새로 들어온 액션은 검증에 영향 없음 (timing window 면역)', async () => {
      // 이 케이스가 핵심: balance.last_id=2까지만 비교하므로 id=3은 무시됨
      repository.setPointActions(userId, [
        { id: 1, type: 'EVERY_RECEIPT', created_at: '2024-01-01T00:00:00Z', point_amount: 100, status: 'done' },
        { id: 2, type: 'ATTENDANCE', created_at: '2024-01-02T00:00:00Z', point_amount: 50, status: 'done' },
        { id: 3, type: 'LOTTERY', created_at: '2024-01-03T00:00:00Z', point_amount: 5, status: 'done' }, // in-flight (balance가 아직 반영 안 함)
      ]);
      repository.setBalance(userId, { totalPoint: 150, lastPointActionId: 2 }); // last_id=2

      await service.getPointTotal(userId);
      await flush();

      // id=3은 검증 대상이 아니므로 알림 없어야 함
      expect(slackService.reports).toHaveLength(0);
    });

    it('검증이 응답을 차단하지 않음', async () => {
      repository.setPointActions(userId, [
        { id: 1, type: 'EVERY_RECEIPT', created_at: '2024-01-01T00:00:00Z', point_amount: 100, status: 'done' },
      ]);
      repository.setBalance(userId, { totalPoint: 999, lastPointActionId: 1 });

      const result = await service.getPointTotal(userId);

      // SUM 기반 totalPoint는 정상 반환 (검증과 무관)
      expect(result.totalPoint).toBe(100);
    });
  });
});
