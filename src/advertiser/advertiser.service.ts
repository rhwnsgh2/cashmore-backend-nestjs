import { Inject, Injectable } from '@nestjs/common';
import type { IAdvertiserRepository } from './interfaces/advertiser-repository.interface';
import { ADVERTISER_REPOSITORY } from './interfaces/advertiser-repository.interface';
import type { AdDailyStatDto } from './dto/advertiser-stats.dto';

@Injectable()
export class AdvertiserService {
  constructor(
    @Inject(ADVERTISER_REPOSITORY)
    private advertiserRepository: IAdvertiserRepository,
  ) {}

  async getStats(
    advertiserId: number,
    startDate?: string,
    endDate?: string,
  ): Promise<{ stats: AdDailyStatDto[] }> {
    const end = endDate || new Date().toISOString().slice(0, 10);
    const start =
      startDate ||
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);

    const dailyStats = await this.advertiserRepository.findDailyStats(
      advertiserId,
      start,
      end,
    );

    const stats: AdDailyStatDto[] = dailyStats.map((stat) => ({
      adId: stat.ad_id,
      adTitle: stat.ad_title,
      date: stat.stat_date,
      impressions: stat.impressions,
      clicks: stat.clicks,
      ctr:
        stat.impressions > 0
          ? Math.round((stat.clicks / stat.impressions) * 10000) / 100
          : 0,
    }));

    return { stats };
  }
}
