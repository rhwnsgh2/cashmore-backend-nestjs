import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { USER_REPOSITORY } from './interfaces/user-repository.interface';
import { StubUserRepository } from './repositories/stub-user.repository';

describe('UserService', () => {
  let service: UserService;
  let repository: StubUserRepository;

  beforeEach(async () => {
    repository = new StubUserRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: USER_REPOSITORY,
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  describe('getUserInfo', () => {
    const userId = 'test-user-id';

    beforeEach(() => {
      repository.clear();
    });

    it('사용자 정보를 조회한다', async () => {
      repository.setUser({
        id: userId,
        email: 'test@example.com',
        auth_id: 'auth-123',
        created_at: '2025-01-01T00:00:00Z',
        marketing_info: true,
        is_banned: false,
        nickname: 'testuser',
        provider: 'kakao',
      });

      const result = await service.getUserInfo(userId);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(userId);
      expect(result!.email).toBe('test@example.com');
      expect(result!.nickname).toBe('testuser');
      expect(result!.provider).toBe('kakao');
      expect(result!.marketingAgreement).toBe(true);
      expect(result!.isBanned).toBe(false);
      expect(result!.role).toBe('user');
    });

    it('닉네임이 없으면 자동 생성하고 업데이트한다', async () => {
      repository.setUser({
        id: userId,
        email: 'test@example.com',
        auth_id: 'auth-123',
        created_at: '2025-01-01T00:00:00Z',
        marketing_info: false,
        is_banned: false,
        nickname: null,
        provider: 'apple',
      });

      const result = await service.getUserInfo(userId);

      expect(result).not.toBeNull();
      expect(result!.nickname).toBeTruthy();
      expect(result!.nickname.length).toBeGreaterThan(0);
    });

    it('차단된 사용자는 isBanned=true와 banReason을 반환한다', async () => {
      repository.setUser({
        id: userId,
        email: 'banned@example.com',
        auth_id: 'auth-banned',
        created_at: '2025-01-01T00:00:00Z',
        marketing_info: false,
        is_banned: true,
        nickname: 'banneduser',
        provider: 'kakao',
      });
      repository.setBanReason('auth-banned', '부정 사용');

      const result = await service.getUserInfo(userId);

      expect(result).not.toBeNull();
      expect(result!.isBanned).toBe(true);
      expect(result!.banReason).toBe('부정 사용');
    });

    it('is_banned=true지만 banned_user에 없으면 isBanned=false', async () => {
      repository.setUser({
        id: userId,
        email: 'test@example.com',
        auth_id: 'auth-123',
        created_at: '2025-01-01T00:00:00Z',
        marketing_info: false,
        is_banned: true,
        nickname: 'testuser',
        provider: 'kakao',
      });
      // banReason을 설정하지 않음

      const result = await service.getUserInfo(userId);

      expect(result).not.toBeNull();
      expect(result!.isBanned).toBe(false);
      expect(result!.banReason).toBeNull();
    });

    it('존재하지 않는 사용자는 null을 반환한다', async () => {
      const result = await service.getUserInfo('non-existent-id');

      expect(result).toBeNull();
    });

    it('email이 null이면 빈 문자열로 반환한다', async () => {
      repository.setUser({
        id: userId,
        email: null,
        auth_id: 'auth-123',
        created_at: '2025-01-01T00:00:00Z',
        marketing_info: false,
        is_banned: false,
        nickname: 'testuser',
        provider: 'apple',
      });

      const result = await service.getUserInfo(userId);

      expect(result).not.toBeNull();
      expect(result!.email).toBe('');
    });
  });
});
