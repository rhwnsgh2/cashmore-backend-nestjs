import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 테스트 전용 Supabase 설정 (.env.test에서 읽음)
const TEST_SUPABASE_URL = process.env.SUPABASE_URL!;
const TEST_SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const TEST_SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

let testClient: SupabaseClient | null = null;
let testAdminClient: SupabaseClient | null = null;

/**
 * 테스트용 Supabase 클라이언트 (anon key)
 * RLS 정책이 적용됨
 */
export function getTestSupabaseClient(): SupabaseClient {
  if (!testClient) {
    testClient = createClient(TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY);
  }
  return testClient;
}

/**
 * 테스트용 Supabase Admin 클라이언트 (service role key)
 * RLS 정책 우회, 테스트 데이터 설정에 사용
 */
export function getTestSupabaseAdminClient(): SupabaseClient {
  if (!testAdminClient) {
    testAdminClient = createClient(
      TEST_SUPABASE_URL,
      TEST_SUPABASE_SERVICE_ROLE_KEY,
    );
  }
  return testAdminClient;
}
