import { Injectable } from '@nestjs/common';
import dayjs from 'dayjs';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  ILotteryRepository,
  InsertLotteryData,
  InsertPointActionData,
  InsertAdLotterySlotData,
  Lottery,
  LotteryStatus,
  MaxRewardLottery,
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

  async findLotteryById(lotteryId: string): Promise<Lottery | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('lotteries')
      .select(
        'id, user_id, lottery_type_id, status, issued_at, expires_at, reward_amount, used_at',
      )
      .eq('id', lotteryId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as Lottery;
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

  async insertAdLotterySlot(data: InsertAdLotterySlotData): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('ad_lottery_slots')
      .insert(data as any);

    if (error) {
      throw error;
    }
  }

  async findMaxRewardLotteries(limit: number): Promise<MaxRewardLottery[]> {
    interface LotteryRow {
      user_id: string;
      reward_amount: number;
      lottery_type_id: string;
      used_at: string;
    }

    interface UserRow {
      id: string;
      nickname: string | null;
    }

    // 각 복권 타입별 최대 당첨금을 받은 유저만 조회
    const { data: lotteries, error } = await this.supabaseService
      .getClient()
      .from('lotteries')
      .select('user_id, reward_amount, lottery_type_id, used_at')
      .eq('status', 'USED')
      .not('used_at', 'is', null)
      .or(
        'and(lottery_type_id.eq.MAX_100,reward_amount.eq.100),and(lottery_type_id.eq.MAX_500,reward_amount.eq.500),and(lottery_type_id.eq.MAX_1000,reward_amount.eq.1000),and(lottery_type_id.eq.STANDARD_5,reward_amount.eq.500)',
      )
      .order('used_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    const typedLotteries = lotteries as LotteryRow[] | null;

    if (!typedLotteries || typedLotteries.length === 0) {
      return [];
    }

    // user_id들로 닉네임 조회
    const userIds = [...new Set(typedLotteries.map((l) => l.user_id))];
    const { data: users, error: userError } = await this.supabaseService
      .getClient()
      .from('user')
      .select('id, nickname')
      .in('id', userIds);

    if (userError) {
      console.error('Failed to fetch users:', userError);
    }

    const typedUsers = users as UserRow[] | null;
    const userMap = new Map(typedUsers?.map((u) => [u.id, u.nickname]) ?? []);

    return typedLotteries.map((row) => ({
      user_id: row.user_id,
      reward_amount: row.reward_amount,
      lottery_type_id: row.lottery_type_id,
      used_at: row.used_at,
      nickname: userMap.get(row.user_id) ?? null,
    })) as MaxRewardLottery[];
  }
}
