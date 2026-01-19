import { Test, TestingModule } from '@nestjs/testing';
import { CalendarService } from './calendar.service';
import { CALENDAR_REPOSITORY } from './interfaces/calendar-repository.interface';
import { StubCalendarRepository } from './repositories/stub-calendar.repository';

describe('CalendarService', () => {
  let service: CalendarService;
  let repository: StubCalendarRepository;

  const userId = 'test-user-id';
  const yearMonth = '2026-01';

  beforeEach(async () => {
    repository = new StubCalendarRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarService,
        { provide: CALENDAR_REPOSITORY, useValue: repository },
      ],
    }).compile();

    service = module.get<CalendarService>(CalendarService);
  });

  afterEach(() => {
    repository.clear();
  });

  describe('getMonthlyCalendar', () => {
    it('활동이 없으면 빈 days 배열과 0 포인트를 반환한다', async () => {
      const result = await service.getMonthlyCalendar(userId, yearMonth);

      expect(result).toEqual({
        year_month: '2026-01',
        total_points: 0,
        days: [],
      });
    });

    it('영수증 제출만 있는 날은 points가 0이다', async () => {
      repository.setReceiptCounts(userId, yearMonth, [
        { date: '2026-01-15', count: 2 },
      ]);

      const result = await service.getMonthlyCalendar(userId, yearMonth);

      expect(result.days).toEqual([
        { date: '2026-01-15', receipt_count: 2, points: 0 },
      ]);
    });

    it('포인트 획득만 있는 날은 receipt_count가 0이다', async () => {
      repository.setPointSums(userId, yearMonth, [
        { date: '2026-01-15', points: 500 },
      ]);

      const result = await service.getMonthlyCalendar(userId, yearMonth);

      expect(result.days).toEqual([
        { date: '2026-01-15', receipt_count: 0, points: 500 },
      ]);
    });

    it('영수증과 포인트가 같은 날에 있으면 병합된다', async () => {
      repository.setReceiptCounts(userId, yearMonth, [
        { date: '2026-01-15', count: 2 },
      ]);
      repository.setPointSums(userId, yearMonth, [
        { date: '2026-01-15', points: 500 },
      ]);

      const result = await service.getMonthlyCalendar(userId, yearMonth);

      expect(result.days).toEqual([
        { date: '2026-01-15', receipt_count: 2, points: 500 },
      ]);
    });

    it('여러 날의 데이터를 날짜순으로 정렬한다', async () => {
      repository.setReceiptCounts(userId, yearMonth, [
        { date: '2026-01-20', count: 1 },
        { date: '2026-01-15', count: 2 },
      ]);
      repository.setPointSums(userId, yearMonth, [
        { date: '2026-01-17', points: 300 },
        { date: '2026-01-15', points: 500 },
      ]);

      const result = await service.getMonthlyCalendar(userId, yearMonth);

      expect(result.days).toHaveLength(3);
      expect(result.days[0].date).toBe('2026-01-15');
      expect(result.days[1].date).toBe('2026-01-17');
      expect(result.days[2].date).toBe('2026-01-20');
    });

    it('total_points는 해당 월 포인트 합계이다', async () => {
      repository.setPointSums(userId, yearMonth, [
        { date: '2026-01-15', points: 500 },
        { date: '2026-01-17', points: 300 },
        { date: '2026-01-20', points: 200 },
      ]);

      const result = await service.getMonthlyCalendar(userId, yearMonth);

      expect(result.total_points).toBe(1000);
    });

    it('year_month는 요청한 값 그대로 반환된다', async () => {
      const result = await service.getMonthlyCalendar(userId, '2025-12');

      expect(result.year_month).toBe('2025-12');
    });
  });
});
