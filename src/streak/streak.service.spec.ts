import { Test, TestingModule } from '@nestjs/testing';
import dayjs from 'dayjs';
import { StreakService } from './streak.service';
import { STREAK_REPOSITORY } from './interfaces/streak-repository.interface';
import { StubStreakRepository } from './repositories/stub-streak.repository';

describe('StreakService', () => {
  let service: StreakService;
  let repository: StubStreakRepository;

  const userId = 'test-user-id';

  beforeEach(async () => {
    repository = new StubStreakRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StreakService,
        { provide: STREAK_REPOSITORY, useValue: repository },
      ],
    }).compile();

    service = module.get<StreakService>(StreakService);
  });

  afterEach(() => {
    repository.clear();
  });

  describe('getAllStreaks', () => {
    it('스트릭이 없으면 빈 배열을 반환한다', async () => {
      const streaks = await service.getAllStreaks(userId);
      expect(streaks).toEqual([]);
    });

    it('Repository에서 반환한 스트릭을 그대로 반환한다', async () => {
      repository.setStreaks(userId, [
        {
          start_date: '2026-01-19',
          end_date: '2026-01-20',
          continuous_count: 2,
        },
        {
          start_date: '2026-01-15',
          end_date: '2026-01-17',
          continuous_count: 3,
        },
      ]);

      const streaks = await service.getAllStreaks(userId);
      expect(streaks).toEqual([
        {
          start_date: '2026-01-19',
          end_date: '2026-01-20',
          continuous_count: 2,
        },
        {
          start_date: '2026-01-15',
          end_date: '2026-01-17',
          continuous_count: 3,
        },
      ]);
    });

    it('경계에 걸치지 않는 스트릭은 그대로 반환한다', async () => {
      const recentDate = dayjs().subtract(10, 'day').format('YYYY-MM-DD');
      repository.setStreaks(userId, [
        {
          start_date: recentDate,
          end_date: dayjs().format('YYYY-MM-DD'),
          continuous_count: 10,
        },
      ]);

      const streaks = await service.getAllStreaks(userId);
      expect(streaks).toHaveLength(1);
      expect(streaks[0].continuous_count).toBe(10);
    });
  });
});
