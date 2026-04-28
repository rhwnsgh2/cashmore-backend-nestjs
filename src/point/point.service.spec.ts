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

    it('RPC SUM으로 총 포인트를 계산한다', async () => {
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

    it('balance가 일치하면 Slack 알림을 보내지 않는다', async () => {
      repository.setPointActions(userId, [
        {
          id: 1,
          type: 'EVERY_RECEIPT',
          created_at: '2024-01-01',
          point_amount: 500,
          status: 'done',
        },
      ]);
      await repository.saveBalance(userId, 500);

      await service.getPointTotal(userId);
      await new Promise((resolve) => setImmediate(resolve));

      expect(slackService.reports).toHaveLength(0);
    });

    it('balance가 다르면 Slack에 drift 알림을 보낸다', async () => {
      repository.setPointActions(userId, [
        {
          id: 1,
          type: 'EVERY_RECEIPT',
          created_at: '2024-01-01',
          point_amount: 1000,
          status: 'done',
        },
      ]);
      // cached는 800인데 실제 SUM은 1000 → 200 drift
      await repository.saveBalance(userId, 800);

      await service.getPointTotal(userId);
      await new Promise((resolve) => setImmediate(resolve));

      expect(slackService.reports).toHaveLength(1);
      expect(slackService.reports[0]).toContain('drift');
      expect(slackService.reports[0]).toContain(userId);
      expect(slackService.reports[0]).toContain('cached: 800');
      expect(slackService.reports[0]).toContain('expected: 1000');
      expect(slackService.reports[0]).toContain('diff: 200');
    });

    it('expected=0이고 balance row가 없으면 알림 없이 종료한다', async () => {
      // point_actions 없음, balance row 없음 → expected=0=cached, 일치
      await service.getPointTotal(userId);
      await new Promise((resolve) => setImmediate(resolve));

      expect(slackService.reports).toHaveLength(0);
    });

    it('balance row가 없는데 expected > 0이면 의심 신호로 Slack 알림을 보낸다', async () => {
      repository.setPointActions(userId, [
        {
          id: 1,
          type: 'EVERY_RECEIPT',
          created_at: '2024-01-01',
          point_amount: 700,
          status: 'done',
        },
      ]);
      // balance row 없음, expected=700

      await service.getPointTotal(userId);
      await new Promise((resolve) => setImmediate(resolve));

      expect(slackService.reports).toHaveLength(1);
      expect(slackService.reports[0]).toContain('drift');
      expect(slackService.reports[0]).toContain('cached: (no row)');
      expect(slackService.reports[0]).toContain('expected: 700');
      expect(slackService.reports[0]).toContain('diff: 700');
    });

    it('findBalance가 실패해도 응답은 정상 반환된다', async () => {
      repository.setPointActions(userId, [
        {
          id: 1,
          type: 'EVERY_RECEIPT',
          created_at: '2024-01-01',
          point_amount: 300,
          status: 'done',
        },
      ]);
      repository.findBalance = () =>
        Promise.reject(new Error('balance read failed'));

      const result = await service.getPointTotal(userId);

      expect(result.totalPoint).toBe(300);
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
});
