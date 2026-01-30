import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  IExchangePointRepository,
  ExchangePoint,
  InsertExchangePointData,
} from '../interfaces/exchange-point-repository.interface';

@Injectable()
export class SupabaseExchangePointRepository implements IExchangePointRepository {
  constructor(private supabaseService: SupabaseService) {}

  async findByUserId(userId: string): Promise<ExchangePoint[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('point_actions')
      .select(
        'id, user_id, type, point_amount, status, created_at, additional_data',
      )
      .eq('user_id', userId)
      .eq('type', 'EXCHANGE_POINT_TO_CASH');

    if (error) {
      throw error;
    }

    return (data as ExchangePoint[]) || [];
  }

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
      .insert(data as any)
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    return { id: (result as { id: number }).id };
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
      .single();

    if (error) {
      return null;
    }

    return data as ExchangePoint;
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
      } as unknown as never)
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      throw error;
    }
  }
}
