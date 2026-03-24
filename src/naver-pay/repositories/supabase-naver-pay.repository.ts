import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  INaverPayRepository,
  NaverPayAccount,
  NaverPayExchange,
  NaverPayExchangeStatus,
  CreateNaverPayAccountData,
  CreateNaverPayExchangeData,
} from '../interfaces/naver-pay-repository.interface';

@Injectable()
export class SupabaseNaverPayRepository implements INaverPayRepository {
  constructor(private supabaseService: SupabaseService) {}

  // --- 계정 ---

  async findConnectedAccount(userId: string): Promise<NaverPayAccount | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('naver_pay_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'connected')
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data as NaverPayAccount | null;
  }

  async countTodayFailedAttempts(userId: string): Promise<number> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count, error } = await this.supabaseService
      .getClient()
      .from('naver_pay_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'failed')
      .gte('created_at', todayStart.toISOString());

    if (error) {
      throw error;
    }

    return count ?? 0;
  }

  async createAccount(
    data: CreateNaverPayAccountData,
  ): Promise<NaverPayAccount> {
    const { data: result, error } = await this.supabaseService
      .getClient()
      .from('naver_pay_accounts')
      .insert(data)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return result as NaverPayAccount;
  }

  async disconnectAccount(accountId: string): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('naver_pay_accounts')
      .update({
        status: 'disconnected',
        disconnected_at: new Date().toISOString(),
        naver_unique_id: null,
        dau_user_key: null,
        dau_masking_id: null,
      })
      .eq('id', accountId);

    if (error) {
      throw error;
    }
  }

  // --- 전환 ---

  async createExchange(
    data: CreateNaverPayExchangeData,
  ): Promise<NaverPayExchange> {
    const { data: result, error } = await this.supabaseService
      .getClient()
      .from('naver_pay_exchanges')
      .insert({
        ...data,
        status: 'pending',
      })
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return result as NaverPayExchange;
  }

  async findExchangeById(
    exchangeId: string,
  ): Promise<NaverPayExchange | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('naver_pay_exchanges')
      .select('*')
      .eq('id', exchangeId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data as NaverPayExchange | null;
  }

  async findExchangesByStatus(
    status?: string,
  ): Promise<(NaverPayExchange & { user_email?: string })[]> {
    let query = this.supabaseService
      .getClient()
      .from('naver_pay_exchanges')
      .select('*, user:user_id(email)')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return (
      (data as (NaverPayExchange & { user?: { email: string } })[])?.map(
        (row) => ({
          ...row,
          user_email: row.user?.email,
          user: undefined,
        }),
      ) || []
    );
  }

  async findExchangesByUserId(userId: string): Promise<NaverPayExchange[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('naver_pay_exchanges')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data as NaverPayExchange[]) || [];
  }

  async findPendingExchangesByUserId(
    userId: string,
  ): Promise<NaverPayExchange[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('naver_pay_exchanges')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending');

    if (error) {
      throw error;
    }

    return (data as NaverPayExchange[]) || [];
  }

  async countTodayExchanges(userId: string): Promise<number> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count, error } = await this.supabaseService
      .getClient()
      .from('naver_pay_exchanges')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', todayStart.toISOString())
      .in('status', ['pending', 'completed']);

    if (error) {
      throw error;
    }

    return count ?? 0;
  }

  async updateExchangeStatus(
    exchangeId: string,
    status: NaverPayExchangeStatus,
    processedAt?: string,
  ): Promise<void> {
    const update: Record<string, unknown> = { status };
    if (processedAt) {
      update.processed_at = processedAt;
    }

    const { error } = await this.supabaseService
      .getClient()
      .from('naver_pay_exchanges')
      .update(update)
      .eq('id', exchangeId);

    if (error) {
      throw error;
    }
  }

  async updateExchangePointActionId(
    exchangeId: string,
    pointActionId: number,
  ): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('naver_pay_exchanges')
      .update({ point_action_id: pointActionId })
      .eq('id', exchangeId);

    if (error) {
      throw error;
    }
  }

  async deleteExchange(exchangeId: string): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('naver_pay_exchanges')
      .delete()
      .eq('id', exchangeId);

    if (error) {
      throw error;
    }
  }

  async updateExchangePartnerTxNo(
    exchangeId: string,
    partnerTxNo: string,
  ): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('naver_pay_exchanges')
      .update({ partner_tx_no: partnerTxNo })
      .eq('id', exchangeId);

    if (error) {
      throw error;
    }
  }

  async updateExchangeTxNo(exchangeId: string, txNo: string): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('naver_pay_exchanges')
      .update({ tx_no: txNo })
      .eq('id', exchangeId);

    if (error) {
      throw error;
    }
  }

  async updateExchangeErrorCode(
    exchangeId: string,
    errorCode: string,
  ): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('naver_pay_exchanges')
      .update({ error_code: errorCode })
      .eq('id', exchangeId);

    if (error) {
      throw error;
    }
  }
}
