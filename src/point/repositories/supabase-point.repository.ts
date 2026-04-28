import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  IPointRepository,
  PointAction,
  PointBalance,
  EarnedPointAction,
  POINT_ADD_TYPES,
} from '../interfaces/point-repository.interface';

@Injectable()
export class SupabasePointRepository implements IPointRepository {
  constructor(private supabaseService: SupabaseService) {}

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

  async findEarnedPointActionsInRange(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<EarnedPointAction[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('point_actions')
      .select('point_amount, created_at')
      .eq('user_id', userId)
      .eq('status', 'done')
      .in('type', [...POINT_ADD_TYPES])
      .gte('created_at', startDate)
      .lt('created_at', endDate);

    if (error) {
      throw error;
    }

    return (data || []) as EarnedPointAction[];
  }

  async findBalance(userId: string): Promise<PointBalance | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('user_point_balance')
      .select('total_point')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const row = data as { total_point: number };
    return {
      totalPoint: Number(row.total_point),
    };
  }

  async findSumUpToId(userId: string, maxId: number): Promise<number> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('point_actions')
      .select('point_amount')
      .eq('user_id', userId)
      .lte('id', maxId);

    if (error) {
      throw error;
    }

    return (data ?? []).reduce(
      (sum: number, row: { point_amount: number }) =>
        sum + (row.point_amount ?? 0),
      0,
    );
  }

  async findTotalPointSumViaRpc(
    userId: string,
    maxId: number,
  ): Promise<number> {
    const { data, error } = await this.supabaseService
      .getClient()
      .rpc('sum_user_points_up_to_id', {
        p_user_id: userId,
        p_max_id: maxId,
      });

    if (error) {
      throw error;
    }

    return Number(data ?? 0);
  }

  async findTotalPointSum(userId: string): Promise<number> {
    const { data, error } = await this.supabaseService
      .getClient()
      .rpc('sum_user_points', {
        p_user_id: userId,
      });

    if (error) {
      throw error;
    }

    return Number(data ?? 0);
  }
}
