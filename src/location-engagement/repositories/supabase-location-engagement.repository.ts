import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  ILocationEngagementRepository,
  LatestTimestamp,
  LocationEngagementRow,
} from '../interfaces/location-engagement-repository.interface';

@Injectable()
export class SupabaseLocationEngagementRepository implements ILocationEngagementRepository {
  constructor(private supabaseService: SupabaseService) {}

  async findLatestTimestamp(): Promise<LatestTimestamp | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('user_location_engagement_time_series')
      .select('date, time')
      .order('date', { ascending: false })
      .order('time', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    return data as LatestTimestamp;
  }

  async findByDateAndTime(
    date: string,
    time: string,
  ): Promise<LocationEngagementRow[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('user_location_engagement_time_series')
      .select(
        'sigungu_code, sigungu_name, today_cumulative_count, yesterday_cumulative_count',
      )
      .eq('date', date)
      .eq('time', time);

    if (error || !data) return [];
    return data as unknown as LocationEngagementRow[];
  }
}
