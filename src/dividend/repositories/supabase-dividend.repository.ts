import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  IDividendRepository,
  SimulateResult,
} from '../interfaces/dividend-repository.interface';

@Injectable()
export class SupabaseDividendRepository implements IDividendRepository {
  constructor(private supabaseService: SupabaseService) {}

  async getSimulateData(
    startDate: string,
    endDate: string,
  ): Promise<SimulateResult> {
    const { data, error } = await this.supabaseService
      .getClient()
      .rpc('get_receipt_user_distribution', {
        start_date: startDate,
        end_date: endDate,
      });

    if (error) {
      throw error;
    }

    return {
      distribution: (data?.distribution || []).map(
        (item: { receipt_count: number; user_count: number }) => ({
          receiptCount: item.receipt_count,
          userCount: item.user_count,
        }),
      ),
      totalUsers: data?.totalUsers ?? 0,
      totalReceipts: data?.totalReceipts ?? 0,
    };
  }
}
