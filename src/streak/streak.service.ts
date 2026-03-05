import { Inject, Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import type {
  IStreakRepository,
  Streak,
} from './interfaces/streak-repository.interface';
import { STREAK_REPOSITORY } from './interfaces/streak-repository.interface';

const DEFAULT_DAYS = 90;

@Injectable()
export class StreakService {
  constructor(
    @Inject(STREAK_REPOSITORY)
    private streakRepository: IStreakRepository,
  ) {}

  async getAllStreaks(userId: string): Promise<Streak[]> {
    let days = DEFAULT_DAYS;
    let streaks = await this.streakRepository.findStreaks(userId, days);

    // 가장 오래된 스트릭이 조회 경계에 걸쳐있으면 범위를 늘려서 재조회
    while (streaks.length > 0 && this.hitsDateBoundary(streaks, days)) {
      days *= 2;
      streaks = await this.streakRepository.findStreaks(userId, days);
    }

    return streaks;
  }

  private hitsDateBoundary(streaks: Streak[], days: number): boolean {
    const oldest = streaks[streaks.length - 1];
    const boundary = dayjs().subtract(days, 'day').format('YYYY-MM-DD');
    return oldest.start_date <= boundary;
  }
}
