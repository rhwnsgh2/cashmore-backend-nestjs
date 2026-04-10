import type {
  BannerAdDailyStat,
  IAdvertiserRepository,
} from '../interfaces/advertiser-repository.interface';

export class StubAdvertiserRepository implements IAdvertiserRepository {
  private stats: BannerAdDailyStat[] = [];

  setStats(stats: BannerAdDailyStat[]): void {
    this.stats = stats;
  }

  clear(): void {
    this.stats = [];
  }

  async findDailyStats(
    advertiserId: number,
    startDate: string,
    endDate: string,
  ): Promise<BannerAdDailyStat[]> {
    // advertiserId 필터링은 실제 DB에서 처리되므로,
    // stub에서는 별도 metadata로 관리
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
}
