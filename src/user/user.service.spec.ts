import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { UserService } from './user.service';
import { USER_REPOSITORY } from './interfaces/user-repository.interface';
import { StubUserRepository } from './repositories/stub-user.repository';
import { USER_MODAL_REPOSITORY } from '../user-modal/interfaces/user-modal-repository.interface';
import { StubUserModalRepository } from '../user-modal/repositories/stub-user-modal.repository';
import { InvitationService } from '../invitation/invitation.service';
import { SignupType } from './dto/create-user.dto';

const mockInvitationService = {
  processInvitationReward: vi.fn(),
};

describe('UserService', () => {
  let service: UserService;
  let repository: StubUserRepository;
  let modalRepository: StubUserModalRepository;

  beforeEach(async () => {
    repository = new StubUserRepository();
    modalRepository = new StubUserModalRepository();
    mockInvitationService.processInvitationReward.mockReset();

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

  describe('createUser - signupContext', () => {
    beforeEach(() => {
      repository.clear();
      modalRepository.clear();
    });

    it('signupContext 없이 호출하면 기존 플로우대로 invite 모달을 생성한다', async () => {
      repository.setAuthProvider('auth-new', 'kakao');

      const result = await service.createUser({
        authId: 'auth-new',
        email: 'new@example.com',
        marketingAgreement: false,
        onboardingCompleted: false,
      });

      expect(result.success).toBe(true);

      // invite 모달이 생성되어야 함 (기존 플로우)
      const hasModal = await modalRepository.hasModalByName(
        result.userId!,
        'invite_code_input_lotto',
      );
      expect(hasModal).toBe(true);

      // processInvitationReward는 호출되지 않아야 함
      expect(
        mockInvitationService.processInvitationReward,
      ).not.toHaveBeenCalled();

      // invitationReward 없음
      expect(result.invitationReward).toBeUndefined();
    });

    it('invitation_normal이면 processInvitationReward를 호출한다', async () => {
      repository.setAuthProvider('auth-new', 'kakao');
      mockInvitationService.processInvitationReward.mockResolvedValue({
        success: true,
        rewardPoint: 100,
      });

      const result = await service.createUser({
        authId: 'auth-new',
        email: 'new@example.com',
        marketingAgreement: false,
        onboardingCompleted: false,
        deviceId: 'device-123',
        signupContext: {
          type: SignupType.INVITATION_NORMAL,
          invitationCode: 'ABC234',
        },
      });

      expect(result.success).toBe(true);

      // processInvitationReward가 호출되어야 함
      expect(
        mockInvitationService.processInvitationReward,
      ).toHaveBeenCalledWith({
        invitedUserId: result.userId,
        inviteCode: 'ABC234',
        deviceId: 'device-123',
      });

      // invitationReward 응답 검증
      expect(result.invitationReward).toEqual({
        type: SignupType.INVITATION_NORMAL,
        success: true,
        rewardPoint: 100,
      });

      // invitation_lotto_result 모달 생성 검증
      const hasLottoModal = await modalRepository.hasModalByName(
        result.userId!,
        'invitation_lotto_result',
      );
      expect(hasLottoModal).toBe(true);

      // additionalData에 rewardPoint 포함 검증
      const pendingModals = await modalRepository.findPendingByUserId(
        result.userId!,
      );
      const lottoModal = pendingModals.find(
        (m) => m.name === 'invitation_lotto_result',
      );
      expect(lottoModal?.additionalData).toEqual({ rewardPoint: 100 });
    });

    it('invitation_normal이면 invite_code_input_lotto 모달을 생성하지 않는다', async () => {
      repository.setAuthProvider('auth-new', 'kakao');
      mockInvitationService.processInvitationReward.mockResolvedValue({
        success: true,
        rewardPoint: 100,
      });

      const result = await service.createUser({
        authId: 'auth-new',
        email: 'new@example.com',
        marketingAgreement: false,
        onboardingCompleted: false,
        signupContext: {
          type: SignupType.INVITATION_NORMAL,
          invitationCode: 'ABC234',
        },
      });

      expect(result.success).toBe(true);

      const hasModal = await modalRepository.hasModalByName(
        result.userId!,
        'invite_code_input_lotto',
      );
      expect(hasModal).toBe(false);
    });

    it('invitation_normal에서 보상 처리가 실패해도 가입은 성공한다', async () => {
      repository.setAuthProvider('auth-new', 'kakao');
      mockInvitationService.processInvitationReward.mockRejectedValue(
        new Error('보상 처리 실패'),
      );

      const result = await service.createUser({
        authId: 'auth-new',
        email: 'new@example.com',
        marketingAgreement: false,
        onboardingCompleted: false,
        signupContext: {
          type: SignupType.INVITATION_NORMAL,
          invitationCode: 'INVALID',
        },
      });

      expect(result.success).toBe(true);
      expect(result.userId).toBeTruthy();

      // invitationReward 실패 응답
      expect(result.invitationReward).toBeDefined();
      expect(result.invitationReward!.type).toBe(SignupType.INVITATION_NORMAL);
      expect(result.invitationReward!.success).toBe(false);
      expect(result.invitationReward!.error).toBe('보상 처리 실패');

      // 실패 시 invitation_lotto_result 모달은 생성되지 않아야 함
      const hasLottoModal = await modalRepository.hasModalByName(
        result.userId!,
        'invitation_lotto_result',
      );
      expect(hasLottoModal).toBe(false);
    });

    it('invitation_normal에서 processInvitationReward가 success:false를 반환하면 모달을 생성하지 않는다', async () => {
      repository.setAuthProvider('auth-new', 'kakao');
      mockInvitationService.processInvitationReward.mockResolvedValue({
        success: false,
        error: '올바른 초대 코드를 입력해주세요',
      });

      const result = await service.createUser({
        authId: 'auth-new',
        email: 'new@example.com',
        marketingAgreement: false,
        onboardingCompleted: false,
        deviceId: 'device-123',
        signupContext: {
          type: SignupType.INVITATION_NORMAL,
          invitationCode: 'ZZZZZZ',
        },
      });

      expect(result.success).toBe(true);

      // invitationReward 실패 응답
      expect(result.invitationReward).toEqual({
        type: SignupType.INVITATION_NORMAL,
        success: false,
        error: '올바른 초대 코드를 입력해주세요',
      });

      // invitation_lotto_result 모달은 생성되지 않아야 함
      const hasLottoModal = await modalRepository.hasModalByName(
        result.userId!,
        'invitation_lotto_result',
      );
      expect(hasLottoModal).toBe(false);

      // invite_code_input_lotto 모달도 생성되지 않아야 함
      const hasInviteModal = await modalRepository.hasModalByName(
        result.userId!,
        'invite_code_input_lotto',
      );
      expect(hasInviteModal).toBe(false);
    });

    it('invitation_receipt이면 보상 처리 없이 가입 성공하고 모달을 생성하지 않는다', async () => {
      repository.setAuthProvider('auth-new', 'kakao');

      const result = await service.createUser({
        authId: 'auth-new',
        email: 'new@example.com',
        marketingAgreement: false,
        onboardingCompleted: false,
        signupContext: {
          type: SignupType.INVITATION_RECEIPT,
          invitationCode: 'ABC234',
        },
      });

      expect(result.success).toBe(true);

      // processInvitationReward 호출 안 됨
      expect(
        mockInvitationService.processInvitationReward,
      ).not.toHaveBeenCalled();

      // invite_code_input_lotto 모달 생성 안 됨
      const hasInviteModal = await modalRepository.hasModalByName(
        result.userId!,
        'invite_code_input_lotto',
      );
      expect(hasInviteModal).toBe(false);

      // invitation_lotto_result 모달도 생성 안 됨
      const hasLottoModal = await modalRepository.hasModalByName(
        result.userId!,
        'invitation_lotto_result',
      );
      expect(hasLottoModal).toBe(false);

      // invitationReward 응답 검증
      expect(result.invitationReward).toEqual({
        type: SignupType.INVITATION_RECEIPT,
        success: true,
      });
    });

    it('invitation_normal + 온보딩 완료 시 온보딩 처리와 초대 보상이 모두 실행된다', async () => {
      repository.setAuthProvider('auth-new', 'kakao');
      mockInvitationService.processInvitationReward.mockResolvedValue({
        success: true,
        rewardPoint: 100,
      });

      const result = await service.createUser({
        authId: 'auth-new',
        email: 'new@example.com',
        marketingAgreement: false,
        onboardingCompleted: true,
        deviceId: 'device-123',
        signupContext: {
          type: SignupType.INVITATION_NORMAL,
          invitationCode: 'ABC234',
        },
      });

      expect(result.success).toBe(true);

      // 온보딩 포인트 지급 확인
      const pointActions = repository.getPointActions();
      expect(
        pointActions.some(
          (p) => p.type === 'ONBOARDING_EVENT' && p.pointAmount === 40,
        ),
      ).toBe(true);

      // 초대 보상도 호출됨
      expect(
        mockInvitationService.processInvitationReward,
      ).toHaveBeenCalled();

      // invite_code_input_lotto 모달은 생성 안 됨
      const hasInviteModal = await modalRepository.hasModalByName(
        result.userId!,
        'invite_code_input_lotto',
      );
      expect(hasInviteModal).toBe(false);

      // onboarding 모달 + invitation_lotto_result 모달 둘 다 생성됨
      const hasOnboardingModal = await modalRepository.hasModalByName(
        result.userId!,
        'onboarding',
      );
      expect(hasOnboardingModal).toBe(true);

      const hasLottoModal = await modalRepository.hasModalByName(
        result.userId!,
        'invitation_lotto_result',
      );
      expect(hasLottoModal).toBe(true);
    });
  });
});
