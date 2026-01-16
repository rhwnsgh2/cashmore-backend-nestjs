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

  describe('getUserIdByAuthId', () => {
    it('authId로 userId를 조회한다', async () => {
      const testUser = await createTestUser(supabase);

      const result = await authService.getUserIdByAuthId(testUser.auth_id);

      expect(result).toBe(testUser.id);
    });

    it('존재하지 않는 authId는 null을 반환한다', async () => {
      const result = await authService.getUserIdByAuthId(
        'non-existent-auth-id',
      );

      expect(result).toBeNull();
    });

    it('같은 authId를 두 번 조회하면 캐시된 값을 반환한다', async () => {
      const testUser = await createTestUser(supabase);

      const firstResult = await authService.getUserIdByAuthId(testUser.auth_id);
      const secondResult = await authService.getUserIdByAuthId(
        testUser.auth_id,
      );

      expect(firstResult).toBe(testUser.id);
      expect(secondResult).toBe(testUser.id);
      expect(firstResult).toBe(secondResult);
    });
  });
});
