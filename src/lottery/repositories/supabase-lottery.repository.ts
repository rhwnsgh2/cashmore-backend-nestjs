import { Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  ILotteryRepository,
  InsertLotteryData,
  InsertPointActionData,
  Lottery,
  LotteryStatus,
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

  async insertLottery(data: InsertLotteryData): Promise<Lottery> {
    const { data: result, error } = await this.supabaseService
      .getClient()
      .from('lotteries')
      .insert(data as any)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return result as Lottery;
  }

  async updateLotteryStatus(
    lotteryId: string,
    status: LotteryStatus,
    usedAt: string,
  ): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('lotteries')
      .update({ status, used_at: usedAt } as unknown as never)
      .eq('id', lotteryId);

    if (error) {
      throw error;
    }
  }

  async insertPointAction(data: InsertPointActionData): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('point_actions')
      .insert(data as any);

    if (error) {
      throw error;
    }
  }
}
