import { Test, TestingModule } from '@nestjs/testing';
import { InvitationService } from './invitation.service';
import {
  INVITATION_REPOSITORY,
  Invitation,
} from './interfaces/invitation-repository.interface';
import { PARTNER_PROGRAM_REPOSITORY } from './interfaces/partner-program-repository.interface';
import { StubInvitationRepository } from './repositories/stub-invitation.repository';
import { StubPartnerProgramRepository } from './repositories/stub-partner-program.repository';
import { USER_MODAL_REPOSITORY } from '../user-modal/interfaces/user-modal-repository.interface';
import { StubUserModalRepository } from '../user-modal/repositories/stub-user-modal.repository';
import { FcmService } from '../fcm/fcm.service';
import { SlackService } from '../slack/slack.service';
import { POINT_WRITE_SERVICE } from '../point-write/point-write.interface';
import { PointWriteService } from '../point-write/point-write.service';
import { StubPointWriteRepository } from '../point-write/repositories/stub-point-write.repository';

describe('InvitationService', () => {
  let service: InvitationService;
  let repository: StubInvitationRepository;
  let partnerRepository: StubPartnerProgramRepository;
  let modalRepository: StubUserModalRepository;
  let pointWriteRepo: StubPointWriteRepository;

  beforeEach(async () => {
    pointWriteRepo = new StubPointWriteRepository();
    repository = new StubInvitationRepository(pointWriteRepo);
    partnerRepository = new StubPartnerProgramRepository();
    modalRepository = new StubUserModalRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationService,
        {
          provide: INVITATION_REPOSITORY,
          useValue: repository,
        },
        {
          provide: PARTNER_PROGRAM_REPOSITORY,
          useValue: partnerRepository,
        },
        {
          provide: USER_MODAL_REPOSITORY,
          useValue: modalRepository,
        },
        {
          provide: FcmService,
          useValue: {
            sendRefreshMessage: async () => {},
            pushNotification: async () => {},
          },
        },
        {
          provide: SlackService,
          useValue: {
            reportBugToSlack: async () => {},
            reportToInvitationNoti: async () => {},
          },
        },
        {
          provide: POINT_WRITE_SERVICE,
          useFactory: () => new PointWriteService(pointWriteRepo),
        },
      ],
    }).compile();

    service = module.get<InvitationService>(InvitationService);
  });

  describe('getOrCreateInvitation', () => {
    it('초대장이 없으면 새로 생성한다', async () => {
      const userId = 'test-user-id';

      const result = await service.getOrCreateInvitation(userId);

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
      expect(result.senderId).toBe(userId);
      expect(result.type).toBe('normal');
      expect(result.status).toBe('pending');
      expect(result.identifier).toHaveLength(6);
      expect(result.createdAt).toBeDefined();
    });

    it('이미 초대장이 있으면 기존 초대장을 반환한다', async () => {
      const userId = 'test-user-id';

      const first = await service.getOrCreateInvitation(userId);
      const second = await service.getOrCreateInvitation(userId);

      expect(first.id).toBe(second.id);
      expect(first.identifier).toBe(second.identifier);
      expect(first.senderId).toBe(second.senderId);
      expect(first.createdAt).toBe(second.createdAt);
    });

    it('setInvitation으로 미리 세팅된 초대장을 반환한다', async () => {
      const userId = 'test-user-id';
      const preset: Invitation = {
        id: 99,
        senderId: userId,
        createdAt: '2026-01-01T00:00:00.000Z',
        identifier: 'PRESET',
        type: 'normal',
        status: 'used',
      };
      repository.setInvitation(userId, preset);

      const result = await service.getOrCreateInvitation(userId);

      expect(result.id).toBe(99);
      expect(result.identifier).toBe('PRESET');
      expect(result.status).toBe('used');
    });

    it('다른 사용자는 다른 초대장을 받는다', async () => {
      const result1 = await service.getOrCreateInvitation('user-1');
      const result2 = await service.getOrCreateInvitation('user-2');

      expect(result1.id).not.toBe(result2.id);
      expect(result1.identifier).not.toBe(result2.identifier);
      expect(result1.senderId).toBe('user-1');
      expect(result2.senderId).toBe('user-2');
    });

    it('생성된 초대 코드는 허용된 문자만 포함한다', async () => {
      const result = await service.getOrCreateInvitation('test-user');

      // O, I, 0, 1 제외
      const validChars = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
      expect(result.identifier).toMatch(validChars);
    });
  });

  describe('verifyInvitationCode', () => {
    it('유효한 초대 코드이면 success: true를 반환한다', async () => {
      const inviter = await service.getOrCreateInvitation('inviter-id');

      const result = await service.verifyInvitationCode(
        'other-user-id',
        inviter.identifier,
      );

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('본인의 초대 코드이면 success: false를 반환한다', async () => {
      const inviter = await service.getOrCreateInvitation('inviter-id');

      const result = await service.verifyInvitationCode(
        'inviter-id',
        inviter.identifier,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('본인의 초대 코드는 사용할 수 없습니다.');
    });

    it('존재하지 않는 코드이면 success: false를 반환한다', async () => {
      const result = await service.verifyInvitationCode(
        'some-user',
        'NONEXIST',
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('올바른 초대 코드를 입력해주세요');
    });
  });

  describe('getPartnerStatus', () => {
    const userId = 'partner-user';
    const nowMs = Date.now();

    it('활성 파트너 프로그램이 있으면 isActive true와 기간을 반환한다', async () => {
      const program = {
        id: 42,
        userId,
        startsAt: new Date(nowMs - 24 * 60 * 60 * 1000).toISOString(),
        endsAt: new Date(nowMs + 24 * 60 * 60 * 1000).toISOString(),
      };
      partnerRepository.setProgram(program);

      const result = await service.getPartnerStatus(userId);

      expect(result).toEqual({
        isActive: true,
        startsAt: program.startsAt,
        endsAt: program.endsAt,
      });
    });

    it('활성 파트너 프로그램이 없으면 isActive false만 반환한다', async () => {
      const result = await service.getPartnerStatus(userId);

      expect(result).toEqual({ isActive: false });
    });

    it('프로그램이 있어도 기간 밖이면 isActive false를 반환한다', async () => {
      partnerRepository.setProgram({
        id: 99,
        userId,
        startsAt: new Date(nowMs - 48 * 60 * 60 * 1000).toISOString(),
        endsAt: new Date(nowMs - 60 * 60 * 1000).toISOString(),
      });

      const result = await service.getPartnerStatus(userId);

      expect(result).toEqual({ isActive: false });
    });

    it('다른 유저의 활성 프로그램은 영향을 주지 않는다', async () => {
      partnerRepository.setProgram({
        id: 100,
        userId: 'other-user',
        startsAt: new Date(nowMs - 24 * 60 * 60 * 1000).toISOString(),
        endsAt: new Date(nowMs + 24 * 60 * 60 * 1000).toISOString(),
      });

      const result = await service.getPartnerStatus(userId);

      expect(result).toEqual({ isActive: false });
    });
  });

  describe('getStepEvent', () => {
    const userId = 'test-user';

    it('초대장이 없으면 NotFoundException을 던진다', async () => {
      await expect(service.getStepEvent(userId)).rejects.toThrow(
        'Invitation not found',
      );
    });

    it('초대 수와 보상이 없으면 기본값을 반환한다', async () => {
      await service.getOrCreateInvitation(userId);

      const result = await service.getStepEvent(userId);

      expect(result.success).toBe(true);
      expect(result.invitationCount).toBe(0);
      expect(result.receivedRewards).toEqual([]);
      expect(result.totalPoints).toBe(0);
      expect(result.steps).toHaveLength(4);
    });

    it('초대 수에 따라 기본 포인트를 계산한다', async () => {
      const invitation = await service.getOrCreateInvitation(userId);
      repository.setInvitedUserCount(invitation.id, 5);

      const result = await service.getStepEvent(userId);

      expect(result.invitationCount).toBe(5);
      expect(result.totalPoints).toBe(5 * 300); // 1500
    });

    it('단계별 보상 포인트도 합산한다', async () => {
      const invitation = await service.getOrCreateInvitation(userId);
      repository.setInvitedUserCount(invitation.id, 5);
      repository.setStepRewards(userId, [{ stepCount: 3 }, { stepCount: 5 }]);

      const result = await service.getStepEvent(userId);

      expect(result.receivedRewards).toEqual([3, 5]);
      // 기본: 5 * 300 = 1500, 단계: 1000 + 2000 = 3000
      expect(result.totalPoints).toBe(4500);
    });
  });

  describe('claimStepReward', () => {
    const userId = 'test-user';

    it('초대장이 없으면 success: false를 반환한다', async () => {
      const result = await service.claimStepReward(userId, 3);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invitation not found');
    });

    it('초대 수가 부족하면 BadRequestException을 던진다', async () => {
      const invitation = await service.getOrCreateInvitation(userId);
      repository.setInvitedUserCount(invitation.id, 2);

      await expect(service.claimStepReward(userId, 3)).rejects.toThrow(
        'Current count is less than step count',
      );
    });

    it('존재하지 않는 단계이면 BadRequestException을 던진다', async () => {
      const invitation = await service.getOrCreateInvitation(userId);
      repository.setInvitedUserCount(invitation.id, 100);

      await expect(service.claimStepReward(userId, 99)).rejects.toThrow(
        'Eligible step not found',
      );
    });

    it('이미 수령한 보상이면 ConflictException을 던진다', async () => {
      const invitation = await service.getOrCreateInvitation(userId);
      repository.setInvitedUserCount(invitation.id, 5);
      repository.setStepRewards(userId, [{ stepCount: 3 }]);

      await expect(service.claimStepReward(userId, 3)).rejects.toThrow(
        'Already received step reward',
      );
    });

    it('조건을 충족하면 보상을 지급하고 success: true를 반환한다', async () => {
      const invitation = await service.getOrCreateInvitation(userId);
      repository.setInvitedUserCount(invitation.id, 3);

      const result = await service.claimStepReward(userId, 3);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('보상 지급 후 중복 수령이 불가능하다', async () => {
      const invitation = await service.getOrCreateInvitation(userId);
      repository.setInvitedUserCount(invitation.id, 3);

      await service.claimStepReward(userId, 3);

      await expect(service.claimStepReward(userId, 3)).rejects.toThrow(
        'Already received step reward',
      );
    });
  });

  describe('processInvitationReward', () => {
    const senderId = 'sender-user-id';
    const invitedUserId = 'invited-user-id';
    const deviceId = 'device-123';
    let invitation: Invitation;

    beforeEach(async () => {
      repository.clear();
      modalRepository.clear();

      // 초대자의 초대장 생성
      invitation = await service.getOrCreateInvitation(senderId);

      // 피초대자의 deviceId 설정
      repository.setUserDeviceId(invitedUserId, deviceId);
    });

    // === 성공 케이스 ===

    it('유효한 초대코드로 초대 보상을 처리한다', async () => {
      const result = await service.processInvitationReward({
        invitedUserId,
        inviteCode: invitation.identifier,
        deviceId,
      });

      expect(result.success).toBe(true);
      expect(result.rewardPoint).toBeDefined();
      expect(typeof result.rewardPoint).toBe('number');
    });

    it('초대 관계(invitation_user)를 생성한다', async () => {
      await service.processInvitationReward({
        invitedUserId,
        inviteCode: invitation.identifier,
        deviceId,
      });

      const invitationUsers = repository.getInvitationUsers();
      expect(invitationUsers).toHaveLength(1);
      expect(invitationUsers[0].invitationId).toBe(invitation.id);
      expect(invitationUsers[0].userId).toBe(invitedUserId);
    });

    it('초대자에게 INVITE_REWARD 300P를 지급한다', async () => {
      await service.processInvitationReward({
        invitedUserId,
        inviteCode: invitation.identifier,
        deviceId,
      });

      const pointActions = pointWriteRepo.getInsertedActions();
      const senderReward = pointActions.find(
        (p) => p.userId === senderId && p.type === 'INVITE_REWARD',
      );
      expect(senderReward).toBeDefined();
      expect(senderReward!.amount).toBe(300);
    });

    it('피초대자에게 INVITED_USER_REWARD_RANDOM 랜덤 포인트를 지급한다', async () => {
      await service.processInvitationReward({
        invitedUserId,
        inviteCode: invitation.identifier,
        deviceId,
      });

      const pointActions = pointWriteRepo.getInsertedActions();
      const invitedReward = pointActions.find(
        (p) =>
          p.userId === invitedUserId && p.type === 'INVITED_USER_REWARD_RANDOM',
      );
      expect(invitedReward).toBeDefined();
      expect([300, 500, 1000, 3000, 50000]).toContain(invitedReward!.amount);
    });

    it('피초대자의 디바이스에 invitation_reward 이벤트를 기록한다', async () => {
      await service.processInvitationReward({
        invitedUserId,
        inviteCode: invitation.identifier,
        deviceId,
      });

      const deviceEvents = repository.getDeviceEvents();
      expect(
        deviceEvents.some(
          (e) =>
            e.device_id === deviceId && e.event_name === 'invitation_reward',
        ),
      ).toBe(true);
    });

    it('초대자에게 invite_reward_received 모달을 생성한다', async () => {
      await service.processInvitationReward({
        invitedUserId,
        inviteCode: invitation.identifier,
        deviceId,
      });

      const hasModal = await modalRepository.hasModalByName(
        senderId,
        'invite_reward_received',
      );
      expect(hasModal).toBe(true);
    });

    // === 실패 케이스: 초대코드 검증 ===

    it('존재하지 않는 초대코드이면 실패한다', async () => {
      const result = await service.processInvitationReward({
        invitedUserId,
        inviteCode: 'NONEXIST',
        deviceId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('본인의 초대코드이면 실패한다', async () => {
      const result = await service.processInvitationReward({
        invitedUserId: senderId,
        inviteCode: invitation.identifier,
        deviceId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('본인');
    });

    it('invitation type이 normal이 아니면 실패한다', async () => {
      const defaultInvitation: Invitation = {
        id: 999,
        senderId: 'other-sender',
        createdAt: new Date().toISOString(),
        identifier: 'DEFAUL',
        type: 'default',
        status: 'pending',
      };
      repository.setInvitation('other-sender', defaultInvitation, 'default');

      const result = await service.processInvitationReward({
        invitedUserId,
        inviteCode: 'DEFAUL',
        deviceId,
      });

      expect(result.success).toBe(false);
    });

    // === 실패 케이스: 중복 보상 방지 ===

    it('이미 invitation_reward를 받은 디바이스면 보상을 지급하지 않는다', async () => {
      // 이미 다른 초대를 통해 보상을 받은 디바이스
      repository.setDeviceEvents([
        { device_id: deviceId, event_name: 'invitation_reward' },
      ]);

      const result = await service.processInvitationReward({
        invitedUserId,
        inviteCode: invitation.identifier,
        deviceId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('이미');
    });

    it('초대자에게 이미 해당 유저에 대한 INVITE_REWARD가 있으면 중복 보상하지 않는다', async () => {
      // 첫 번째 보상 처리
      await service.processInvitationReward({
        invitedUserId,
        inviteCode: invitation.identifier,
        deviceId,
      });

      // 같은 유저에 대해 다시 처리 시도
      const newDeviceId = 'device-456';
      repository.setUserDeviceId(invitedUserId, newDeviceId);

      const result = await service.processInvitationReward({
        invitedUserId,
        inviteCode: invitation.identifier,
        deviceId: newDeviceId,
      });

      expect(result.success).toBe(false);
    });

    // === 실패 케이스: 가입 시간 제한 ===

    it('가입 후 24시간이 초과한 유저는 초대 보상을 받을 수 없다', async () => {
      // 25시간 전에 가입한 유저
      const twentyFiveHoursAgo = new Date(
        Date.now() - 25 * 60 * 60 * 1000,
      ).toISOString();
      repository.setUserCreatedAt(invitedUserId, twentyFiveHoursAgo);

      const result = await service.processInvitationReward({
        invitedUserId,
        inviteCode: invitation.identifier,
        deviceId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('24시간');
    });

    it('가입 후 24시간 이내인 유저는 초대 보상을 받을 수 있다', async () => {
      // 23시간 전에 가입한 유저
      const twentyThreeHoursAgo = new Date(
        Date.now() - 23 * 60 * 60 * 1000,
      ).toISOString();
      repository.setUserCreatedAt(invitedUserId, twentyThreeHoursAgo);

      const result = await service.processInvitationReward({
        invitedUserId,
        inviteCode: invitation.identifier,
        deviceId,
      });

      expect(result.success).toBe(true);
    });

    // === 엣지 케이스 ===

    it('deviceId가 요청에도 DB에도 없으면 실패한다', async () => {
      const noDeviceUserId = 'no-device-user';
      const result = await service.processInvitationReward({
        invitedUserId: noDeviceUserId,
        inviteCode: invitation.identifier,
      });

      expect(result.success).toBe(false);
    });

    it('보상 처리 후 동일한 processInvitationReward를 다시 호출하면 실패한다', async () => {
      await service.processInvitationReward({
        invitedUserId,
        inviteCode: invitation.identifier,
        deviceId,
      });

      const result = await service.processInvitationReward({
        invitedUserId,
        inviteCode: invitation.identifier,
        deviceId,
      });

      expect(result.success).toBe(false);
    });

    it('서로 다른 피초대자는 같은 초대코드로 각각 보상을 받을 수 있다', async () => {
      const anotherInvitedUserId = 'another-invited-user';
      const anotherDeviceId = 'device-789';
      repository.setUserDeviceId(anotherInvitedUserId, anotherDeviceId);

      const result1 = await service.processInvitationReward({
        invitedUserId,
        inviteCode: invitation.identifier,
        deviceId,
      });

      const result2 = await service.processInvitationReward({
        invitedUserId: anotherInvitedUserId,
        inviteCode: invitation.identifier,
        deviceId: anotherDeviceId,
      });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // 초대자에게 INVITE_REWARD가 2건 지급되었는지 확인
      const pointActions = pointWriteRepo.getInsertedActions();
      const senderRewards = pointActions.filter(
        (p) => p.userId === senderId && p.type === 'INVITE_REWARD',
      );
      expect(senderRewards).toHaveLength(2);
    });

    it('랜덤 보상 금액은 허용된 값 중 하나이다', async () => {
      const allowedAmounts = [300, 500, 1000, 3000, 50000];

      const result = await service.processInvitationReward({
        invitedUserId,
        inviteCode: invitation.identifier,
        deviceId,
      });

      expect(result.success).toBe(true);
      expect(allowedAmounts).toContain(result.rewardPoint);
    });

    // === 파트너 프로그램 분기 ===

    describe('파트너 프로그램', () => {
      const nowMs = Date.now();
      const activeProgram = {
        id: 42,
        userId: senderId,
        startsAt: new Date(nowMs - 24 * 60 * 60 * 1000).toISOString(),
        endsAt: new Date(nowMs + 24 * 60 * 60 * 1000).toISOString(),
      };

      it('초대자가 활성 파트너 프로그램을 가지면 INVITE_REWARD가 500P로 지급된다', async () => {
        partnerRepository.setProgram(activeProgram);

        await service.processInvitationReward({
          invitedUserId,
          inviteCode: invitation.identifier,
          deviceId,
        });

        const pointActions = pointWriteRepo.getInsertedActions();
        const senderReward = pointActions.find(
          (p) => p.userId === senderId && p.type === 'INVITE_REWARD',
        );
        expect(senderReward).toBeDefined();
        expect(senderReward!.amount).toBe(500);
      });

      it('파트너 지급 시 additional_data에 partner_program_id를 담는다', async () => {
        partnerRepository.setProgram(activeProgram);

        await service.processInvitationReward({
          invitedUserId,
          inviteCode: invitation.identifier,
          deviceId,
        });

        const pointActions = pointWriteRepo.getInsertedActions();
        const senderReward = pointActions.find(
          (p) => p.userId === senderId && p.type === 'INVITE_REWARD',
        );
        expect(senderReward!.additionalData.partner_program_id).toBe(42);
      });

      it('파트너가 아니면 INVITE_REWARD는 기존 300P로 지급된다', async () => {
        // 파트너 프로그램 미등록

        await service.processInvitationReward({
          invitedUserId,
          inviteCode: invitation.identifier,
          deviceId,
        });

        const pointActions = pointWriteRepo.getInsertedActions();
        const senderReward = pointActions.find(
          (p) => p.userId === senderId && p.type === 'INVITE_REWARD',
        );
        expect(senderReward!.amount).toBe(300);
      });

      it('프로그램 종료 이후(ends_at 경과)에는 다시 300P로 지급된다', async () => {
        const expiredProgram = {
          id: 7,
          userId: senderId,
          startsAt: new Date(nowMs - 48 * 60 * 60 * 1000).toISOString(),
          endsAt: new Date(nowMs - 60 * 60 * 1000).toISOString(),
        };
        partnerRepository.setProgram(expiredProgram);

        await service.processInvitationReward({
          invitedUserId,
          inviteCode: invitation.identifier,
          deviceId,
        });

        const pointActions = pointWriteRepo.getInsertedActions();
        const senderReward = pointActions.find(
          (p) => p.userId === senderId && p.type === 'INVITE_REWARD',
        );
        expect(senderReward!.amount).toBe(300);
        expect(senderReward!.additionalData.partner_program_id).toBeUndefined();
      });

      it('프로그램 시작 이전에는 300P로 지급된다', async () => {
        const futureProgram = {
          id: 8,
          userId: senderId,
          startsAt: new Date(nowMs + 60 * 60 * 1000).toISOString(),
          endsAt: new Date(nowMs + 48 * 60 * 60 * 1000).toISOString(),
        };
        partnerRepository.setProgram(futureProgram);

        await service.processInvitationReward({
          invitedUserId,
          inviteCode: invitation.identifier,
          deviceId,
        });

        const pointActions = pointWriteRepo.getInsertedActions();
        const senderReward = pointActions.find(
          (p) => p.userId === senderId && p.type === 'INVITE_REWARD',
        );
        expect(senderReward!.amount).toBe(300);
      });

      it('영수증 초대 + 파트너 프로그램이면 500P INVITE_REWARD와 20P 영수증 보너스가 모두 지급된다', async () => {
        partnerRepository.setProgram(activeProgram);
        const receiptId = 12345;

        await service.processInvitationReward({
          invitedUserId,
          inviteCode: invitation.identifier,
          deviceId,
          signupType: 'receipt',
          receiptId,
        });

        const actions = pointWriteRepo.getInsertedActions();
        const inviteReward = actions.find(
          (p) => p.userId === senderId && p.type === 'INVITE_REWARD',
        );
        const receiptBonus = actions.find(
          (p) => p.userId === senderId && p.type === 'INVITATION_RECEIPT',
        );

        expect(inviteReward!.amount).toBe(500);
        expect(inviteReward!.additionalData.partner_program_id).toBe(42);
        expect(receiptBonus!.amount).toBe(20);
      });
    });
  });

  // === 파트너 프로그램: getStepEvent ===

  describe('getStepEvent (파트너 프로그램)', () => {
    const userId = 'partner-user';
    const nowMs = Date.now();
    const activeProgram = {
      id: 42,
      userId,
      startsAt: new Date(nowMs - 24 * 60 * 60 * 1000).toISOString(),
      endsAt: new Date(nowMs + 24 * 60 * 60 * 1000).toISOString(),
    };

    it('파트너면 프로그램 기간 내 초대만 카운트한다', async () => {
      const invitation = await service.getOrCreateInvitation(userId);
      partnerRepository.setProgram(activeProgram);
      // 프로그램 기간 내 5명 초대
      repository.setInvitedUserCountInRange(
        invitation.id,
        activeProgram.startsAt,
        activeProgram.endsAt,
        5,
      );
      // 기존 기준(2025-09-11 이후)으로는 30명 — 파트너 분기면 쓰이지 않아야 함
      repository.setInvitedUserCount(invitation.id, 30);

      const result = await service.getStepEvent(userId);

      expect(result.invitationCount).toBe(5);
    });

    it('파트너면 응답 steps가 PARTNER_INVITATION_STEPS다', async () => {
      await service.getOrCreateInvitation(userId);
      partnerRepository.setProgram(activeProgram);

      const result = await service.getStepEvent(userId);

      // 기획 확정 전 임시값이지만, 파트너 배열이 사용됨을 확인하기 위해
      // 기존 상수와 동일값일 수 있으므로 count 배열 형태만 assertion
      expect(result.steps).toHaveLength(4);
    });

    it('파트너면 파트너 프로그램 수령 이력만 receivedRewards로 반환한다', async () => {
      const invitation = await service.getOrCreateInvitation(userId);
      partnerRepository.setProgram(activeProgram);
      repository.setInvitedUserCountInRange(
        invitation.id,
        activeProgram.startsAt,
        activeProgram.endsAt,
        5,
      );
      // 일반 수령 이력 (파트너 이력 아님)
      repository.setStepRewards(userId, [{ stepCount: 3 }]);
      // 파트너 프로그램 수령 이력
      repository.setPartnerStepRewards(userId, activeProgram.id, [
        { stepCount: 5 },
      ]);

      const result = await service.getStepEvent(userId);

      expect(result.receivedRewards).toEqual([5]);
    });

    it('파트너가 아닐 때는 기존 동작을 유지한다', async () => {
      const invitation = await service.getOrCreateInvitation(userId);
      repository.setInvitedUserCount(invitation.id, 5);

      const result = await service.getStepEvent(userId);

      expect(result.invitationCount).toBe(5);
      expect(result.totalPoints).toBe(5 * 300);
    });

    it('파트너 basePoints는 count × 500으로 계산된다', async () => {
      const invitation = await service.getOrCreateInvitation(userId);
      partnerRepository.setProgram(activeProgram);
      repository.setInvitedUserCountInRange(
        invitation.id,
        activeProgram.startsAt,
        activeProgram.endsAt,
        5,
      );

      const result = await service.getStepEvent(userId);

      // 기본: 5 * 500 = 2500, 스텝 수령 이력 없음
      expect(result.totalPoints).toBe(2500);
    });

    it('파트너 스텝 수령 이력도 totalPoints에 합산된다', async () => {
      const invitation = await service.getOrCreateInvitation(userId);
      partnerRepository.setProgram(activeProgram);
      repository.setInvitedUserCountInRange(
        invitation.id,
        activeProgram.startsAt,
        activeProgram.endsAt,
        5,
      );
      repository.setPartnerStepRewards(userId, activeProgram.id, [
        { stepCount: 3 },
        { stepCount: 5 },
      ]);

      const result = await service.getStepEvent(userId);

      // 기본: 5 * 500 = 2500, 스텝: 1000 + 2000 = 3000
      expect(result.receivedRewards).toEqual([3, 5]);
      expect(result.totalPoints).toBe(5500);
    });

    it('파트너가 아닌 경우 파트너 수령 이력은 receivedRewards에 포함되지 않는다', async () => {
      const invitation = await service.getOrCreateInvitation(userId);
      repository.setInvitedUserCount(invitation.id, 5);
      // 과거 파트너 프로그램에서 수령한 이력
      repository.setPartnerStepRewards(userId, 99, [{ stepCount: 3 }]);
      // 일반 수령 이력
      repository.setStepRewards(userId, [{ stepCount: 5 }]);

      const result = await service.getStepEvent(userId);

      expect(result.receivedRewards).toEqual([5]);
    });

    // === C방향: totalInvitationCount / activeProgram ===

    it('비파트너는 activeProgram이 null이고 totalInvitationCount는 전체 누적이다', async () => {
      const invitation = await service.getOrCreateInvitation(userId);
      repository.setInvitedUserCount(invitation.id, 5);
      repository.setTotalInvitedUserCount(invitation.id, 20);

      const result = await service.getStepEvent(userId);

      expect(result.activeProgram).toBeNull();
      expect(result.totalInvitationCount).toBe(20);
      expect(result.invitationCount).toBe(5);
    });

    it('파트너는 activeProgram이 설정되고 totalInvitationCount는 전체 누적이다', async () => {
      const invitation = await service.getOrCreateInvitation(userId);
      partnerRepository.setProgram(activeProgram);
      repository.setInvitedUserCountInRange(
        invitation.id,
        activeProgram.startsAt,
        activeProgram.endsAt,
        5,
      );
      repository.setTotalInvitedUserCount(invitation.id, 30);

      const result = await service.getStepEvent(userId);

      expect(result.activeProgram).toEqual({
        id: activeProgram.id,
        startsAt: activeProgram.startsAt,
        endsAt: activeProgram.endsAt,
      });
      expect(result.totalInvitationCount).toBe(30);
      expect(result.invitationCount).toBe(5);
    });
  });

  // === 파트너 프로그램: claimStepReward ===

  describe('claimStepReward (파트너 프로그램)', () => {
    const userId = 'partner-user';
    const nowMs = Date.now();
    const activeProgram = {
      id: 42,
      userId,
      startsAt: new Date(nowMs - 24 * 60 * 60 * 1000).toISOString(),
      endsAt: new Date(nowMs + 24 * 60 * 60 * 1000).toISOString(),
    };

    it('파트너는 프로그램 기간 내 카운트 기준으로 수령할 수 있다', async () => {
      const invitation = await service.getOrCreateInvitation(userId);
      partnerRepository.setProgram(activeProgram);
      repository.setInvitedUserCountInRange(
        invitation.id,
        activeProgram.startsAt,
        activeProgram.endsAt,
        3,
      );

      const result = await service.claimStepReward(userId, 3);

      expect(result.success).toBe(true);
    });

    it('파트너 수령 시 point_actions에 partner_program_id가 기록된다', async () => {
      const invitation = await service.getOrCreateInvitation(userId);
      partnerRepository.setProgram(activeProgram);
      repository.setInvitedUserCountInRange(
        invitation.id,
        activeProgram.startsAt,
        activeProgram.endsAt,
        3,
      );

      await service.claimStepReward(userId, 3);

      const actions = pointWriteRepo.getInsertedActions();
      const reward = actions.find(
        (a) => a.type === 'INVITE_STEP_REWARD' && a.userId === userId,
      );
      expect(reward).toBeDefined();
      expect(reward!.additionalData.partner_program_id).toBe(activeProgram.id);
    });

    it('이전에 일반 수령한 이력이 있어도 파트너 수령은 독립적으로 가능하다', async () => {
      const invitation = await service.getOrCreateInvitation(userId);
      partnerRepository.setProgram(activeProgram);
      repository.setInvitedUserCountInRange(
        invitation.id,
        activeProgram.startsAt,
        activeProgram.endsAt,
        3,
      );
      // 일반 기간(프로그램 전)에 이미 3단계 수령함
      repository.setStepRewards(userId, [{ stepCount: 3 }]);

      const result = await service.claimStepReward(userId, 3);

      expect(result.success).toBe(true);
    });

    it('같은 프로그램 내에서 동일 step을 중복 수령하면 ConflictException', async () => {
      const invitation = await service.getOrCreateInvitation(userId);
      partnerRepository.setProgram(activeProgram);
      repository.setInvitedUserCountInRange(
        invitation.id,
        activeProgram.startsAt,
        activeProgram.endsAt,
        3,
      );

      await service.claimStepReward(userId, 3);

      await expect(service.claimStepReward(userId, 3)).rejects.toThrow(
        'Already received step reward',
      );
    });

    it('파트너 카운트가 부족하면 BadRequestException', async () => {
      const invitation = await service.getOrCreateInvitation(userId);
      partnerRepository.setProgram(activeProgram);
      // 프로그램 기간 내 2명만 초대, 3단계 수령 시도
      repository.setInvitedUserCountInRange(
        invitation.id,
        activeProgram.startsAt,
        activeProgram.endsAt,
        2,
      );
      // 기존 기준으로는 10명 이상이라도
      repository.setInvitedUserCount(invitation.id, 100);

      await expect(service.claimStepReward(userId, 3)).rejects.toThrow(
        'Current count is less than step count',
      );
    });

    it('파트너가 아니면 기존 동작을 유지한다', async () => {
      const invitation = await service.getOrCreateInvitation(userId);
      repository.setInvitedUserCount(invitation.id, 3);

      const result = await service.claimStepReward(userId, 3);

      expect(result.success).toBe(true);
    });

    it('파트너 수령 이력은 일반 수령 중복 체크에 영향을 주지 않는다', async () => {
      const invitation = await service.getOrCreateInvitation(userId);
      // 과거 파트너 프로그램에서 3단계 수령한 이력
      repository.setPartnerStepRewards(userId, 99, [{ stepCount: 3 }]);
      repository.setInvitedUserCount(invitation.id, 3);

      // 현재는 파트너 아님 → 일반 수령 경로로 3단계 수령 가능해야 함
      const result = await service.claimStepReward(userId, 3);

      expect(result.success).toBe(true);
    });

    it('프로그램 시작 전 이력이 많아도, 프로그램 시작 후 카운트로만 수령 판정된다', async () => {
      const invitation = await service.getOrCreateInvitation(userId);
      partnerRepository.setProgram(activeProgram);
      // 프로그램 시작 전 10명
      repository.setInvitedUserCount(invitation.id, 10);
      // 프로그램 시작 후 3명
      repository.setInvitedUserCountInRange(
        invitation.id,
        activeProgram.startsAt,
        activeProgram.endsAt,
        3,
      );

      const result = await service.claimStepReward(userId, 3);

      expect(result.success).toBe(true);
    });

    it('파트너 프로그램에 존재하지 않는 step(99)는 BadRequestException', async () => {
      const invitation = await service.getOrCreateInvitation(userId);
      partnerRepository.setProgram(activeProgram);
      repository.setInvitedUserCountInRange(
        invitation.id,
        activeProgram.startsAt,
        activeProgram.endsAt,
        200,
      );

      await expect(service.claimStepReward(userId, 99)).rejects.toThrow(
        'Eligible step not found',
      );
    });

    it('파트너 수령 후 findStepRewardsByProgram으로 이력이 조회된다', async () => {
      const invitation = await service.getOrCreateInvitation(userId);
      partnerRepository.setProgram(activeProgram);
      repository.setInvitedUserCountInRange(
        invitation.id,
        activeProgram.startsAt,
        activeProgram.endsAt,
        3,
      );

      await service.claimStepReward(userId, 3);

      const rewards = await repository.findStepRewardsByProgram(
        userId,
        activeProgram.id,
      );
      expect(rewards).toEqual([{ stepCount: 3 }]);

      // 같은 이력이 일반 findStepRewards에는 잡히지 않아야 함
      const normalRewards = await repository.findStepRewards(userId);
      expect(normalRewards).toEqual([]);
    });
  });
});
