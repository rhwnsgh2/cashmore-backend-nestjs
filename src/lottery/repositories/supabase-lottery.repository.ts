import { Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  ILotteryRepository,
  Lottery,
} from '../interfaces/lottery-repository.interface';

@Injectable()
export class SupabaseLotteryRepository implements ILotteryRepository {
  constructor(private supabaseService: SupabaseService) {}

  async findAvailableLotteries(userId: string): Promise<Lottery[]> {
    const now = dayjs().toISOString();

    const { data, error } = await this.supabaseService
      .getClient()
      .from('lotteries')
      .select(
        'id, user_id, lottery_type_id, status, issued_at, expires_at, reward_amount, used_at',
      )
      .eq('user_id', userId)
      .eq('status', 'ISSUED')
      .gt('expires_at', now)
      .order('issued_at', { ascending: false })
      .limit(20);

    if (error) {
      throw error;
    }

    return (data as Lottery[]) || [];
  }
}
