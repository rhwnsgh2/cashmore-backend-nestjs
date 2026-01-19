import { describe, it, expect, beforeEach } from 'vitest';
import { getTestSupabaseClient } from './supabase-client.js';
import { truncateAllTables } from './setup.js';
import { SupabaseClient } from '@supabase/supabase-js';

describe('Supabase Connection', () => {
  const supabase: SupabaseClient = getTestSupabaseClient();

  beforeEach(async () => {
    await truncateAllTables();
  });

  it('should connect to test Supabase', async () => {
    const { error } = await supabase
      .from('_test_connection')
      .select('*')
      .limit(1);
    // 테이블이 없어도 연결은 성공해야 함
    expect(error?.message).not.toContain('fetch failed');
  });
});
