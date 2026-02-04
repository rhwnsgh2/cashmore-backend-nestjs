import { Injectable } from '@nestjs/common';
import { Redis } from '@upstash/redis';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import type { IWatchedAdRepository } from '../interfaces/watched-ad-repository.interface';

dayjs.extend(timezone);
dayjs.extend(utc);

@Injectable()
export class UpstashWatchedAdRepository implements IWatchedAdRepository {
  private redis: Redis;

  constructor() {
    this.redis = Redis.fromEnv();
  }

  private getWatchedAdKey(userId: string): string {
    const today = dayjs().tz('Asia/Seoul').format('YYYY-MM-DD');
    return `${userId}-${today}-watched-ad`;
  }

  async getWatchedAdStatus(userId: string): Promise<boolean> {
    const key = this.getWatchedAdKey(userId);
    const result = await this.redis.get<boolean>(key);
    return result || false;
  }

  async setWatchedAdStatus(userId: string): Promise<void> {
    const key = this.getWatchedAdKey(userId);
    await this.redis.set(key, true, { ex: 24 * 60 * 60 }); // 24시간 후 만료
  }
}
