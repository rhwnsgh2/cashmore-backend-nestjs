import { Inject, Injectable } from '@nestjs/common';
import type { ICalendarRepository } from './interfaces/calendar-repository.interface';
import { CALENDAR_REPOSITORY } from './interfaces/calendar-repository.interface';

export interface DayActivity {
  date: string;
  receipt_count: number;
  points: number;
}

export interface MonthlyCalendar {
  year_month: string;
  total_points: number;
  days: DayActivity[];
}

@Injectable()
export class CalendarService {
  constructor(
    @Inject(CALENDAR_REPOSITORY)
    private calendarRepository: ICalendarRepository,
  ) {}

  async getMonthlyCalendar(
    userId: string,
    yearMonth: string,
  ): Promise<MonthlyCalendar> {
    const [receiptCounts, pointSums] = await Promise.all([
      this.calendarRepository.findDailyReceiptCounts(userId, yearMonth),
      this.calendarRepository.findDailyPointSums(userId, yearMonth),
    ]);

    // 날짜별로 병합
    const dayMap = new Map<string, DayActivity>();

    for (const { date, count } of receiptCounts) {
      dayMap.set(date, { date, receipt_count: count, points: 0 });
    }

    for (const { date, points } of pointSums) {
      const existing = dayMap.get(date);
      if (existing) {
        existing.points = points;
      } else {
        dayMap.set(date, { date, receipt_count: 0, points });
      }
    }

    const days = Array.from(dayMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    const total_points = pointSums.reduce((sum, { points }) => sum + points, 0);

    return {
      year_month: yearMonth,
      total_points,
      days,
    };
  }
}
