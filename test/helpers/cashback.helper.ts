import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '../../src/supabase/database.types';

// every_receipt
export interface TestEveryReceipt {
  user_id: string;
  point?: number;
  status?: string;
  image_url?: string;
  created_at?: string;
}

export async function createEveryReceipt(
  supabase: SupabaseClient<Database>,
  data: TestEveryReceipt,
) {
  const { data: result, error } = await supabase
    .from('every_receipt')
    .insert({
      user_id: data.user_id,
      point: data.point ?? 0,
      status: data.status ?? 'done',
      image_url: data.image_url ?? '',
      created_at: data.created_at ?? new Date().toISOString(),
    })
    .select()
    .single();

  if (error)
    throw new Error(`Failed to create every_receipt: ${error.message}`);
  return result;
}

// step_rewards
export interface TestStepReward {
  user_id: string;
  step_count: number;
  point_amount?: number;
  rewarded_date: string;
  created_at?: string;
}

export async function createStepReward(
  supabase: SupabaseClient<Database>,
  data: TestStepReward,
) {
  const { data: result, error } = await supabase
    .from('step_rewards')
    .insert({
      user_id: data.user_id,
      step_count: data.step_count,
      point_amount: data.point_amount ?? 2,
      rewarded_date: data.rewarded_date,
      created_at: data.created_at ?? new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create step_reward: ${error.message}`);
  return result;
}

// affiliate_callback_data
export interface TestAffiliateData {
  user_id: string;
  transaction_id: number;
  point_amount: number;
  approval_date: string;
  status?: string;
  instant_amount?: number;
  data?: Record<string, unknown>;
  prepayment_metadata?: Record<string, unknown>;
  created_at?: string;
}

export async function createAffiliateData(
  supabase: SupabaseClient<Database>,
  data: TestAffiliateData,
) {
  const { data: result, error } = await supabase
    .from('affiliate_callback_data')
    .insert({
      user_id: data.user_id,
      transaction_id: data.transaction_id,
      point_amount: data.point_amount,
      approval_date: data.approval_date,
      status: data.status ?? 'pending',
      instant_amount: data.instant_amount ?? 0,
      data: (data.data ?? {}) as Json,
      prepayment_metadata: (data.prepayment_metadata ?? null) as Json,
      created_at: data.created_at ?? new Date().toISOString(),
    })
    .select()
    .single();

  if (error)
    throw new Error(`Failed to create affiliate_data: ${error.message}`);
  return result;
}

// location_info + claim
export interface TestLocationInfo {
  title: string;
  address?: string;
}

export async function createLocationInfo(
  supabase: SupabaseClient<Database>,
  data: TestLocationInfo,
) {
  const { data: result, error } = await supabase
    .from('location_info')
    .insert({
      title: data.title,
      address: data.address ?? 'Test Address',
    })
    .select()
    .single();

  if (error)
    throw new Error(`Failed to create location_info: ${error.message}`);
  return result;
}

export interface TestClaim {
  user_id: string;
  location_id: number;
  cashback_amount?: number;
  status?: string;
  discount_percent?: number;
  created_at?: string;
}

export async function createClaim(
  supabase: SupabaseClient<Database>,
  data: TestClaim,
) {
  const { data: result, error } = await supabase
    .from('claim')
    .insert({
      user_id: data.user_id,
      location_id: data.location_id,
      cashback_amount: data.cashback_amount ?? 0,
      status: data.status ?? 'completed',
      discount_percent: data.discount_percent ?? 10,
      created_at: data.created_at ?? new Date().toISOString(),
    } as never)
    .select()
    .single();

  if (error) throw new Error(`Failed to create claim: ${error.message}`);
  return result;
}
