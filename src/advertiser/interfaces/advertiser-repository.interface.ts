export interface BannerAdDailyStat {
  ad_id: number;
  ad_title: string;
  stat_date: string;
  impressions: number;
  clicks: number;
}

export interface IAdvertiserRepository {
  findDailyStats(
    advertiserId: number,
    startDate: string,
    endDate: string,
  ): Promise<BannerAdDailyStat[]>;
}

export const ADVERTISER_REPOSITORY = Symbol('ADVERTISER_REPOSITORY');
