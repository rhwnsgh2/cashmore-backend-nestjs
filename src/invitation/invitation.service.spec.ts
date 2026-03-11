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
});
