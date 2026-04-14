import { Test, TestingModule } from '@nestjs/testing';
import { PointWriteService } from './point-write.service';
import { POINT_WRITE_REPOSITORY } from './point-write-repository.interface';
import { StubPointWriteRepository } from './repositories/stub-point-write.repository';
import { SlackService } from '../slack/slack.service';

class StubSlackService {
  reports: string[] = [];

  reportBugToSlack(content: string): Promise<void> {
    this.reports.push(content);
    return Promise.resolve();
  }
}

describe('PointWriteService', () => {
  let service: PointWriteService;
  let repository: StubPointWriteRepository;
  let slackService: StubSlackService;

  beforeEach(async () => {
    repository = new StubPointWriteRepository();
    slackService = new StubSlackService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PointWriteService,
        { provide: POINT_WRITE_REPOSITORY, useValue: repository },
        { provide: SlackService, useValue: slackService },
      ],
    }).compile();

    service = module.get<PointWriteService>(PointWriteService);
  });

  afterEach(() => {
    repository.clear();
  });

  describe('addPoint', () => {
    it('포인트 액션을 삽입하고 id를 반환한다', async () => {
      const result = await service.addPoint({
        userId: 'user-1',
        amount: 100,
        type: 'ATTENDANCE',
      });

      expect(result).toEqual({ id: 1 });

      const actions = repository.getInsertedActions();
      expect(actions).toHaveLength(1);
      expect(actions[0]).toEqual({
        id: 1,
        userId: 'user-1',
        amount: 100,
        type: 'ATTENDANCE',
        status: 'done',
        additionalData: {},
      });
    });

    it('status 기본값은 done이다', async () => {
      await service.addPoint({
        userId: 'user-1',
        amount: 50,
        type: 'LOTTERY',
      });

      const actions = repository.getInsertedActions();
      expect(actions[0].status).toBe('done');
    });

    it('status를 명시적으로 지정할 수 있다', async () => {
      await service.addPoint({
        userId: 'user-1',
        amount: -500,
        type: 'EXCHANGE_POINT_TO_NAVERPAY',
        status: 'pending',
      });

      const actions = repository.getInsertedActions();
      expect(actions[0].status).toBe('pending');
    });

    it('additionalData를 전달할 수 있다', async () => {
      await service.addPoint({
        userId: 'user-1',
        amount: 2,
        type: 'ATTENDANCE',
        additionalData: { attendance_id: 42 },
      });

      const actions = repository.getInsertedActions();
      expect(actions[0].additionalData).toEqual({ attendance_id: 42 });
    });

    it('additionalData 기본값은 빈 객체다', async () => {
      await service.addPoint({
        userId: 'user-1',
        amount: 2,
        type: 'ATTENDANCE',
      });

      const actions = repository.getInsertedActions();
      expect(actions[0].additionalData).toEqual({});
    });

    it('음수 금액(차감)을 처리할 수 있다', async () => {
      await service.addPoint({
        userId: 'user-1',
        amount: -1000,
        type: 'EXCHANGE_POINT_TO_NAVERPAY',
      });

      const actions = repository.getInsertedActions();
      expect(actions[0].amount).toBe(-1000);
    });

    it('여러 번 호출 시 각각 별도의 id가 부여된다', async () => {
      const result1 = await service.addPoint({
        userId: 'user-1',
        amount: 100,
        type: 'ATTENDANCE',
      });
      const result2 = await service.addPoint({
        userId: 'user-1',
        amount: 5,
        type: 'WEEKLY_ATTENDANCE_BONUS',
      });

      expect(result1.id).toBe(1);
      expect(result2.id).toBe(2);
      expect(repository.getInsertedActions()).toHaveLength(2);
    });

    it('서로 다른 유저의 포인트를 각각 기록한다', async () => {
      await service.addPoint({
        userId: 'user-1',
        amount: 100,
        type: 'ATTENDANCE',
      });
      await service.addPoint({
        userId: 'user-2',
        amount: 200,
        type: 'LOTTERY',
      });

      const actions = repository.getInsertedActions();
      expect(actions).toHaveLength(2);
      expect(actions[0].userId).toBe('user-1');
      expect(actions[1].userId).toBe('user-2');
    });
  });

  describe('addPoint - balance 갱신', () => {
    it('첫 적립 시 balance row가 생성된다', async () => {
      await service.addPoint({
        userId: 'user-1',
        amount: 100,
        type: 'ATTENDANCE',
      });

      const balance = repository.getBalance('user-1');
      expect(balance).toBeDefined();
      expect(balance!.totalPoint).toBe(100);
      expect(balance!.lastPointActionId).toBe(1);
    });

    it('두 번째 적립부터는 atomic increment된다', async () => {
      await service.addPoint({
        userId: 'user-1',
        amount: 100,
        type: 'ATTENDANCE',
      });
      await service.addPoint({
        userId: 'user-1',
        amount: 50,
        type: 'LOTTERY',
      });

      const balance = repository.getBalance('user-1');
      expect(balance!.totalPoint).toBe(150);
      expect(balance!.lastPointActionId).toBe(2);
    });

    it('음수 delta(차감)도 정확히 반영된다', async () => {
      await service.addPoint({
        userId: 'user-1',
        amount: 1000,
        type: 'ATTENDANCE',
      });
      await service.addPoint({
        userId: 'user-1',
        amount: -300,
        type: 'EXCHANGE_POINT_TO_NAVERPAY',
      });

      const balance = repository.getBalance('user-1');
      expect(balance!.totalPoint).toBe(700);
    });

    it('서로 다른 유저의 balance는 독립적이다', async () => {
      await service.addPoint({
        userId: 'user-1',
        amount: 100,
        type: 'ATTENDANCE',
      });
      await service.addPoint({
        userId: 'user-2',
        amount: 200,
        type: 'LOTTERY',
      });

      expect(repository.getBalance('user-1')!.totalPoint).toBe(100);
      expect(repository.getBalance('user-2')!.totalPoint).toBe(200);
    });

    it('balance 갱신 실패 시에도 addPoint는 정상 반환된다', async () => {
      const originalUpsert = repository.upsertBalance.bind(repository);
      repository.upsertBalance = () =>
        Promise.reject(new Error('DB connection lost'));

      const result = await service.addPoint({
        userId: 'user-1',
        amount: 100,
        type: 'ATTENDANCE',
      });

      // point_action은 정상 insert
      expect(result).toEqual({ id: 1 });
      expect(repository.getInsertedActions()).toHaveLength(1);

      repository.upsertBalance = originalUpsert;
    });

    it('balance 갱신 실패 시 Slack에 알림이 전송된다', async () => {
      repository.upsertBalance = () =>
        Promise.reject(new Error('connection timeout'));

      await service.addPoint({
        userId: 'user-1',
        amount: 100,
        type: 'ATTENDANCE',
      });

      expect(slackService.reports).toHaveLength(1);
      expect(slackService.reports[0]).toContain('user_point_balance 갱신 실패');
      expect(slackService.reports[0]).toContain('user-1');
      expect(slackService.reports[0]).toContain('ATTENDANCE');
      expect(slackService.reports[0]).toContain('connection timeout');
    });

    it('balance 정상 갱신 시 Slack 알림은 가지 않는다', async () => {
      await service.addPoint({
        userId: 'user-1',
        amount: 100,
        type: 'ATTENDANCE',
      });

      expect(slackService.reports).toHaveLength(0);
    });
  });
});
