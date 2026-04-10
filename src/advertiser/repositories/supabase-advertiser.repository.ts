import { Injectable } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  BannerAdDailyStat,
  IAdvertiserRepository,
} from '../interfaces/advertiser-repository.interface';

@Injectable()
export class SupabaseAdvertiserRepository implements IAdvertiserRepository {
  constructor(private supabaseService: SupabaseService) {}

  async findDailyStats(
    advertiserId: number,
    startDate: string,
    endDate: string,
  ): Promise<BannerAdDailyStat[]> {
    const client = this.supabaseService.getClient() as unknown as SupabaseClient;

    // banner_ads에서 해당 광고주의 광고 ID 목록 조회
    const { data: ads, error: adsError } = await client
      .from('banner_ads')
      .select('id, title')
      .eq('advertiser_id', advertiserId);

    if (adsError) {
      throw adsError;
    }

    if (!ads || ads.length === 0) {
      return [];
    }

    const adIds = ads.map((ad: { id: number }) => ad.id);
    const adTitleMap = new Map<number, string>(
      ads.map((ad: { id: number; title: string }) => [ad.id, ad.title]),
    );

    // banner_ad_daily_stats에서 해당 광고들의 일별 통계 조회
    const { data: stats, error: statsError } = await client
      .from('banner_ad_daily_stats')
      .select('ad_id, stat_date, impressions, clicks')
      .in('ad_id', adIds)
      .gte('stat_date', startDate)
      .lte('stat_date', endDate)
      .order('stat_date', { ascending: false })
      .order('ad_id', { ascending: true });

    if (statsError) {
      throw statsError;
    }

    return (stats || []).map(
      (stat: {
        ad_id: number;
        stat_date: string;
        impressions: number;
        clicks: number;
      }) => ({
        ad_id: stat.ad_id,
        ad_title: adTitleMap.get(stat.ad_id) || '',
        stat_date: stat.stat_date,
        impressions: stat.impressions,
        clicks: stat.clicks,
      }),
    );
  }
}
