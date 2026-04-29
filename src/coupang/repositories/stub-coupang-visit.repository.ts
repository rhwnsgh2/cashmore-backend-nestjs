import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import type {
  ICoupangVisitRepository,
  CoupangVisitRecord,
  CoupangVisitDomainRecord,
} from '../interfaces/coupang-visit-repository.interface';
import type { StubPointWriteRepository } from '../../point-write/repositories/stub-point-write.repository';

dayjs.extend(utc);
dayjs.extend(timezone);

export class StubCoupangVisitRepository implements ICoupangVisitRepository {
  private visits: CoupangVisitDomainRecord[] = [];
  private nextId = 1;

  constructor(private pointWriteRepository: StubPointWriteRepository) {}

  getInsertedVisits(): CoupangVisitDomainRecord[] {
    return [...this.visits];
  }

  clear(): void {
    this.visits = [];
    this.nextId = 1;
  }

  async findTodayVisit(userId: string): Promise<CoupangVisitRecord | null> {
    const todayStart = dayjs().tz('Asia/Seoul').startOf('day');
    const todayEnd = dayjs().tz('Asia/Seoul').endOf('day');
    const now = dayjs();

    const action = this.pointWriteRepository
      .getInsertedActions()
      .find(
        (a) =>
          a.userId === userId &&
          a.type === 'COUPANG_VISIT' &&
          now.isAfter(todayStart) &&
          now.isBefore(todayEnd),
      );

    if (!action) {
      return null;
    }

    return {
      id: action.id,
      userId: action.userId,
      pointAmount: action.amount,
      createdAt: now.toISOString(),
    };
  }

  async findByUserIdAndDate(
    userId: string,
    date: string,
  ): Promise<CoupangVisitDomainRecord | null> {
    const found = this.visits.find(
      (v) => v.userId === userId && v.createdAtDate === date,
    );
    return found ?? null;
  }

  async insertVisit(
    userId: string,
    date: string,
    pointAmount: number,
  ): Promise<CoupangVisitDomainRecord> {
    const exists = this.visits.find(
      (v) => v.userId === userId && v.createdAtDate === date,
    );
    if (exists) {
      throw new Error('duplicate key value violates unique constraint');
    }

    const visit: CoupangVisitDomainRecord = {
      id: this.nextId++,
      userId,
      createdAtDate: date,
      pointAmount,
      createdAt: new Date().toISOString(),
    };
    this.visits.push(visit);
    return visit;
  }
}
