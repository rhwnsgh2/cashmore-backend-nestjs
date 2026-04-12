export interface BannerAdDailyStat {
  ad_id: number;
  ad_title: string;
  stat_date: string;
  impressions: number;
  clicks: number;
}

export interface AdvertiserBanner {
  id: number;
  title: string;
  image_url: string;
  click_url: string;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
}

export interface IAdvertiserRepository {
  findDailyStats(
    advertiserId: number,
    startDate: string,
    endDate: string,
  ): Promise<BannerAdDailyStat[]>;
  findBannersByAdvertiserId(advertiserId: number): Promise<AdvertiserBanner[]>;
}

export const ADVERTISER_REPOSITORY = Symbol('ADVERTISER_REPOSITORY');
