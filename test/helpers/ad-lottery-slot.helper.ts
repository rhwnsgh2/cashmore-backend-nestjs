import { SupabaseClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export type SlotTime = '09:00' | '13:00' | '18:00' | '22:00';

export interface TestAdLotterySlot {
  id?: string;
  user_id: string;
  slot_time?: SlotTime;
  reward_type?: string;
  created_at?: string;
}

/**
 * 테스트용 광고 복권 슬롯 생성
 */
export async function createAdLotterySlot(
  supabase: SupabaseClient,
  data: TestAdLotterySlot,
): Promise<TestAdLotterySlot> {
  const slot = {
    user_id: data.user_id,
    slot_time: data.slot_time ?? '09:00',
    reward_type: data.reward_type ?? 'LOTTERY',
    created_at: data.created_at ?? dayjs().toISOString(),
  };

  const { data: result, error } = await supabase
    .from('ad_lottery_slots')
    .insert(slot)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create ad lottery slot: ${error.message}`);
  }

  return result;
}

/**
 * 여러 광고 복권 슬롯 생성
 */
export async function createAdLotterySlots(
  supabase: SupabaseClient,
  slots: TestAdLotterySlot[],
): Promise<TestAdLotterySlot[]> {
  const data = slots.map((slot) => ({
    user_id: slot.user_id,
    slot_time: slot.slot_time ?? '09:00',
    reward_type: slot.reward_type ?? 'LOTTERY',
    created_at: slot.created_at ?? dayjs().toISOString(),
  }));

  const { data: result, error } = await supabase
    .from('ad_lottery_slots')
    .insert(data)
    .select();

  if (error) {
    throw new Error(`Failed to create ad lottery slots: ${error.message}`);
  }

  return result;
}

/**
 * 현재 슬롯 시간 계산 (테스트용) - Asia/Seoul 타임존 기준
 */
export function getCurrentSlotTime(): SlotTime {
  const hour = dayjs().tz('Asia/Seoul').hour();

  if (hour >= 9 && hour < 13) return '09:00';
  if (hour >= 13 && hour < 18) return '13:00';
  if (hour >= 18 && hour < 22) return '18:00';
  return '22:00';
}

/**
 * 현재 슬롯 시작 시간 계산 (테스트용) - Asia/Seoul 타임존 기준
 */
export function getCurrentSlotStartTime(): string {
  const now = dayjs().tz('Asia/Seoul');
  const hour = now.hour();

  if (hour >= 9 && hour < 13) {
    return now.hour(9).minute(0).second(0).millisecond(0).toISOString();
  }
  if (hour >= 13 && hour < 18) {
    return now.hour(13).minute(0).second(0).millisecond(0).toISOString();
  }
  if (hour >= 18 && hour < 22) {
    return now.hour(18).minute(0).second(0).millisecond(0).toISOString();
  }
  if (hour >= 22) {
    return now.hour(22).minute(0).second(0).millisecond(0).toISOString();
  }
  // 0~9시: 어제 22시
  return now
    .subtract(1, 'day')
    .hour(22)
    .minute(0)
    .second(0)
    .millisecond(0)
    .toISOString();
}
