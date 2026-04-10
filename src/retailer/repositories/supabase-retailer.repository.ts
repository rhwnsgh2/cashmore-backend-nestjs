import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  IRetailerRepository,
  RawLocationInfo,
  RawLocationImage,
  BaseCashbackRate,
} from '../interfaces/retailer-repository.interface';

@Injectable()
export class SupabaseRetailerRepository implements IRetailerRepository {
  constructor(private supabaseService: SupabaseService) {}

  async findVisibleLocations(): Promise<RawLocationInfo[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('location_info')
      .select('*')
      .eq('is_visible', true);

    if (error || !data) return [];
    return data as unknown as RawLocationInfo[];
  }

  async findLocationImages(): Promise<RawLocationImage[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('location_info_images')
      .select('location_id, image_url, priority')
      .order('priority', { ascending: true });

    if (error || !data) return [];
    return data as unknown as RawLocationImage[];
  }

  async findBaseCashbackRates(): Promise<BaseCashbackRate[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('cashback_rate')
      .select('location_id, min_rate, max_rate')
      .eq('type', 'base');

    if (error || !data) return [];
    return data as unknown as BaseCashbackRate[];
  }
}
