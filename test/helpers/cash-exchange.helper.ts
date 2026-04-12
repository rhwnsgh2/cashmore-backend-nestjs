import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/supabase/database.types';

export type CashExchangeStatus = 'pending' | 'done' | 'cancelled' | 'rejected';

export interface TestCashExchange {
  id?: number;
  user_id: string;
  amount: number;
  status?: CashExchangeStatus;
  point_action_id?: number | null;
  reason?: string | null;
  confirmed_at?: string | null;
  cancelled_at?: string | null;
  rejected_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreatedCashExchange extends TestCashExchange {
  id: number;
}

/**
 * cash_exchanges 행 생성
 */
export async function createCashExchange(
  supabase: SupabaseClient<Database>,
  data: TestCashExchange,
): Promise<CreatedCashExchange> {
  const row = {
    user_id: data.user_id,
    amount: data.amount,
    status: data.status ?? 'pending',
    point_action_id: data.point_action_id ?? null,
    reason: data.reason ?? null,
    confirmed_at: data.confirmed_at ?? null,
    cancelled_at: data.cancelled_at ?? null,
    rejected_at: data.rejected_at ?? null,
    created_at: data.created_at ?? new Date().toISOString(),
    updated_at: data.updated_at ?? new Date().toISOString(),
  };

  const { data: result, error } = await supabase
    .from('cash_exchanges')
    .insert(row)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create cash_exchange: ${error.message}`);
  }

  return result as unknown as CreatedCashExchange;
}

/**
 * point_actions의 EXCHANGE_POINT_TO_CASH 행과 cash_exchanges 행을 한 번에 생성
 * (네이버페이 패턴 고려: point_actions는 status='done', cash_exchanges가 진짜 상태)
 */
export async function createExchangeRequest(
  supabase: SupabaseClient<Database>,
  params: {
    user_id: string;
    amount: number;
    cashExchangeStatus?: CashExchangeStatus;
    confirmed_at?: string | null;
    cancelled_at?: string | null;
    rejected_at?: string | null;
    reason?: string | null;
  },
): Promise<{ pointActionId: number; cashExchangeId: number }> {
  // 1. point_actions에 deduct 행 INSERT (status='done', 음수)
  const { data: pa, error: paErr } = await supabase
    .from('point_actions')
    .insert({
      user_id: params.user_id,
      type: 'EXCHANGE_POINT_TO_CASH',
      point_amount: -params.amount,
      status: 'done',
      additional_data: {},
    })
    .select('id')
    .single();

  if (paErr || !pa) {
    throw new Error(
      `Failed to create point_action: ${paErr?.message ?? 'unknown'}`,
    );
  }

  // 2. cash_exchanges에 INSERT
  const ce = await createCashExchange(supabase, {
    user_id: params.user_id,
    amount: params.amount,
    status: params.cashExchangeStatus ?? 'pending',
    point_action_id: pa.id,
    confirmed_at: params.confirmed_at ?? null,
    cancelled_at: params.cancelled_at ?? null,
    rejected_at: params.rejected_at ?? null,
    reason: params.reason ?? null,
  });

  return {
    pointActionId: pa.id,
    cashExchangeId: ce.id,
  };
}

/**
 * point_actions에서 EXCHANGE_POINT_TO_CASH 행을 모두 가져옴
 */
export async function findPointActionsForExchange(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<
  {
    id: number;
    point_amount: number;
    status: string;
    additional_data: Record<string, unknown> | null;
  }[]
> {
  const { data, error } = await supabase
    .from('point_actions')
    .select('id, point_amount, status, additional_data')
    .eq('user_id', userId)
    .eq('type', 'EXCHANGE_POINT_TO_CASH')
    .order('id', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch point_actions: ${error.message}`);
  }

  return (data ?? []) as unknown as {
    id: number;
    point_amount: number;
    status: string;
    additional_data: Record<string, unknown> | null;
  }[];
}

/**
 * cash_exchanges 행 조회 (point_action_id로)
 */
export async function findCashExchangeByPointActionId(
  supabase: SupabaseClient<Database>,
  pointActionId: number,
): Promise<CreatedCashExchange | null> {
  const { data, error } = await supabase
    .from('cash_exchanges')
    .select('*')
    .eq('point_action_id', pointActionId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as unknown as CreatedCashExchange;
}
