import { Test, TestingModule } from '@nestjs/testing';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { StreakService } from './streak.service';
import { STREAK_REPOSITORY } from './interfaces/streak-repository.interface';
import { StubStreakRepository } from './repositories/stub-streak.repository';

dayjs.extend(utc);
dayjs.extend(timezone);

describe('StreakService', () => {
  let service: StreakService;
  let repository: StubStreakRepository;

  const userId = 'test-user-id';

  const createSubmission = (id: string, date: string) => ({
    id,
    user_id: userId,
    created_at: `${date}T12:00:00+09:00`,
  });

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
    it('제출 기록이 없으면 빈 배열을 반환한다', async () => {
      const streaks = await service.getAllStreaks(userId);
      expect(streaks).toEqual([]);
    });

    it('하루만 제출하면 1일짜리 스트릭 1개', async () => {
      repository.setSubmissions(userId, [createSubmission('1', '2026-01-15')]);

      const streaks = await service.getAllStreaks(userId);
      expect(streaks).toEqual([
        {
          start_date: '2026-01-15',
          end_date: '2026-01-15',
          continuous_count: 1,
        },
      ]);
    });

    it('연속 3일 제출하면 3일짜리 스트릭 1개', async () => {
      repository.setSubmissions(userId, [
        createSubmission('1', '2026-01-17'),
        createSubmission('2', '2026-01-16'),
        createSubmission('3', '2026-01-15'),
      ]);

      const streaks = await service.getAllStreaks(userId);
      expect(streaks).toEqual([
        {
          start_date: '2026-01-15',
          end_date: '2026-01-17',
          continuous_count: 3,
        },
      ]);
    });

    it('중간에 끊긴 경우 스트릭 2개로 분리', async () => {
      repository.setSubmissions(userId, [
        createSubmission('1', '2026-01-20'),
        createSubmission('2', '2026-01-19'),
        // 1월 18일 빠짐
        createSubmission('3', '2026-01-17'),
        createSubmission('4', '2026-01-16'),
        createSubmission('5', '2026-01-15'),
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

    it('띄엄띄엄 제출하면 1일짜리 스트릭 여러 개', async () => {
      repository.setSubmissions(userId, [
        createSubmission('1', '2026-01-20'),
        createSubmission('2', '2026-01-15'),
        createSubmission('3', '2026-01-10'),
      ]);

      const streaks = await service.getAllStreaks(userId);
      expect(streaks).toEqual([
        {
          start_date: '2026-01-20',
          end_date: '2026-01-20',
          continuous_count: 1,
        },
        {
          start_date: '2026-01-15',
          end_date: '2026-01-15',
          continuous_count: 1,
        },
        {
          start_date: '2026-01-10',
          end_date: '2026-01-10',
          continuous_count: 1,
        },
      ]);
    });

    it('하루에 여러 번 제출해도 1일로 계산', async () => {
      repository.setSubmissions(userId, [
        { id: '1', user_id: userId, created_at: '2026-01-15T09:00:00+09:00' },
        { id: '2', user_id: userId, created_at: '2026-01-15T12:00:00+09:00' },
        { id: '3', user_id: userId, created_at: '2026-01-15T18:00:00+09:00' },
      ]);

      const streaks = await service.getAllStreaks(userId);
      expect(streaks).toEqual([
        {
          start_date: '2026-01-15',
          end_date: '2026-01-15',
          continuous_count: 1,
        },
      ]);
    });

    it('최신순으로 정렬되어 반환된다', async () => {
      repository.setSubmissions(userId, [
        createSubmission('1', '2026-01-05'),
        createSubmission('2', '2026-01-20'),
        createSubmission('3', '2026-01-10'),
      ]);

      const streaks = await service.getAllStreaks(userId);
      expect(streaks[0].end_date).toBe('2026-01-20');
      expect(streaks[1].end_date).toBe('2026-01-10');
      expect(streaks[2].end_date).toBe('2026-01-05');
    });

    describe('타임존 경계 케이스', () => {
      it('한국시간 23:59에 제출해도 해당 날짜로 인정된다', async () => {
        repository.setSubmissions(userId, [
          { id: '1', user_id: userId, created_at: '2026-01-15T23:59:00+09:00' },
        ]);

        const streaks = await service.getAllStreaks(userId);
        expect(streaks).toEqual([
          {
            start_date: '2026-01-15',
            end_date: '2026-01-15',
            continuous_count: 1,
          },
        ]);
      });

      it('한국시간 00:01에 제출해도 해당 날짜로 인정된다', async () => {
        repository.setSubmissions(userId, [
          { id: '1', user_id: userId, created_at: '2026-01-15T00:01:00+09:00' },
        ]);

        const streaks = await service.getAllStreaks(userId);
        expect(streaks).toEqual([
          {
            start_date: '2026-01-15',
            end_date: '2026-01-15',
            continuous_count: 1,
          },
        ]);
      });

      it('UTC 14:59 (한국시간 23:59)는 한국 날짜로 계산된다', async () => {
        // UTC 14:59 = KST 23:59 (같은 날 1/15)
        repository.setSubmissions(userId, [
          { id: '1', user_id: userId, created_at: '2026-01-15T14:59:00Z' },
        ]);

        const streaks = await service.getAllStreaks(userId);
        expect(streaks).toEqual([
          {
            start_date: '2026-01-15',
            end_date: '2026-01-15',
            continuous_count: 1,
          },
        ]);
      });

      it('UTC 15:00 (한국시간 다음날 00:00)는 다음 날짜로 계산된다', async () => {
        // UTC 15:00 on 1/14 = KST 00:00 on 1/15
        repository.setSubmissions(userId, [
          { id: '1', user_id: userId, created_at: '2026-01-14T15:00:00Z' },
        ]);

        const streaks = await service.getAllStreaks(userId);
        expect(streaks).toEqual([
          {
            start_date: '2026-01-15',
            end_date: '2026-01-15',
            continuous_count: 1,
          },
        ]);
      });

      it('연속 이틀 제출 시 자정 전후로 제출해도 연속으로 인정된다', async () => {
        repository.setSubmissions(userId, [
          // 1/16 새벽 1시에 제출
          { id: '1', user_id: userId, created_at: '2026-01-16T01:00:00+09:00' },
          // 1/15 밤 11시에 제출
          { id: '2', user_id: userId, created_at: '2026-01-15T23:00:00+09:00' },
        ]);

        const streaks = await service.getAllStreaks(userId);
        expect(streaks).toEqual([
          {
            start_date: '2026-01-15',
            end_date: '2026-01-16',
            continuous_count: 2,
          },
        ]);
      });
    });
  });
});
