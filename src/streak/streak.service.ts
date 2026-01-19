import { Inject, Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import type {
  IStreakRepository,
  Streak,
} from './interfaces/streak-repository.interface';
import { STREAK_REPOSITORY } from './interfaces/streak-repository.interface';

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = 'Asia/Seoul';

@Injectable()
export class StreakService {
  constructor(
    @Inject(STREAK_REPOSITORY)
    private streakRepository: IStreakRepository,
  ) {}

  async getAllStreaks(userId: string): Promise<Streak[]> {
    const submissions =
      await this.streakRepository.findReceiptSubmissions(userId);

    if (submissions.length === 0) {
      return [];
    }

    // 제출 날짜들을 서울 시간 기준 YYYY-MM-DD로 변환하고 중복 제거 후 최신순 정렬
    const submissionDates = [
      ...new Set(
        submissions.map((s) =>
          dayjs(s.created_at).tz(TIMEZONE).format('YYYY-MM-DD'),
        ),
      ),
    ].sort((a, b) => b.localeCompare(a));

    const streaks: Streak[] = [];
    let i = 0;

    while (i < submissionDates.length) {
      const endDate = submissionDates[i];
      let startDate = endDate;
      let continuousCount = 1;

      // 연속 구간 찾기
      while (i + 1 < submissionDates.length) {
        const currentDate = dayjs(submissionDates[i]).tz(TIMEZONE);
        const expectedPrevDate = currentDate
          .subtract(1, 'day')
          .format('YYYY-MM-DD');

        if (submissionDates[i + 1] === expectedPrevDate) {
          continuousCount++;
          startDate = expectedPrevDate;
          i++;
        } else {
          break;
        }
      }

      streaks.push({
        start_date: startDate,
        end_date: endDate,
        continuous_count: continuousCount,
      });

      i++;
    }

    return streaks;
  }
}
