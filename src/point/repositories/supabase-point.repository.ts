import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  IPointRepository,
  PointAction,
  PointSnapshot,
  MonthlyEarnedPoint,
  WithdrawalAction,
  POINT_ADD_TYPES,
} from '../interfaces/point-repository.interface';

@Injectable()
export class SupabasePointRepository implements IPointRepository {
  constructor(private supabaseService: SupabaseService) {}

  async findLatestSnapshot(userId: string): Promise<PointSnapshot | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('user_point_snapshots')
      .select('point_balance, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return data as PointSnapshot;
  }

  async findPointActionsSince(
    userId: string,
    since: string,
  ): Promise<PointAction[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('point_actions')
      .select('id, type, created_at, point_amount, status')
      .eq('user_id', userId)
      .gte('created_at', since);

    if (error) {
      throw error;
    }

    return (data as PointAction[]) || [];
  }

  async findAllPointActions(userId: string): Promise<PointAction[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('point_actions')
      .select('id, type, created_at, point_amount, status')
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    return (data as PointAction[]) || [];
  }

  async findMonthlyEarnedPointsUntil(
    userId: string,
    yearMonth: string,
  ): Promise<MonthlyEarnedPoint[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('monthly_earned_points')
      .select('earned_points')
      .eq('user_id', userId)
      .lte('year_month', yearMonth);

    if (error) {
      throw error;
    }

    return (data as MonthlyEarnedPoint[]) || [];
  }

  async findWithdrawalActions(userId: string): Promise<WithdrawalAction[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('point_actions')
      .select('point_amount, status, type')
      .eq('user_id', userId)
      .in('type', ['EXCHANGE_POINT_TO_CASH', 'POINT_EXPIRATION']);

    if (error) {
      throw error;
    }

    return (data as WithdrawalAction[]) || [];
  }

  async findEarnedPointsBetween(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<number> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('point_actions')
      .select('point_amount')
      .eq('user_id', userId)
      .eq('status', 'done')
      .in('type', [...POINT_ADD_TYPES])
      .gte('created_at', startDate)
      .lt('created_at', endDate);

    if (error) {
      throw error;
    }

    const rows = (data || []) as { point_amount: number }[];
    return rows.reduce((sum, row) => sum + (row.point_amount || 0), 0);
  }
}
