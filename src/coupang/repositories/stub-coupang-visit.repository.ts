import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import type {
  ICoupangVisitRepository,
  CoupangVisitRecord,
} from '../interfaces/coupang-visit-repository.interface';

dayjs.extend(utc);
dayjs.extend(timezone);

export class StubCoupangVisitRepository implements ICoupangVisitRepository {
  private visits: CoupangVisitRecord[] = [];
  private nextId = 1;

  setVisits(visits: CoupangVisitRecord[]): void {
    this.visits = [...visits];
  }

  clear(): void {
    this.visits = [];
    this.nextId = 1;
  }

  async findTodayVisit(userId: string): Promise<CoupangVisitRecord | null> {
    const todayStart = dayjs().tz('Asia/Seoul').startOf('day');
    const todayEnd = dayjs().tz('Asia/Seoul').endOf('day');

    const visit = this.visits.find((v) => {
      const createdAt = dayjs(v.createdAt);
      return (
        v.userId === userId &&
        createdAt.isAfter(todayStart) &&
        createdAt.isBefore(todayEnd)
      );
    });

    return visit ?? null;
  }

  async createVisit(userId: string, pointAmount: number): Promise<void> {
    this.visits.push({
      id: this.nextId++,
      userId,
      pointAmount,
      createdAt: new Date().toISOString(),
    });
  }
}
