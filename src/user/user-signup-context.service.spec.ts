import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { USER_REPOSITORY } from './interfaces/user-repository.interface';
import { StubUserRepository } from './repositories/stub-user.repository';
import { USER_MODAL_REPOSITORY } from '../user-modal/interfaces/user-modal-repository.interface';
import { StubUserModalRepository } from '../user-modal/repositories/stub-user-modal.repository';
import { InvitationService } from '../invitation/invitation.service';
import { AmplitudeService } from '../amplitude/amplitude.service';
import { SignupType } from './dto/create-user.dto';

const mockInvitationService = {
  processInvitationReward: vi.fn(),
  grantReceiptPoint: vi.fn(),
};

describe('UserService - signupContext', () => {
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

  describe('signupContext 없음 (기존 플로우)', () => {
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
  });

  describe('invitation_normal 가입', () => {
    beforeEach(() => {
      repository.clear();
      modalRepository.clear();
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
      expect(mockInvitationService.processInvitationReward).toHaveBeenCalled();

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

  describe('invitation_receipt 가입', () => {
    beforeEach(() => {
      repository.clear();
      modalRepository.clear();
    });

    it('invitation_receipt 성공 시 기존 초대 보상이 처리된다', async () => {
      repository.setAuthProvider('auth-new', 'kakao');
      mockInvitationService.processInvitationReward.mockResolvedValue({
        success: true,
        rewardPoint: 100,
      });
      mockInvitationService.grantReceiptPoint.mockResolvedValue({
        receiptPoint: 50,
      });

      const result = await service.createUser({
        authId: 'auth-new',
        email: 'new@example.com',
        marketingAgreement: false,
        onboardingCompleted: false,
        deviceId: 'device-123',
        signupContext: {
          type: SignupType.INVITATION_RECEIPT,
          invitationCode: 'ABC234',
          receiptId: 99,
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
        signupType: 'receipt',
        receiptId: 99,
      });
    });

    it('invitation_receipt 성공 시 영수증 포인트가 지급된다', async () => {
      repository.setAuthProvider('auth-new', 'kakao');
      mockInvitationService.processInvitationReward.mockResolvedValue({
        success: true,
        rewardPoint: 100,
      });
      mockInvitationService.grantReceiptPoint.mockResolvedValue({
        receiptPoint: 50,
      });

      const result = await service.createUser({
        authId: 'auth-new',
        email: 'new@example.com',
        marketingAgreement: false,
        onboardingCompleted: false,
        deviceId: 'device-123',
        signupContext: {
          type: SignupType.INVITATION_RECEIPT,
          invitationCode: 'ABC234',
          receiptId: 99,
        },
      });

      expect(result.success).toBe(true);

      // grantReceiptPoint가 호출되어야 함
      expect(mockInvitationService.grantReceiptPoint).toHaveBeenCalledWith({
        receiptId: 99,
        invitedUserId: result.userId,
      });

      // invitation_receipt_received 모달 생성 검증
      const hasReceiptModal = await modalRepository.hasModalByName(
        result.userId!,
        'invitation_receipt_received',
      );
      expect(hasReceiptModal).toBe(true);

      // additionalData에 point_amount 포함 검증
      const pendingModals = await modalRepository.findPendingByUserId(
        result.userId!,
      );
      const receiptModal = pendingModals.find(
        (m) => m.name === 'invitation_receipt_received',
      );
      expect(receiptModal?.additionalData).toEqual({ pointAmount: 50 });

      // invitation_receipt_onboarding 모달 생성 검증
      const hasOnboardingModal = await modalRepository.hasModalByName(
        result.userId!,
        'invitation_receipt_onboarding',
      );
      expect(hasOnboardingModal).toBe(true);
    });

    it('invitation_receipt 성공 시 invitation_lotto_result 모달이 생성된다', async () => {
      repository.setAuthProvider('auth-new', 'kakao');
      mockInvitationService.processInvitationReward.mockResolvedValue({
        success: true,
        rewardPoint: 100,
      });
      mockInvitationService.grantReceiptPoint.mockResolvedValue({
        receiptPoint: 50,
      });

      const result = await service.createUser({
        authId: 'auth-new',
        email: 'new@example.com',
        marketingAgreement: false,
        onboardingCompleted: false,
        deviceId: 'device-123',
        signupContext: {
          type: SignupType.INVITATION_RECEIPT,
          invitationCode: 'ABC234',
          receiptId: 99,
        },
      });

      expect(result.success).toBe(true);

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
      expect(lottoModal?.additionalData).toEqual({
        rewardPoint: 100,
        hasReceiptReward: true,
      });
    });

    it('invitation_receipt 초대 보상 실패 시 영수증 포인트도 지급되지 않는다', async () => {
      repository.setAuthProvider('auth-new', 'kakao');
      mockInvitationService.processInvitationReward.mockResolvedValue({
        success: false,
        error: '이미 초대 보상을 받은 디바이스입니다.',
      });

      const result = await service.createUser({
        authId: 'auth-new',
        email: 'new@example.com',
        marketingAgreement: false,
        onboardingCompleted: false,
        deviceId: 'device-123',
        signupContext: {
          type: SignupType.INVITATION_RECEIPT,
          invitationCode: 'ABC234',
          receiptId: 99,
        },
      });

      expect(result.success).toBe(true);

      // grantReceiptPoint가 호출되지 않아야 함
      expect(mockInvitationService.grantReceiptPoint).not.toHaveBeenCalled();

      // invitationReward 실패 응답
      expect(result.invitationReward).toBeDefined();
      expect(result.invitationReward!.success).toBe(false);
      expect(result.invitationReward!.receiptPoint).toBeUndefined();
    });

    it('invitation_receipt 초대 보상 예외 발생 시 영수증 포인트도 지급되지 않는다', async () => {
      repository.setAuthProvider('auth-new', 'kakao');
      mockInvitationService.processInvitationReward.mockRejectedValue(
        new Error('예외 발생'),
      );

      const result = await service.createUser({
        authId: 'auth-new',
        email: 'new@example.com',
        marketingAgreement: false,
        onboardingCompleted: false,
        deviceId: 'device-123',
        signupContext: {
          type: SignupType.INVITATION_RECEIPT,
          invitationCode: 'ABC234',
          receiptId: 99,
        },
      });

      expect(result.success).toBe(true);

      // grantReceiptPoint가 호출되지 않아야 함
      expect(mockInvitationService.grantReceiptPoint).not.toHaveBeenCalled();

      // invitationReward 실패 응답
      expect(result.invitationReward!.success).toBe(false);
      expect(result.invitationReward!.error).toBe('예외 발생');
      expect(result.invitationReward!.receiptPoint).toBeUndefined();
    });

    it('invitation_receipt 성공 시 invite_code_input_lotto 모달이 생성되지 않는다', async () => {
      repository.setAuthProvider('auth-new', 'kakao');
      mockInvitationService.processInvitationReward.mockResolvedValue({
        success: true,
        rewardPoint: 100,
      });
      mockInvitationService.grantReceiptPoint.mockResolvedValue({
        receiptPoint: 50,
      });

      const result = await service.createUser({
        authId: 'auth-new',
        email: 'new@example.com',
        marketingAgreement: false,
        onboardingCompleted: false,
        deviceId: 'device-123',
        signupContext: {
          type: SignupType.INVITATION_RECEIPT,
          invitationCode: 'ABC234',
          receiptId: 99,
        },
      });

      expect(result.success).toBe(true);

      // invite_code_input_lotto 모달은 생성되지 않아야 함
      const hasInviteModal = await modalRepository.hasModalByName(
        result.userId!,
        'invite_code_input_lotto',
      );
      expect(hasInviteModal).toBe(false);
    });

    it('invitation_receipt 성공 시 응답에 receiptPoint와 rewardPoint가 모두 포함된다', async () => {
      repository.setAuthProvider('auth-new', 'kakao');
      mockInvitationService.processInvitationReward.mockResolvedValue({
        success: true,
        rewardPoint: 100,
      });
      mockInvitationService.grantReceiptPoint.mockResolvedValue({
        receiptPoint: 50,
      });

      const result = await service.createUser({
        authId: 'auth-new',
        email: 'new@example.com',
        marketingAgreement: false,
        onboardingCompleted: false,
        deviceId: 'device-123',
        signupContext: {
          type: SignupType.INVITATION_RECEIPT,
          invitationCode: 'ABC234',
          receiptId: 99,
        },
      });

      expect(result.success).toBe(true);

      // invitationReward에 rewardPoint와 receiptPoint 모두 포함
      expect(result.invitationReward).toBeDefined();
      expect(result.invitationReward!.type).toBe(SignupType.INVITATION_RECEIPT);
      expect(result.invitationReward!.success).toBe(true);
      expect(result.invitationReward!.rewardPoint).toBe(100);
      expect(result.invitationReward!.receiptPoint).toBe(50);
    });
  });
});
