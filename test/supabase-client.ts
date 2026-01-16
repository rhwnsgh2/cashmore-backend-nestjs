import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 테스트 전용 Supabase 설정 (로컬 테스트 인스턴스)
// 절대로 프로덕션/개발 환경에서 import하지 마세요!
const TEST_SUPABASE_URL = 'http://localhost:54331';
const TEST_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const TEST_SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

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
