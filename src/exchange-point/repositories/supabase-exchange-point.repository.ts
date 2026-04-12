import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  IExchangePointRepository,
  ExchangePoint,
  InsertExchangePointData,
  InsertRestoreActionData,
} from '../interfaces/exchange-point-repository.interface';

@Injectable()
export class SupabaseExchangePointRepository implements IExchangePointRepository {
  constructor(private supabaseService: SupabaseService) {}

  async getTotalPoints(userId: string): Promise<number> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('point_actions')
      .select('point_amount')
      .eq('user_id', userId)
      .in('status', ['done', 'pending']);

    if (error) {
      throw error;
    }

    return (data || []).reduce(
      (sum: number, item: { point_amount: number }) => sum + item.point_amount,
      0,
    );
  }

  async insertExchangeRequest(
    data: InsertExchangePointData,
  ): Promise<{ id: number }> {
    const { data: result, error } = await this.supabaseService
      .getClient()
      .from('point_actions')
      .insert(data)
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    return { id: (result as { id: number }).id };
  }

  async insertRestoreAction(
    data: InsertRestoreActionData,
  ): Promise<{ id: number }> {
    const { data: result, error } = await this.supabaseService
      .getClient()
      .from('point_actions')
      .insert({
        user_id: data.user_id,
        type: 'EXCHANGE_POINT_TO_CASH',
        point_amount: data.amount, // 양수 (복원)
        status: 'done',
        additional_data: {
          original_point_action_id: data.original_point_action_id,
          reason: data.reason ?? null,
        },
      })
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    return { id: (result as { id: number }).id };
  }

  async findRelatedToExchange(
    originalPointActionId: number,
  ): Promise<ExchangePoint[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('point_actions')
      .select(
        'id, user_id, type, point_amount, status, created_at, additional_data',
      )
      .eq('type', 'EXCHANGE_POINT_TO_CASH')
      .or(
        `id.eq.${originalPointActionId},additional_data->>original_point_action_id.eq.${originalPointActionId}`,
      )
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    return (data as ExchangePoint[]) || [];
  }

  async findById(id: number, userId: string): Promise<ExchangePoint | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('point_actions')
      .select(
        'id, user_id, type, point_amount, status, created_at, additional_data',
      )
      .eq('id', id)
      .eq('user_id', userId)
      .eq('type', 'EXCHANGE_POINT_TO_CASH')
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data as ExchangePoint;
  }

  async findByIds(ids: number[]): Promise<ExchangePoint[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('point_actions')
      .select(
        'id, user_id, type, point_amount, status, created_at, additional_data',
      )
      .in('id', ids)
      .eq('type', 'EXCHANGE_POINT_TO_CASH');

    if (error) {
      throw error;
    }

    return (data as ExchangePoint[]) || [];
  }

  async approveExchangeRequests(ids: number[]): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('point_actions')
      .update({
        status: 'done',
        additional_data: {
          confirmed_at: new Date().toISOString(),
          rejected_at: null,
          cancelled_at: null,
        },
      })
      .in('id', ids);

    if (error) {
      throw error;
    }
  }

  async rejectExchangeRequest(id: number, reason: string): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('point_actions')
      .update({
        status: 'rejected',
        additional_data: {
          confirmed_at: null,
          rejected_at: new Date().toISOString(),
          cancelled_at: null,
          reason,
        },
      })
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  async cancelExchangeRequest(id: number, userId: string): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('point_actions')
      .update({
        status: 'cancelled',
        additional_data: {
          confirmed_at: null,
          rejected_at: null,
          cancelled_at: new Date().toISOString(),
        },
      })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }
  }
}
