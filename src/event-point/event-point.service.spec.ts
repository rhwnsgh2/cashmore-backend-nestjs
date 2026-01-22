import { Test, TestingModule } from '@nestjs/testing';
import { EventPointService } from './event-point.service';
import { EVENT_POINT_REPOSITORY } from './interfaces/event-point-repository.interface';
import { StubEventPointRepository } from './repositories/stub-event-point.repository';

describe('EventPointService', () => {
  let service: EventPointService;
  let repository: StubEventPointRepository;

  const userId = 'test-user-id';

  beforeEach(async () => {
    repository = new StubEventPointRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventPointService,
        { provide: EVENT_POINT_REPOSITORY, useValue: repository },
      ],
    }).compile();

    service = module.get<EventPointService>(EventPointService);
  });

  afterEach(() => {
    repository.clear();
  });

  describe('getEventPoints', () => {
    it('이벤트 포인트가 없으면 빈 배열을 반환한다', async () => {
      const result = await service.getEventPoints(userId);

      expect(result).toEqual([]);
    });

    it('이벤트 포인트 목록을 반환한다', async () => {
      repository.setEventPoints(userId, [
        {
          id: 1,
          type: 'COUPANG_VISIT',
          createdAt: '2026-01-15T10:00:00+09:00',
          point: 100,
        },
        {
          id: 2,
          type: 'LOTTERY',
          createdAt: '2026-01-14T10:00:00+09:00',
          point: 50,
        },
      ]);

      const result = await service.getEventPoints(userId);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
    });

    it('이벤트 포인트를 최신순으로 정렬하여 반환한다', async () => {
      repository.setEventPoints(userId, [
        {
          id: 1,
          type: 'COUPANG_VISIT',
          createdAt: '2026-01-10T10:00:00+09:00',
          point: 100,
        },
        {
          id: 2,
          type: 'LOTTERY',
          createdAt: '2026-01-15T10:00:00+09:00',
          point: 50,
        },
      ]);

      const result = await service.getEventPoints(userId);

      expect(result[0].id).toBe(2);
      expect(result[1].id).toBe(1);
    });

    it('COUPANG_VISIT 타입을 포함한다', async () => {
      repository.setEventPoints(userId, [
        {
          id: 1,
          type: 'COUPANG_VISIT',
          createdAt: '2026-01-15T10:00:00+09:00',
          point: 100,
        },
      ]);

      const result = await service.getEventPoints(userId);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('COUPANG_VISIT');
    });

    it('ONBOARDING_EVENT 타입을 포함한다', async () => {
      repository.setEventPoints(userId, [
        {
          id: 1,
          type: 'ONBOARDING_EVENT',
          createdAt: '2026-01-15T10:00:00+09:00',
          point: 200,
        },
      ]);

      const result = await service.getEventPoints(userId);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('ONBOARDING_EVENT');
    });

    it('AFFILIATE 타입을 포함한다', async () => {
      repository.setEventPoints(userId, [
        {
          id: 1,
          type: 'AFFILIATE',
          createdAt: '2026-01-15T10:00:00+09:00',
          point: 150,
        },
      ]);

      const result = await service.getEventPoints(userId);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('AFFILIATE');
    });

    it('LOTTERY 타입을 포함한다', async () => {
      repository.setEventPoints(userId, [
        {
          id: 1,
          type: 'LOTTERY',
          createdAt: '2026-01-15T10:00:00+09:00',
          point: 500,
        },
      ]);

      const result = await service.getEventPoints(userId);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('LOTTERY');
    });

    it('다른 사용자의 이벤트 포인트는 포함하지 않는다', async () => {
      const otherUserId = 'other-user-id';

      repository.setEventPoints(userId, [
        {
          id: 1,
          type: 'COUPANG_VISIT',
          createdAt: '2026-01-15T10:00:00+09:00',
          point: 100,
        },
      ]);

      repository.setEventPoints(otherUserId, [
        {
          id: 2,
          type: 'LOTTERY',
          createdAt: '2026-01-15T10:00:00+09:00',
          point: 500,
        },
      ]);

      const result = await service.getEventPoints(userId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });
  });
});
