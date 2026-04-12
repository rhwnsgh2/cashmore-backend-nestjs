import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  ExchangeAction,
  INpsSurveyRepository,
} from '../interfaces/nps-survey-repository.interface';

@Injectable()
export class SupabaseNpsSurveyRepository implements INpsSurveyRepository {
  constructor(private supabase: SupabaseService) {}

  async findDoneExchangeActions(userId: string): Promise<ExchangeAction[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('cash_exchanges')
      .select('amount, created_at')
      .eq('user_id', userId)
      .eq('status', 'done')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []).map((row) => ({
      pointAmount: -Number(row.amount), // cash_exchanges.amount는 양수, ExchangeAction.pointAmount는 음수 관례 유지
      createdAt: row.created_at,
    }));
  }
}
