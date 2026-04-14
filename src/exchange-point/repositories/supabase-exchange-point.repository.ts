import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  IExchangePointRepository,
  ExchangePoint,
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
}
