import type {
  BannerAd,
  BannerAdEventType,
  IBannerAdRepository,
} from '../interfaces/banner-ad-repository.interface';

export class StubBannerAdRepository implements IBannerAdRepository {
  private ads: BannerAd[] = [];
  private events: Array<{
    adId: number;
    userId: string;
    eventType: BannerAdEventType;
  }> = [];
  private dailyStats = new Map<string, { impressions: number; clicks: number }>();

  setAds(ads: BannerAd[]): void {
    this.ads = ads;
  }

  getEvents() {
    return [...this.events];
  }

  getDailyStat(adId: number, date: string) {
    return this.dailyStats.get(`${adId}:${date}`) || { impressions: 0, clicks: 0 };
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
}
