import { Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  ICoupangVisitRepository,
  CoupangVisitRecord,
} from '../interfaces/coupang-visit-repository.interface';

dayjs.extend(utc);
dayjs.extend(timezone);

interface PointActionRow {
  id: number;
  user_id: string;
  point_amount: number;
  created_at: string;
}

@Injectable()
export class SupabaseCoupangVisitRepository implements ICoupangVisitRepository {
  constructor(private supabase: SupabaseService) {}

  async findTodayVisit(userId: string): Promise<CoupangVisitRecord | null> {
    const todayStart = dayjs().tz('Asia/Seoul').startOf('day').toISOString();
    const todayEnd = dayjs().tz('Asia/Seoul').endOf('day').toISOString();

    const { data, error } = await this.supabase
      .getClient()
      .from('point_actions')
      .select('id, user_id, point_amount, created_at')
      .eq('user_id', userId)
      .eq('type', 'COUPANG_VISIT')
      .gte('created_at', todayStart)
      .lte('created_at', todayEnd)
      .limit(1)
      .returns<PointActionRow[]>();

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return null;
    }

    const row = data[0];
    return {
      id: row.id,
      userId: row.user_id,
      pointAmount: row.point_amount,
      createdAt: row.created_at,
    };
  }

}
