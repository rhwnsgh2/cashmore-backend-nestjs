import { Injectable } from '@nestjs/common';
import { Redis } from '@upstash/redis';
import type {
  IDeeplinkRepository,
  DeeplinkClickData,
} from '../interfaces/deeplink-repository.interface';

const TTL_SECONDS = 600; // 10분

@Injectable()
export class UpstashDeeplinkRepository implements IDeeplinkRepository {
  private redis: Redis;

  constructor() {
    this.redis = Redis.fromEnv();
  }

  private getKey(fingerprint: string): string {
    return `deeplink:${fingerprint}`;
  }

  async saveClick(
    fingerprint: string,
    data: DeeplinkClickData,
  ): Promise<void> {
    const key = this.getKey(fingerprint);
    await this.redis.set(key, JSON.stringify(data), { ex: TTL_SECONDS });
  }

  async findAndDeleteByFingerprint(
    fingerprint: string,
  ): Promise<DeeplinkClickData | null> {
    const key = this.getKey(fingerprint);
    const raw = await this.redis.getdel<DeeplinkClickData>(key);
    if (!raw) return null;

    return raw;
  }
}
