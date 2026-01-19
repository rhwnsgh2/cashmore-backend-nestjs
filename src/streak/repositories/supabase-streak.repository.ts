import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  IStreakRepository,
  ReceiptSubmission,
} from '../interfaces/streak-repository.interface';

@Injectable()
export class SupabaseStreakRepository implements IStreakRepository {
  constructor(private supabaseService: SupabaseService) {}

  async findReceiptSubmissions(userId: string): Promise<ReceiptSubmission[]> {
    const PAGE_SIZE = 1000;
    const allData: ReceiptSubmission[] = [];
    let offset = 0;

    while (true) {
      const { data, error } = await this.supabaseService
        .getClient()
        .from('every_receipt')
        .select('id, user_id, created_at')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        break;
      }

      allData.push(...(data as ReceiptSubmission[]));

      if (data.length < PAGE_SIZE) {
        break;
      }

      offset += PAGE_SIZE;
    }

    return allData;
  }
}
