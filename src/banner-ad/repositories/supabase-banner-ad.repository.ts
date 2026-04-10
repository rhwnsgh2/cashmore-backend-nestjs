import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  BannerAd,
  BannerAdEventType,
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
}
