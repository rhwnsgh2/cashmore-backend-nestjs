import type {
  BannerAd,
  BannerAdEventType,
  BannerAdStatSummary,
  IBannerAdRepository,
} from '../interfaces/banner-ad-repository.interface';

export class StubBannerAdRepository implements IBannerAdRepository {
  private ads: BannerAd[] = [];
  private events: Array<{
    adId: number;
    userId: string;
    eventType: BannerAdEventType;
  }> = [];
  private dailyStats = new Map<
    string,
    { impressions: number; clicks: number }
  >();

  setAds(ads: BannerAd[]): void {
    this.ads = ads;
  }

  getEvents() {
    return [...this.events];
  }

  getDailyStat(adId: number, date: string) {
    return (
      this.dailyStats.get(`${adId}:${date}`) || { impressions: 0, clicks: 0 }
    );
  }

  clear(): void {
    this.ads = [];
    this.events = [];
    this.dailyStats.clear();
  }

  findActive(placement: string): Promise<BannerAd[]> {
    return Promise.resolve(
      [...this.ads]
        .filter((ad) => ad.placement === placement)
        .sort((a, b) => a.priority - b.priority),
    );
  }

  recordEvent(
    adId: number,
    userId: string,
    eventType: BannerAdEventType,
  ): Promise<void> {
    this.events.push({ adId, userId, eventType });
    return Promise.resolve();
  }

  incrementDailyStat(
    adId: number,
    eventType: BannerAdEventType,
  ): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const key = `${adId}:${today}`;
    const stat = this.dailyStats.get(key) || { impressions: 0, clicks: 0 };

    if (eventType === 'impression') {
      stat.impressions += 1;
    } else {
      stat.clicks += 1;
    }

    this.dailyStats.set(key, stat);
    return Promise.resolve();
  }

  updateAdvertiserId(
    bannerAdId: number,
    advertiserId: number,
  ): Promise<void> {
    const ad = this.ads.find((a) => a.id === bannerAdId);
    if (ad) {
      (ad as BannerAd & { advertiser_id?: number }).advertiser_id =
        advertiserId;
    }
    return Promise.resolve();
  }

  findStatsSummary(
    startDate: string,
    endDate: string,
  ): Promise<BannerAdStatSummary[]> {
    const summaryMap = new Map<
      number,
      { impressions: number; clicks: number }
    >();

    for (const [key, stat] of this.dailyStats.entries()) {
      const [adIdStr, date] = key.split(':');
      if (date >= startDate && date <= endDate) {
        const adId = Number(adIdStr);
        const existing = summaryMap.get(adId) || {
          impressions: 0,
          clicks: 0,
        };
        existing.impressions += stat.impressions;
        existing.clicks += stat.clicks;
        summaryMap.set(adId, existing);
      }
    }

    return Promise.resolve(
      Array.from(summaryMap.entries()).map(([adId, agg]) => {
        const ad = this.ads.find((a) => a.id === adId);
        return {
          ad_id: adId,
          ad_title: ad?.title || '',
          impressions: agg.impressions,
          clicks: agg.clicks,
        };
      }),
    );
  }
}
