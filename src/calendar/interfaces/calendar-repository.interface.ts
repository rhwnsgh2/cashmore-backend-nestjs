export interface DailyReceiptCount {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface DailyPointSum {
  date: string; // YYYY-MM-DD
  points: number;
}

export interface ICalendarRepository {
  findDailyReceiptCounts(
    userId: string,
    yearMonth: string,
  ): Promise<DailyReceiptCount[]>;

  findDailyPointSums(
    userId: string,
    yearMonth: string,
  ): Promise<DailyPointSum[]>;
}

export const CALENDAR_REPOSITORY = Symbol('CALENDAR_REPOSITORY');
