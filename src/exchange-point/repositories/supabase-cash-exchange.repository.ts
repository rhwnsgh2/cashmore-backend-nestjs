import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  ICashExchangeRepository,
  CashExchangeStatus,
  InsertCashExchangeData,
} from '../interfaces/cash-exchange-repository.interface';

@Injectable()
export class SupabaseCashExchangeRepository
  implements ICashExchangeRepository
{
  constructor(private supabaseService: SupabaseService) {}

  async insert(data: InsertCashExchangeData): Promise<{ id: number }> {
    const { data: result, error } = await this.supabaseService
      .getClient()
      .from('cash_exchanges')
      .insert({
        user_id: data.user_id,
        amount: data.amount,
        point_action_id: data.point_action_id,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    return { id: (result as { id: number }).id };
  }

  async updateStatus(
    pointActionId: number,
    status: CashExchangeStatus,
    extra?: {
      reason?: string;
      cancelled_at?: string;
      confirmed_at?: string;
      rejected_at?: string;
    },
  ): Promise<void> {
    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (extra?.reason) updateData.reason = extra.reason;
    if (extra?.cancelled_at) updateData.cancelled_at = extra.cancelled_at;
    if (extra?.confirmed_at) updateData.confirmed_at = extra.confirmed_at;
    if (extra?.rejected_at) updateData.rejected_at = extra.rejected_at;

    const { error } = await this.supabaseService
      .getClient()
      .from('cash_exchanges')
      .update(updateData)
      .eq('point_action_id', pointActionId);

    if (error) {
      throw error;
    }
  }
}
