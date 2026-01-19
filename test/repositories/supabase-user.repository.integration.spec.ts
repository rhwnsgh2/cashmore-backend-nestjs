import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { SupabaseUserRepository } from '../../src/user/repositories/supabase-user.repository';
import { SupabaseService } from '../../src/supabase/supabase.service';
import { getTestSupabaseAdminClient } from '../supabase-client';
import { truncateAllTables } from '../setup';
import { createTestUser, TestUser } from '../helpers/user.helper';
import configuration from '../../src/config/configuration';

describe('SupabaseUserRepository', () => {
  let repository: SupabaseUserRepository;
  let module: TestingModule;
  const supabase = getTestSupabaseAdminClient();

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [configuration],
          envFilePath: '.env.test',
        }),
      ],
      providers: [SupabaseService, SupabaseUserRepository],
    }).compile();

    repository = module.get<SupabaseUserRepository>(SupabaseUserRepository);
  });

  afterAll(async () => {
    await truncateAllTables();
    await module.close();
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  describe('findById', () => {
    it('존재하는 사용자를 반환한다', async () => {
      const testUser = await createTestUser(supabase, {
        nickname: 'test-nickname',
      });

      const result = await repository.findById(testUser.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(testUser.id);
      expect(result!.nickname).toBe('test-nickname');
      expect(result!.auth_id).toBe(testUser.auth_id);
      expect(result!.email).toBe(testUser.email);
      expect(result!.marketing_info).toBe(false);
      expect(result!.is_banned).toBe(false);
      expect(result!.provider).toBe('other');
    });

    it('존재하지 않는 사용자는 null을 반환한다', async () => {
      const nonExistentUuid = '00000000-0000-0000-0000-000000000000';
      const result = await repository.findById(nonExistentUuid);

      expect(result).toBeNull();
    });

    it('marketing_info가 true인 사용자를 올바르게 반환한다', async () => {
      const testUser = await createTestUser(supabase, {
        marketing_info: true,
      });

      const result = await repository.findById(testUser.id);

      expect(result).not.toBeNull();
      expect(result!.marketing_info).toBe(true);
    });

    it('provider가 kakao인 사용자를 올바르게 반환한다', async () => {
      const testUser = await createTestUser(supabase, {
        provider: 'kakao',
      });

      const result = await repository.findById(testUser.id);

      expect(result).not.toBeNull();
      expect(result!.provider).toBe('kakao');
    });
  });

  describe('updateNickname', () => {
    let testUser: TestUser;

    beforeEach(async () => {
      testUser = await createTestUser(supabase, {
        nickname: 'original-nickname',
      });
    });

    it('닉네임을 업데이트한다', async () => {
      await repository.updateNickname(testUser.id, 'new-nickname');

      const result = await repository.findById(testUser.id);

      expect(result).not.toBeNull();
      expect(result!.nickname).toBe('new-nickname');
    });

    it('다른 필드는 변경하지 않는다', async () => {
      const originalUser = await repository.findById(testUser.id);

      await repository.updateNickname(testUser.id, 'new-nickname');

      const updatedUser = await repository.findById(testUser.id);

      expect(updatedUser!.email).toBe(originalUser!.email);
      expect(updatedUser!.marketing_info).toBe(originalUser!.marketing_info);
      expect(updatedUser!.provider).toBe(originalUser!.provider);
    });

    it('존재하지 않는 사용자 업데이트는 에러를 발생시키지 않는다', async () => {
      // Supabase update는 존재하지 않는 row에 대해 에러를 발생시키지 않음
      // 유효한 UUID 형식이지만 존재하지 않는 ID 사용
      const nonExistentUuid = '00000000-0000-0000-0000-000000000000';
      // 에러 없이 완료되어야 함
      await repository.updateNickname(nonExistentUuid, 'new-nickname');
      // 테스트가 여기까지 도달하면 성공
      expect(true).toBe(true);
    });
  });

  describe('findBanReason', () => {
    it('차단된 사용자의 ban reason을 반환한다', async () => {
      const testUser = await createTestUser(supabase);

      // banned_user 테이블에 추가
      await supabase.from('banned_user').insert({
        auth_id: testUser.auth_id,
        reason: '부정 사용',
      });

      const result = await repository.findBanReason(testUser.auth_id);

      expect(result).toBe('부정 사용');
    });

    it('차단되지 않은 사용자는 null을 반환한다', async () => {
      const testUser = await createTestUser(supabase);

      const result = await repository.findBanReason(testUser.auth_id);

      expect(result).toBeNull();
    });

    it('존재하지 않는 auth_id는 null을 반환한다', async () => {
      const nonExistentUuid = '00000000-0000-0000-0000-000000000000';
      const result = await repository.findBanReason(nonExistentUuid);

      expect(result).toBeNull();
    });
  });
});
