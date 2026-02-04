import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import type { IWatchedAdRepository } from '../interfaces/watched-ad-repository.interface';

dayjs.extend(timezone);
dayjs.extend(utc);

export class StubWatchedAdRepository implements IWatchedAdRepository {
  private watchedStatus: Map<string, boolean> = new Map();

  private getWatchedAdKey(userId: string): string {
    const today = dayjs().tz('Asia/Seoul').format('YYYY-MM-DD');
    return `${userId}-${today}-watched-ad`;
  }

  async getWatchedAdStatus(userId: string): Promise<boolean> {
    const key = this.getWatchedAdKey(userId);
    return this.watchedStatus.get(key) || false;
  }

  async setWatchedAdStatus(userId: string): Promise<void> {
    const key = this.getWatchedAdKey(userId);
    this.watchedStatus.set(key, true);
  }

  // 테스트용 헬퍼 메서드
  setStatus(userId: string, watched: boolean): void {
    const key = this.getWatchedAdKey(userId);
    this.watchedStatus.set(key, watched);
  }

  clear(): void {
    this.watchedStatus.clear();
  }
}
