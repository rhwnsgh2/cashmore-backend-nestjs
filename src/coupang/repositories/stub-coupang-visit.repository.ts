import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import type {
  ICoupangVisitRepository,
  CoupangVisitRecord,
} from '../interfaces/coupang-visit-repository.interface';
import type { StubPointWriteRepository } from '../../point-write/repositories/stub-point-write.repository';

dayjs.extend(utc);
dayjs.extend(timezone);

export class StubCoupangVisitRepository implements ICoupangVisitRepository {
  constructor(private pointWriteRepository: StubPointWriteRepository) {}

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
}
