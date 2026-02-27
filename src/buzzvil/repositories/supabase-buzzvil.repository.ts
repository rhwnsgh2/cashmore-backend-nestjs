import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  IBuzzvilRepository,
  InsertBuzzvilPointAction,
  BuzzvilReward,
} from '../interfaces/buzzvil-repository.interface';

@Injectable()
export class SupabaseBuzzvilRepository implements IBuzzvilRepository {
  constructor(private supabaseService: SupabaseService) {}

  async existsByTransactionId(transactionId: string): Promise<boolean> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('point_actions')
      .select('id')
      .eq('type', 'BUZZVIL_REWARD')
      .eq('additional_data->>transaction_id', transactionId)
      .limit(1);

    if (error) {
      throw error;
    }

    return (data?.length ?? 0) > 0;
  }

  async insertPointAction(data: InsertBuzzvilPointAction): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('point_actions')
      .insert(data as any);

    if (error) {
      throw error;
    }
  }

  async findRewardByCampaignId(
    userId: string,
    campaignId: number,
  ): Promise<BuzzvilReward | null> {
    interface PointActionRow {
      user_id: string;
      point_amount: number;
      additional_data: Record<string, unknown>;
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from('point_actions')
      .select('user_id, point_amount, additional_data')
      .eq('user_id', userId)
      .eq('type', 'BUZZVIL_REWARD')
      .eq('additional_data->>campaign_id', String(campaignId))
      .limit(1)
      .single<PointActionRow>();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return {
      user_id: data.user_id,
      point_amount: data.point_amount,
      campaign_id: data.additional_data.campaign_id as number,
      transaction_id: data.additional_data.transaction_id as string,
    };
  }
}
