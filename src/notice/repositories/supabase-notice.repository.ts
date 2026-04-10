import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  INoticeRepository,
  Notice,
} from '../interfaces/notice-repository.interface';

@Injectable()
export class SupabaseNoticeRepository implements INoticeRepository {
  constructor(private supabaseService: SupabaseService) {}

  async findVisible(): Promise<Notice[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('notices')
      .select('*')
      .eq('is_visible', true)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data as unknown as Notice[];
  }
}
