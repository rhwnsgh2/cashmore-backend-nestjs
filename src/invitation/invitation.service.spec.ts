import { Test, TestingModule } from '@nestjs/testing';
import { InvitationService } from './invitation.service';
import {
  INVITATION_REPOSITORY,
  Invitation,
} from './interfaces/invitation-repository.interface';
import { StubInvitationRepository } from './repositories/stub-invitation.repository';

describe('InvitationService', () => {
  let service: InvitationService;
  let repository: StubInvitationRepository;

  beforeEach(async () => {
    repository = new StubInvitationRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationService,
        {
          provide: INVITATION_REPOSITORY,
          useValue: repository,
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
});
