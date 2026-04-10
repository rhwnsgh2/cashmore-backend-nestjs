import type {
  AdvertiserBanner,
  BannerAdDailyStat,
  IAdvertiserRepository,
} from '../interfaces/advertiser-repository.interface';

export class StubAdvertiserRepository implements IAdvertiserRepository {
  private stats: BannerAdDailyStat[] = [];
  private banners: (AdvertiserBanner & { advertiser_id: number })[] = [];

  setStats(stats: BannerAdDailyStat[]): void {
    this.stats = stats;
  }

  setBanners(
    banners: (AdvertiserBanner & { advertiser_id: number })[],
  ): void {
    this.banners = banners;
  }

  clear(): void {
    this.stats = [];
    this.banners = [];
  }

  async findDailyStats(
    advertiserId: number,
    startDate: string,
    endDate: string,
  ): Promise<BannerAdDailyStat[]> {
    return this.stats
      .filter(
        (s) => s.stat_date >= startDate && s.stat_date <= endDate,
      )
      .sort((a, b) => {
        if (a.stat_date !== b.stat_date) {
          return b.stat_date.localeCompare(a.stat_date);
        }
        return a.ad_id - b.ad_id;
      });
  }

  async findBannersByAdvertiserId(
    advertiserId: number,
  ): Promise<AdvertiserBanner[]> {
    return this.banners
      .filter((b) => b.advertiser_id === advertiserId)
      .map(({ advertiser_id: _, ...banner }) => banner)
      .sort((a, b) => a.id - b.id);
  }
}
