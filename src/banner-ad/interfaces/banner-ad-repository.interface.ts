export interface BannerAd {
  id: number;
  title: string;
  image_url: string;
  click_url: string;
  placement: string;
  priority: number;
}

export type BannerAdEventType = 'impression' | 'click';

export interface IBannerAdRepository {
  findActive(placement: string): Promise<BannerAd[]>;
  recordEvent(
    adId: number,
    userId: string,
    eventType: BannerAdEventType,
  ): Promise<void>;
  incrementDailyStat(
    adId: number,
    eventType: BannerAdEventType,
  ): Promise<void>;
}

export const BANNER_AD_REPOSITORY = Symbol('BANNER_AD_REPOSITORY');
