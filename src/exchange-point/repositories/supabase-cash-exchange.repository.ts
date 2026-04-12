import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  ICashExchangeRepository,
  CashExchange,
  CashExchangeStatus,
  InsertCashExchangeData,
} from '../interfaces/cash-exchange-repository.interface';

@Injectable()
export class SupabaseCashExchangeRepository implements ICashExchangeRepository {
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

  async updateStatusBulk(
    pointActionIds: number[],
    status: CashExchangeStatus,
    extra?: { confirmed_at?: string },
  ): Promise<void> {
    if (pointActionIds.length === 0) {
      return;
    }

    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (extra?.confirmed_at) updateData.confirmed_at = extra.confirmed_at;

    const CHUNK_SIZE = 100;
    for (let i = 0; i < pointActionIds.length; i += CHUNK_SIZE) {
      const chunk = pointActionIds.slice(i, i + CHUNK_SIZE);
      const { error } = await this.supabaseService
        .getClient()
        .from('cash_exchanges')
        .update(updateData)
        .in('point_action_id', chunk);

      if (error) {
        throw error;
      }
    }
  }

  async findByUserId(userId: string): Promise<CashExchange[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('cash_exchanges')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data as CashExchange[]) || [];
  }

  async findByPointActionId(
    pointActionId: number,
  ): Promise<CashExchange | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('cash_exchanges')
      .select('*')
      .eq('point_action_id', pointActionId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data as CashExchange;
  }

  async findByPointActionIds(
    pointActionIds: number[],
  ): Promise<CashExchange[]> {
    if (pointActionIds.length === 0) {
      return [];
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from('cash_exchanges')
      .select('*')
      .in('point_action_id', pointActionIds);

    if (error) {
      throw error;
    }

    return (data as CashExchange[]) || [];
  }

  async findByUserIds(
    userIds: string[],
    limit: number,
  ): Promise<CashExchange[]> {
    if (userIds.length === 0) {
      return [];
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from('cash_exchanges')
      .select('*')
      .in('user_id', userIds)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return (data as CashExchange[]) || [];
  }

  async findByStatus(status: CashExchangeStatus): Promise<CashExchange[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('cash_exchanges')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data as CashExchange[]) || [];
  }
}
