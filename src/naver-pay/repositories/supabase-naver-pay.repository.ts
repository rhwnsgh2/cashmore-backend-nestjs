import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  INaverPayRepository,
  NaverPayAccount,
  CreateNaverPayAccountData,
} from '../interfaces/naver-pay-repository.interface';

@Injectable()
export class SupabaseNaverPayRepository implements INaverPayRepository {
  constructor(private supabaseService: SupabaseService) {}

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
      })
      .eq('id', accountId);

    if (error) {
      throw error;
    }
  }
}
