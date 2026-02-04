import { Inject, Injectable } from '@nestjs/common';
import type { IWatchedAdRepository } from './interfaces/watched-ad-repository.interface';
import { WATCHED_AD_REPOSITORY } from './interfaces/watched-ad-repository.interface';

@Injectable()
export class WatchedAdService {
  constructor(
    @Inject(WATCHED_AD_REPOSITORY)
    private watchedAdRepository: IWatchedAdRepository,
  ) {}

  async getWatchedAdStatus(userId: string): Promise<boolean> {
    return this.watchedAdRepository.getWatchedAdStatus(userId);
  }

  async setWatchedAdStatus(userId: string): Promise<{ success: boolean }> {
    await this.watchedAdRepository.setWatchedAdStatus(userId);
    return { success: true };
  }
}
