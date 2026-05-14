import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  ICoupangVisitRepository,
  CoupangVisitRecord,
} from '../interfaces/coupang-visit-repository.interface';

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

  async findByUserIdAndDate(
    userId: string,
    date: string,
  ): Promise<CoupangVisitRecord | null> {
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

  async findLatestByUserId(
    userId: string,
  ): Promise<CoupangVisitRecord | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('coupang_visits')
      .select('id, user_id, created_at_date, point_amount, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
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
  ): Promise<CoupangVisitRecord> {
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
