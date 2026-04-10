export interface BannerAd {
  id: number;
  title: string;
  image_url: string;
  click_url: string;
  placement: string;
  priority: number;
  advertiser_id?: number | null;
}

export type BannerAdEventType = 'impression' | 'click';

export interface BannerAdStatSummary {
  ad_id: number;
  ad_title: string;
  impressions: number;
  clicks: number;
}

export interface IBannerAdRepository {
  findAll(): Promise<BannerAd[]>;
  findActive(placement: string): Promise<BannerAd[]>;
  recordEvent(
    adId: number,
    userId: string,
    eventType: BannerAdEventType,
  ): Promise<void>;
  incrementDailyStat(adId: number, eventType: BannerAdEventType): Promise<void>;
  updateAdvertiserId(bannerAdId: number, advertiserId: number): Promise<void>;
  findStatsSummary(
    startDate: string,
    endDate: string,
  ): Promise<BannerAdStatSummary[]>;
}

export const BANNER_AD_REPOSITORY = Symbol('BANNER_AD_REPOSITORY');
