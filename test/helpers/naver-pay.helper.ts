import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/supabase/database.types';

export interface TestNaverPayAccount {
  id?: string;
  user_id: string;
  naver_unique_id?: string;
  dau_user_key?: string | null;
  dau_masking_id?: string | null;
  status?: 'connected' | 'disconnected' | 'failed';
  error_code?: string | null;
  connected_at?: string | null;
}

export async function createNaverPayAccount(
  supabase: SupabaseClient<Database>,
  data: TestNaverPayAccount,
) {
  const account = {
    user_id: data.user_id,
    naver_unique_id: data.naver_unique_id ?? 'test-unique-id',
    dau_user_key: data.dau_user_key ?? 'test-user-key',
    dau_masking_id: data.dau_masking_id ?? 'nav***',
    status: data.status ?? 'connected',
    error_code: data.error_code ?? null,
    connected_at: data.connected_at ?? new Date().toISOString(),
  };

  const { data: result, error } = await supabase
    .from('naver_pay_accounts' as any)
    .insert(account)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create naver pay account: ${error.message}`);
  }

  return result as any;
}
