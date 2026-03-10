import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  ExchangeAction,
  INpsSurveyRepository,
} from '../interfaces/nps-survey-repository.interface';

interface ExchangeActionRow {
  point_amount: number;
  created_at: string;
}

@Injectable()
export class SupabaseNpsSurveyRepository implements INpsSurveyRepository {
  constructor(private supabase: SupabaseService) {}

  async findDoneExchangeActions(userId: string): Promise<ExchangeAction[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('point_actions')
      .select('point_amount, created_at')
      .eq('user_id', userId)
      .eq('type', 'EXCHANGE_POINT_TO_CASH')
      .eq('status', 'done')
      .order('created_at', { ascending: false })
      .returns<ExchangeActionRow[]>();

    if (error) {
      throw error;
    }

    return (data || []).map((row) => ({
      pointAmount: row.point_amount,
      createdAt: row.created_at,
    }));
  }
}
