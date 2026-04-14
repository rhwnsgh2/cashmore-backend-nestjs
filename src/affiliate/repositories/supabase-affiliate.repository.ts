import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  IAffiliateRepository,
  PendingAffiliateApproval,
} from '../interfaces/affiliate-repository.interface';

interface AffiliateCallbackRow {
  id: number;
  user_id: string;
  point_amount: number;
  data: { merchant_id?: string } | null;
}

@Injectable()
export class SupabaseAffiliateRepository implements IAffiliateRepository {
  constructor(private supabaseService: SupabaseService) {}

  async findPendingApprovals(
    beforeDate: string,
  ): Promise<PendingAffiliateApproval[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('affiliate_callback_data')
      .select('id, user_id, point_amount, data')
      .eq('status', 'pending')
      .lt('approval_date', beforeDate)
      .returns<AffiliateCallbackRow[]>();

    if (error) {
      throw error;
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      pointAmount: row.point_amount,
      merchantId: row.data?.merchant_id ?? 'unknown',
    }));
  }

  async markCompleted(id: number, completedAt: string): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('affiliate_callback_data')
      .update({
        status: 'completed',
        completed_at: completedAt,
      })
      .eq('id', id);

    if (error) {
      throw error;
    }
  }
}
