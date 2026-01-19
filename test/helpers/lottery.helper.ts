import { SupabaseClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';

export type LotteryType = 'STANDARD_5' | 'MAX_100' | 'MAX_500' | 'MAX_1000';
export type LotteryStatus = 'ISSUED' | 'USED' | 'EXPIRED';

export interface TestLottery {
  id?: string;
  user_id: string;
  lottery_type_id?: LotteryType;
  status?: LotteryStatus;
  issued_at?: string;
  expires_at?: string;
  reward_amount?: number;
  used_at?: string | null;
}

/**
 * 테스트용 복권 생성
 */
export async function createLottery(
  supabase: SupabaseClient,
  data: TestLottery,
): Promise<TestLottery> {
  const lottery = {
    user_id: data.user_id,
    lottery_type_id: data.lottery_type_id ?? 'MAX_500',
    status: data.status ?? 'ISSUED',
    issued_at: data.issued_at ?? dayjs().toISOString(),
    expires_at: data.expires_at ?? dayjs().add(7, 'day').toISOString(),
    reward_amount: data.reward_amount ?? 0,
    used_at: data.used_at ?? null,
  };

  const { data: result, error } = await supabase
    .from('lotteries')
    .insert(lottery)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create lottery: ${error.message}`);
  }

  return result;
}

/**
 * 여러 복권 생성
 */
export async function createLotteries(
  supabase: SupabaseClient,
  lotteries: TestLottery[],
): Promise<TestLottery[]> {
  const data = lotteries.map((lottery) => ({
    user_id: lottery.user_id,
    lottery_type_id: lottery.lottery_type_id ?? 'MAX_500',
    status: lottery.status ?? 'ISSUED',
    issued_at: lottery.issued_at ?? dayjs().toISOString(),
    expires_at: lottery.expires_at ?? dayjs().add(7, 'day').toISOString(),
    reward_amount: lottery.reward_amount ?? 0,
    used_at: lottery.used_at ?? null,
  }));

  const { data: result, error } = await supabase
    .from('lotteries')
    .insert(data)
    .select();

  if (error) {
    throw new Error(`Failed to create lotteries: ${error.message}`);
  }

  return result;
}
