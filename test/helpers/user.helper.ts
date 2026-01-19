import { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { UserProvider } from 'src/user/interfaces/user-repository.interface';

export interface TestUser {
  id: string;
  auth_id: string;
  email?: string;
  nickname?: string;
  marketing_info: boolean;
  provider: UserProvider;
}

/**
 * 테스트용 유저 생성
 * 1. auth.users에 먼저 생성 (FK 제약조건)
 * 2. user 테이블에 생성
 */
export async function createTestUser(
  supabase: SupabaseClient,
  overrides: Partial<TestUser> = {},
): Promise<TestUser> {
  const email = overrides.email ?? `test-${Date.now()}@test.com`;

  // 1. auth.users에 먼저 생성
  const { data: authUser, error: authError } =
    await supabase.auth.admin.createUser({
      email,
      password: 'test-password-123',
      email_confirm: true,
    });

  if (authError || !authUser.user) {
    throw new Error(`Failed to create auth user: ${authError?.message}`);
  }

  // 2. user 테이블에 생성
  const user: TestUser = {
    id: overrides.id ?? randomUUID(),
    auth_id: authUser.user.id,
    email,
    nickname: overrides.nickname ?? 'test-user',
    marketing_info: overrides.marketing_info ?? false,
    provider: overrides.provider ?? 'other',
  };

  const { error } = await supabase.from('user').insert(user);

  if (error) {
    throw new Error(`Failed to create test user: ${error.message}`);
  }

  return user;
}

/**
 * 여러 테스트 유저 생성
 */
export async function createTestUsers(
  supabase: SupabaseClient,
  count: number,
): Promise<TestUser[]> {
  const users: TestUser[] = [];

  for (let i = 0; i < count; i++) {
    const user = await createTestUser(supabase, {
      nickname: `test-user-${i}`,
    });
    users.push(user);
  }

  return users;
}

/**
 * 특정 테스트 유저 삭제
 */
export async function deleteTestUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await supabase.from('user').delete().eq('id', userId);

  if (error) {
    throw new Error(`Failed to delete test user: ${error.message}`);
  }
}

/**
 * 모든 테스트 유저 삭제
 */
export async function deleteAllTestUsers(
  supabase: SupabaseClient,
): Promise<void> {
  const { error } = await supabase.from('user').delete().neq('id', '');

  if (error) {
    throw new Error(`Failed to delete all test users: ${error.message}`);
  }
}
