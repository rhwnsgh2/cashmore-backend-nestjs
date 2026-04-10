import { Inject, Injectable } from '@nestjs/common';
import type {
  BannerAd,
  BannerAdStatSummary,
  IBannerAdRepository,
} from './interfaces/banner-ad-repository.interface';
import { BANNER_AD_REPOSITORY } from './interfaces/banner-ad-repository.interface';
import { BannerAdDto } from './dto/banner-ad-response.dto';

/**
 * 직광고 시간대 노출 정책 (KST 기준)
 * - 특정 광고에만 적용되는 시간대 제한
 * - startHour/endHour: 0~23 (startHour 이상, endHour 미만)
 * - 날짜 범위는 DB의 start_date/end_date로 관리
 */
const AD_TIME_POLICIES: Record<number, { startHour: number; endHour: number }> =
  {
    // 렌트리 배너: 12시~18시만 노출
    1: { startHour: 12, endHour: 18 },
  };

@Injectable()
export class BannerAdService {
  constructor(
    @Inject(BANNER_AD_REPOSITORY)
    private bannerAdRepository: IBannerAdRepository,
  ) {}

  private isWithinAdPolicy(ad: BannerAd): boolean {
    const policy = AD_TIME_POLICIES[ad.id];
    if (!policy) return true;

    const nowKST = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }),
    );
    const hour = nowKST.getHours();
    return hour >= policy.startHour && hour < policy.endHour;
  }

  async getActiveBanners(placement: string): Promise<BannerAdDto[]> {
    const ads = await this.bannerAdRepository.findActive(placement);
    return ads
      .filter((ad) => this.isWithinAdPolicy(ad))
      .map((ad) => ({
        id: ad.id,
        imageUrl: ad.image_url,
        clickUrl: ad.click_url,
        placement: ad.placement,
      }));
  }

  async trackImpression(
    adId: number,
    userId: string,
  ): Promise<{ success: boolean }> {
    await Promise.all([
      this.bannerAdRepository.recordEvent(adId, userId, 'impression'),
      this.bannerAdRepository.incrementDailyStat(adId, 'impression'),
    ]);
    return { success: true };
  }

  async trackClick(
    adId: number,
    userId: string,
  ): Promise<{ success: boolean }> {
    await Promise.all([
      this.bannerAdRepository.recordEvent(adId, userId, 'click'),
      this.bannerAdRepository.incrementDailyStat(adId, 'click'),
    ]);
    return { success: true };
  }

  async updateAdvertiserId(
    bannerAdId: number,
    advertiserId: number,
  ): Promise<void> {
    await this.bannerAdRepository.updateAdvertiserId(bannerAdId, advertiserId);
  }

  async getStatsSummary(
    startDate?: string,
    endDate?: string,
  ): Promise<{
    totalImpressions: number;
    totalClicks: number;
    overallCtr: number;
    banners: Array<{
      adId: number;
      adTitle: string;
      impressions: number;
      clicks: number;
      ctr: number;
    }>;
  }> {
    const end = endDate || new Date().toISOString().slice(0, 10);
    const start =
      startDate ||
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);

    const summaries: BannerAdStatSummary[] =
      await this.bannerAdRepository.findStatsSummary(start, end);

    let totalImpressions = 0;
    let totalClicks = 0;

    const banners = summaries.map((s) => {
      totalImpressions += s.impressions;
      totalClicks += s.clicks;
      return {
        adId: s.ad_id,
        adTitle: s.ad_title,
        impressions: s.impressions,
        clicks: s.clicks,
        ctr:
          s.impressions > 0
            ? Math.round((s.clicks / s.impressions) * 10000) / 100
            : 0,
      };
    });

    const overallCtr =
      totalImpressions > 0
        ? Math.round((totalClicks / totalImpressions) * 10000) / 100
        : 0;

    return { totalImpressions, totalClicks, overallCtr, banners };
  }
}
