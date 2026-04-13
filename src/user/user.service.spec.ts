import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserService } from './user.service';
import { USER_REPOSITORY } from './interfaces/user-repository.interface';
import { StubUserRepository } from './repositories/stub-user.repository';
import { USER_MODAL_REPOSITORY } from '../user-modal/interfaces/user-modal-repository.interface';
import { StubUserModalRepository } from '../user-modal/repositories/stub-user-modal.repository';
import { InvitationService } from '../invitation/invitation.service';
import { AmplitudeService } from '../amplitude/amplitude.service';

const mockInvitationService = {
  processInvitationReward: vi.fn(),
  grantReceiptPoint: vi.fn(),
};

describe('UserService', () => {
  let service: UserService;
  let repository: StubUserRepository;
  let modalRepository: StubUserModalRepository;

  beforeEach(async () => {
    repository = new StubUserRepository();
    modalRepository = new StubUserModalRepository();
    mockInvitationService.processInvitationReward.mockReset();
    mockInvitationService.grantReceiptPoint.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: USER_REPOSITORY,
          useValue: repository,
        },
        {
          provide: USER_MODAL_REPOSITORY,
          useValue: modalRepository,
        },
        {
          provide: InvitationService,
          useValue: mockInvitationService,
        },
        {
          provide: AmplitudeService,
          useValue: { track: vi.fn() },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  describe('getLastUsedProvider', () => {
    it('device_id에 해당하는 유저가 없으면 provider: null을 반환한다', async () => {
      const result = await service.getLastUsedProvider('unknown-device');
      expect(result.provider).toBeNull();
    });

    it('포인트가 가장 많은 유저의 provider를 반환한다', async () => {
      repository.setUser({
        id: 'user-1',
        email: 'a@test.com',
        auth_id: 'auth-1',
        created_at: '2026-01-01T00:00:00Z',
        marketing_info: false,
        is_banned: false,
        nickname: 'user1',
        provider: 'kakao',
      });
      repository.setUser({
        id: 'user-2',
        email: 'b@test.com',
        auth_id: 'auth-2',
        created_at: '2026-01-01T00:00:00Z',
        marketing_info: false,
        is_banned: false,
        nickname: 'user2',
        provider: 'apple',
      });
      repository.setUserDeviceId('user-1', 'device-abc');
      repository.setUserDeviceId('user-2', 'device-abc');
      repository.setPointTotal('user-1', 100);
      repository.setPointTotal('user-2', 500);
      repository.setAuthProvider('auth-2', 'apple');

      const result = await service.getLastUsedProvider('device-abc');

      expect(result.provider).toBe('apple');
    });

    it('유저가 1명이면 해당 유저의 provider를 반환한다', async () => {
      repository.setUser({
        id: 'user-1',
        email: 'a@test.com',
        auth_id: 'auth-1',
        created_at: '2026-01-01T00:00:00Z',
        marketing_info: false,
        is_banned: false,
        nickname: 'user1',
        provider: 'kakao',
      });
      repository.setUserDeviceId('user-1', 'device-abc');
      repository.setPointTotal('user-1', 100);
      repository.setAuthProvider('auth-1', 'kakao');

      const result = await service.getLastUsedProvider('device-abc');

      expect(result.provider).toBe('kakao');
    });
  });

  describe('deleteUser', () => {
    const userId = 'test-user-id';

    it('유저를 삭제하고 success: true를 반환한다', async () => {
      repository.setUser({
        id: userId,
        email: 'test@example.com',
        auth_id: 'auth-123',
        created_at: '2026-01-01T00:00:00Z',
        marketing_info: false,
        is_banned: false,
        nickname: 'tester',
        provider: 'kakao',
      });

      const result = await service.deleteUser(userId);

      expect(result.success).toBe(true);
      expect(result.message).toBe('계정이 삭제되었습니다.');
    });

    it('삭제 후 getUserInfo로 조회하면 null이다', async () => {
      repository.setUser({
        id: userId,
        email: 'test@example.com',
        auth_id: 'auth-123',
        created_at: '2026-01-01T00:00:00Z',
        marketing_info: false,
        is_banned: false,
        nickname: 'tester',
        provider: 'kakao',
      });

      await service.deleteUser(userId);

      const userInfo = await service.getUserInfo(userId);
      expect(userInfo).toBeNull();
    });

    it('존재하지 않는 유저 삭제도 에러 없이 success를 반환한다', async () => {
      const result = await service.deleteUser('non-existent-id');

      expect(result.success).toBe(true);
    });
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

  describe('createUser', () => {
    beforeEach(() => {
      repository.clear();
      modalRepository.clear();
    });

    it('새 사용자를 생성한다', async () => {
      repository.setAuthProvider('auth-new', 'kakao');

      const result = await service.createUser({
        authId: 'auth-new',
        email: 'new@example.com',
        marketingAgreement: true,
        onboardingCompleted: false,
      });

      expect(result.success).toBe(true);
      expect(result.userId).toBeTruthy();
      expect(result.nickname).toBeTruthy();
    });

    it('이미 가입된 사용자면 ConflictException을 던진다', async () => {
      repository.setUser({
        id: 'existing-id',
        email: 'existing@example.com',
        auth_id: 'auth-existing',
        created_at: '2025-01-01T00:00:00Z',
        marketing_info: false,
        is_banned: false,
        nickname: 'existing',
        provider: 'kakao',
      });

      await expect(
        service.createUser({
          authId: 'auth-existing',
          email: 'existing@example.com',
          marketingAgreement: false,
          onboardingCompleted: false,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('deviceId가 있고 첫 기기이면 joined 이벤트를 기록한다', async () => {
      repository.setAuthProvider('auth-new', 'apple');

      const result = await service.createUser({
        authId: 'auth-new',
        email: 'new@example.com',
        marketingAgreement: false,
        onboardingCompleted: false,
        deviceId: 'device-123',
      });

      expect(result.success).toBe(true);
      const events = repository.getDeviceEvents();
      expect(events.some((e) => e.event_name === 'joined')).toBe(true);
    });

    it('온보딩 완료 시 온보딩 모달과 포인트를 생성한다', async () => {
      repository.setAuthProvider('auth-new', 'kakao');

      const result = await service.createUser({
        authId: 'auth-new',
        email: 'new@example.com',
        marketingAgreement: false,
        onboardingCompleted: true,
        deviceId: 'device-123',
      });

      expect(result.success).toBe(true);

      // 온보딩 포인트 지급 확인
      const pointActions = repository.getPointActions();
      expect(
        pointActions.some(
          (p) => p.type === 'ONBOARDING_EVENT' && p.pointAmount === 40,
        ),
      ).toBe(true);
    });

    it('초대받지 않은 사용자에게 invite_code_input_lotto 모달을 생성한다', async () => {
      repository.setAuthProvider('auth-new', 'kakao');

      const result = await service.createUser({
        authId: 'auth-new',
        email: 'new@example.com',
        marketingAgreement: false,
        onboardingCompleted: false,
      });

      expect(result.success).toBe(true);

      const hasModal = await modalRepository.hasModalByName(
        result.userId!,
        'invite_code_input_lotto',
      );
      expect(hasModal).toBe(true);
    });

    it('deviceId가 없으면 디바이스 이벤트를 처리하지 않는다', async () => {
      repository.setAuthProvider('auth-new', 'kakao');

      await service.createUser({
        authId: 'auth-new',
        email: 'new@example.com',
        marketingAgreement: false,
        onboardingCompleted: true,
        // deviceId 없음
      });

      const events = repository.getDeviceEvents();
      expect(events).toHaveLength(0);

      const pointActions = repository.getPointActions();
      expect(pointActions.some((p) => p.type === 'ONBOARDING_EVENT')).toBe(
        false,
      );
    });

    it('이미 기기 이벤트가 있으면 joined 이벤트를 기록하지 않는다', async () => {
      repository.setAuthProvider('auth-new', 'apple');
      repository.setDeviceEvents([
        { device_id: 'device-existing', event_name: 'joined' },
      ]);

      await service.createUser({
        authId: 'auth-new',
        email: 'new@example.com',
        marketingAgreement: false,
        onboardingCompleted: true,
        deviceId: 'device-existing',
      });

      // 기존 1개만 있어야 함 (새로 추가 안 됨)
      const events = repository.getDeviceEvents();
      expect(events.filter((e) => e.event_name === 'joined')).toHaveLength(1);
    });

    it('온보딩 완료 시 onboarding 모달과 onboarding_event 디바이스 이벤트를 생성한다', async () => {
      repository.setAuthProvider('auth-new', 'kakao');

      const result = await service.createUser({
        authId: 'auth-new',
        email: 'new@example.com',
        marketingAgreement: false,
        onboardingCompleted: true,
        deviceId: 'device-123',
      });

      // 온보딩 모달 확인
      const hasOnboardingModal = await modalRepository.hasModalByName(
        result.userId!,
        'onboarding',
      );
      expect(hasOnboardingModal).toBe(true);

      // onboarding_event 디바이스 이벤트 확인
      const events = repository.getDeviceEvents();
      expect(events.some((e) => e.event_name === 'onboarding_event')).toBe(
        true,
      );
    });

    it('onboardingCompleted가 false면 온보딩 모달/포인트를 생성하지 않는다', async () => {
      repository.setAuthProvider('auth-new', 'kakao');

      const result = await service.createUser({
        authId: 'auth-new',
        email: 'new@example.com',
        marketingAgreement: false,
        onboardingCompleted: false,
        deviceId: 'device-123',
      });

      expect(result.success).toBe(true);

      const hasOnboardingModal = await modalRepository.hasModalByName(
        result.userId!,
        'onboarding',
      );
      expect(hasOnboardingModal).toBe(false);

      const pointActions = repository.getPointActions();
      expect(pointActions.some((p) => p.type === 'ONBOARDING_EVENT')).toBe(
        false,
      );
    });

    it('이미 초대받은 사용자에게는 invite 모달을 생성하지 않는다', async () => {
      repository.setAuthProvider('auth-new', 'kakao');

      const originalIsInvited = repository.isInvitedUser.bind(repository);
      repository.isInvitedUser = () => Promise.resolve(true);

      const result = await service.createUser({
        authId: 'auth-new',
        email: 'new@example.com',
        marketingAgreement: false,
        onboardingCompleted: false,
      });

      expect(result.success).toBe(true);

      const hasModal = await modalRepository.hasModalByName(
        result.userId!,
        'invite_code_input_lotto',
      );
      expect(hasModal).toBe(false);

      repository.isInvitedUser = originalIsInvited;
    });
  });

  describe('completeOnboarding', () => {
    const userId = 'onboarding-user-id';

    beforeEach(() => {
      repository.clear();
      modalRepository.clear();
    });

    it('온보딩을 완료하고 포인트를 지급한다', async () => {
      repository.setDeviceEvents([
        { device_id: 'device-123', event_name: 'joined' },
      ]);

      const result = await service.completeOnboarding(userId);

      expect(result.success).toBe(true);
      expect(result.pointAmount).toBe(40);

      const pointActions = repository.getPointActions();
      expect(
        pointActions.some(
          (p) => p.type === 'ONBOARDING_EVENT' && p.pointAmount === 40,
        ),
      ).toBe(true);

      const hasModal = await modalRepository.hasModalByName(
        userId,
        'onboarding',
      );
      expect(hasModal).toBe(true);
    });

    it('이미 온보딩을 완료한 경우 실패를 반환한다', async () => {
      repository.setDeviceEvents([
        { device_id: 'device-123', event_name: 'joined' },
        { device_id: 'device-123', event_name: 'onboarding_event' },
      ]);

      const result = await service.completeOnboarding(userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('이미 온보딩을 완료했습니다.');
    });

    it('디바이스 정보가 없으면 실패를 반환한다', async () => {
      // deviceEvents가 비어있으면 findDeviceId가 null 반환
      const result = await service.completeOnboarding(userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('디바이스 정보를 찾을 수 없습니다.');
    });
  });

  describe('updateNickname', () => {
    const userId = 'user-1';

    function seedUser(nickname: string | null = 'oldnick') {
      repository.setUser({
        id: userId,
        email: 'a@test.com',
        auth_id: 'auth-1',
        created_at: '2026-01-01T00:00:00Z',
        marketing_info: false,
        is_banned: false,
        nickname,
        provider: 'kakao',
      });
    }

    it('닉네임을 변경하고 이력을 저장한다', async () => {
      seedUser('oldnick');

      const result = await service.updateNickname(userId, 'newnick');

      expect(result.success).toBe(true);
      const user = await repository.findById(userId);
      expect(user?.nickname).toBe('newnick');
      const history = repository.getNicknameHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual({
        userId,
        before: 'oldnick',
        after: 'newnick',
      });
    });

    it('앞뒤 공백을 제거한 뒤 저장한다', async () => {
      seedUser('oldnick');

      await service.updateNickname(userId, '  spaced  ');

      const user = await repository.findById(userId);
      expect(user?.nickname).toBe('spaced');
      expect(repository.getNicknameHistory()[0].after).toBe('spaced');
    });

    it('이전 닉네임이 null이면 before는 빈 문자열로 기록된다', async () => {
      seedUser(null);

      await service.updateNickname(userId, 'first');

      expect(repository.getNicknameHistory()[0].before).toBe('');
    });

    it('다른 유저가 같은 닉네임을 쓰면 ConflictException', async () => {
      seedUser('oldnick');
      repository.setUser({
        id: 'user-2',
        email: 'b@test.com',
        auth_id: 'auth-2',
        created_at: '2026-01-01T00:00:00Z',
        marketing_info: false,
        is_banned: false,
        nickname: 'taken',
        provider: 'kakao',
      });

      await expect(service.updateNickname(userId, 'taken')).rejects.toThrow(
        ConflictException,
      );
    });

    it('본인 닉네임과 동일해도 중복으로 치지 않는다', async () => {
      seedUser('samenick');

      const result = await service.updateNickname(userId, 'samenick');

      expect(result.success).toBe(true);
    });

    it('존재하지 않는 유저면 NotFoundException', async () => {
      await expect(
        service.updateNickname('missing', 'anything'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('checkNicknameDuplicate', () => {
    const userId = 'user-1';

    beforeEach(() => {
      repository.setUser({
        id: userId,
        email: 'a@test.com',
        auth_id: 'auth-1',
        created_at: '2026-01-01T00:00:00Z',
        marketing_info: false,
        is_banned: false,
        nickname: 'mynick',
        provider: 'kakao',
      });
    });

    it('다른 유저가 같은 닉네임을 쓰면 isDuplicate: true', async () => {
      repository.setUser({
        id: 'user-2',
        email: 'b@test.com',
        auth_id: 'auth-2',
        created_at: '2026-01-01T00:00:00Z',
        marketing_info: false,
        is_banned: false,
        nickname: 'taken',
        provider: 'kakao',
      });

      const result = await service.checkNicknameDuplicate(userId, 'taken');

      expect(result.isDuplicate).toBe(true);
    });

    it('아무도 안 쓰는 닉네임이면 isDuplicate: false', async () => {
      const result = await service.checkNicknameDuplicate(userId, 'available');
      expect(result.isDuplicate).toBe(false);
    });

    it('본인 닉네임은 중복이 아니다', async () => {
      const result = await service.checkNicknameDuplicate(userId, 'mynick');
      expect(result.isDuplicate).toBe(false);
    });

    it('빈 문자열은 isDuplicate: false', async () => {
      const result = await service.checkNicknameDuplicate(userId, '');
      expect(result.isDuplicate).toBe(false);
    });

    it('공백만 있는 문자열은 isDuplicate: false', async () => {
      const result = await service.checkNicknameDuplicate(userId, '   ');
      expect(result.isDuplicate).toBe(false);
    });

    it('앞뒤 공백은 제거 후 비교한다', async () => {
      repository.setUser({
        id: 'user-2',
        email: 'b@test.com',
        auth_id: 'auth-2',
        created_at: '2026-01-01T00:00:00Z',
        marketing_info: false,
        is_banned: false,
        nickname: 'taken',
        provider: 'kakao',
      });

      const result = await service.checkNicknameDuplicate(userId, '  taken  ');
      expect(result.isDuplicate).toBe(true);
    });
  });
});
