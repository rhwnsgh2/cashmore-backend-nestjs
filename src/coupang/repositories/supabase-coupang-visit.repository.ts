import { Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  ICoupangVisitRepository,
  CoupangVisitRecord,
  CoupangVisitDomainRecord,
} from '../interfaces/coupang-visit-repository.interface';

dayjs.extend(utc);
dayjs.extend(timezone);

interface PointActionRow {
  id: number;
  user_id: string;
  point_amount: number;
  created_at: string;
}

interface CoupangVisitRow {
  id: number;
  user_id: string;
  created_at_date: string;
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

  async findByUserIdAndDate(
    userId: string,
    date: string,
  ): Promise<CoupangVisitDomainRecord | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('coupang_visits')
      .select('id, user_id, created_at_date, point_amount, created_at')
      .eq('user_id', userId)
      .eq('created_at_date', date)
      .maybeSingle<CoupangVisitRow>();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    return {
      id: data.id,
      userId: data.user_id,
      createdAtDate: data.created_at_date,
      pointAmount: data.point_amount,
      createdAt: data.created_at,
    };
  }

  async insertVisit(
    userId: string,
    date: string,
    pointAmount: number,
  ): Promise<CoupangVisitDomainRecord> {
    const { data, error } = await this.supabase
      .getClient()
      .from('coupang_visits')
      .insert({
        user_id: userId,
        created_at_date: date,
        point_amount: pointAmount,
      })
      .select('id, user_id, created_at_date, point_amount, created_at')
      .single<CoupangVisitRow>();

    if (error) {
      throw error;
    }

    return {
      id: data.id,
      userId: data.user_id,
      createdAtDate: data.created_at_date,
      pointAmount: data.point_amount,
      createdAt: data.created_at,
    };
  }
}
