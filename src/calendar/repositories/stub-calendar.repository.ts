import {
  ICalendarRepository,
  DailyReceiptCount,
  DailyPointSum,
} from '../interfaces/calendar-repository.interface';

export class StubCalendarRepository implements ICalendarRepository {
  private receiptCounts = new Map<string, DailyReceiptCount[]>();
  private pointSums = new Map<string, DailyPointSum[]>();

  setReceiptCounts(
    userId: string,
    yearMonth: string,
    counts: DailyReceiptCount[],
  ): void {
    this.receiptCounts.set(`${userId}:${yearMonth}`, counts);
  }

  setPointSums(userId: string, yearMonth: string, sums: DailyPointSum[]): void {
    this.pointSums.set(`${userId}:${yearMonth}`, sums);
  }

  clear(): void {
    this.receiptCounts.clear();
    this.pointSums.clear();
  }

  findDailyReceiptCounts(
    userId: string,
    yearMonth: string,
  ): Promise<DailyReceiptCount[]> {
    return Promise.resolve(
      this.receiptCounts.get(`${userId}:${yearMonth}`) || [],
    );
  }

  findDailyPointSums(
    userId: string,
    yearMonth: string,
  ): Promise<DailyPointSum[]> {
    return Promise.resolve(this.pointSums.get(`${userId}:${yearMonth}`) || []);
  }
}
