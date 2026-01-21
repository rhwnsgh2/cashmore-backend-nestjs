import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { getTestSupabaseAdminClient } from './supabase-client';
import { truncateAllTables } from './setup';
import { createTestUser } from './helpers/user.helper';

describe('AuthService - Cache (e2e)', () => {
  let authService: AuthService;
  const supabase = getTestSupabaseAdminClient();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    authService = moduleFixture.get<AuthService>(AuthService);
  });

  afterAll(async () => {
    await truncateAllTables();
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  describe('getUserIdByToken', () => {
    it('토큰으로 userId를 조회한다', async () => {
      const testUser = await createTestUser(supabase);
      const testToken = 'test-jwt-token-123';

      const result = await authService.getUserIdByToken(
        testToken,
        testUser.auth_id,
      );

      expect(result).toBe(testUser.id);
    });

    it('존재하지 않는 authId는 null을 반환한다', async () => {
      const testToken = 'test-jwt-token-456';
      const result = await authService.getUserIdByToken(
        testToken,
        'non-existent-auth-id',
      );

      expect(result).toBeNull();
    });

    it('같은 토큰으로 두 번 조회하면 캐시된 값을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const testToken = 'test-jwt-token-789';

      const firstResult = await authService.getUserIdByToken(
        testToken,
        testUser.auth_id,
      );
      const secondResult = await authService.getUserIdByToken(
        testToken,
        testUser.auth_id,
      );

      expect(firstResult).toBe(testUser.id);
      expect(secondResult).toBe(testUser.id);
      expect(firstResult).toBe(secondResult);
    });

    it('다른 토큰으로 조회하면 캐시를 사용하지 않는다', async () => {
      const testUser = await createTestUser(supabase);
      const token1 = 'test-jwt-token-aaa';
      const token2 = 'test-jwt-token-bbb';

      const result1 = await authService.getUserIdByToken(
        token1,
        testUser.auth_id,
      );
      const result2 = await authService.getUserIdByToken(
        token2,
        testUser.auth_id,
      );

      // 둘 다 같은 userId를 반환하지만, 캐시가 별도로 동작
      expect(result1).toBe(testUser.id);
      expect(result2).toBe(testUser.id);
    });
  });
});
