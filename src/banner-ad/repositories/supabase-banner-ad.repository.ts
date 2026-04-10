import { Injectable } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  BannerAd,
  BannerAdEventType,
  BannerAdStatSummary,
  IBannerAdRepository,
} from '../interfaces/banner-ad-repository.interface';

@Injectable()
export class SupabaseBannerAdRepository implements IBannerAdRepository {
  constructor(private supabaseService: SupabaseService) {}

  async findActive(placement: string): Promise<BannerAd[]> {
    const now = new Date().toISOString();

    const { data, error } = await this.supabaseService
      .getClient()
      .from('banner_ads')
      .select('id, title, image_url, click_url, placement, priority')
      .eq('is_active', true)
      .eq('placement', placement)
      .or(`start_date.is.null,start_date.lte.${now}`)
      .or(`end_date.is.null,end_date.gte.${now}`)
      .order('priority', { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []) as unknown as BannerAd[];
  }

  async recordEvent(
    adId: number,
    userId: string,
    eventType: BannerAdEventType,
  ): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('banner_ad_events')
      .insert({ ad_id: adId, user_id: userId, event_type: eventType });

    if (error) {
      throw error;
    }
  }

  async incrementDailyStat(
    adId: number,
    eventType: BannerAdEventType,
  ): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .rpc('increment_banner_ad_stat', {
        p_ad_id: adId,
        p_event_type: eventType,
      });

    if (error) {
      throw error;
    }
  }

  async updateAdvertiserId(
    bannerAdId: number,
    advertiserId: number,
  ): Promise<void> {
    const client =
      this.supabaseService.getClient() as unknown as SupabaseClient;

    const { error } = await client
      .from('banner_ads')
      .update({ advertiser_id: advertiserId })
      .eq('id', bannerAdId);

    if (error) {
      throw error;
    }
  }

  async findStatsSummary(
    startDate: string,
    endDate: string,
  ): Promise<BannerAdStatSummary[]> {
    const client =
      this.supabaseService.getClient() as unknown as SupabaseClient;

    // 모든 배너 광고 조회
    const { data: ads, error: adsError } = await client
      .from('banner_ads')
      .select('id, title');

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

    // 기간 내 일별 통계 조회
    const { data: stats, error: statsError } = await client
      .from('banner_ad_daily_stats')
      .select('ad_id, impressions, clicks')
      .in('ad_id', adIds)
      .gte('stat_date', startDate)
      .lte('stat_date', endDate);

    if (statsError) {
      throw statsError;
    }

    // 배너별 집계
    const summaryMap = new Map<
      number,
      { impressions: number; clicks: number }
    >();
    for (const stat of stats || []) {
      const s = stat as { ad_id: number; impressions: number; clicks: number };
      const existing = summaryMap.get(s.ad_id) || {
        impressions: 0,
        clicks: 0,
      };
      existing.impressions += s.impressions;
      existing.clicks += s.clicks;
      summaryMap.set(s.ad_id, existing);
    }

    return Array.from(summaryMap.entries()).map(([adId, agg]) => ({
      ad_id: adId,
      ad_title: adTitleMap.get(adId) || '',
      impressions: agg.impressions,
      clicks: agg.clicks,
    }));
  }
}
