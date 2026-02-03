import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { InviteCodeService } from './invite-code.service';
import { INVITE_CODE_REPOSITORY } from './interfaces/invite-code-repository.interface';
import { StubInviteCodeRepository } from './repositories/stub-invite-code.repository';

describe('InviteCodeService', () => {
  let service: InviteCodeService;
  let repository: StubInviteCodeRepository;
  const userId = 'test-user-id';
  const deviceId = 'test-device-id';

  beforeEach(async () => {
    repository = new StubInviteCodeRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InviteCodeService,
        {
          provide: INVITE_CODE_REPOSITORY,
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<InviteCodeService>(InviteCodeService);
  });

  describe('canInputInviteCode', () => {
    it('모든 조건을 만족하면 true를 반환한다', async () => {
      repository.setDeviceId(userId, deviceId);
      repository.setUserCreatedAt(userId, new Date().toISOString());

      const result = await service.canInputInviteCode(userId);

      expect(result).toBe(true);
    });

    it('device_id가 없으면 false를 반환한다', async () => {
      const result = await service.canInputInviteCode(userId);

      expect(result).toBe(false);
    });

    it('이미 디바이스 이벤트에 참여했으면 false를 반환한다', async () => {
      repository.setDeviceId(userId, deviceId);
      repository.setDeviceEventParticipation(deviceId);
      repository.setUserCreatedAt(userId, new Date().toISOString());

      const result = await service.canInputInviteCode(userId);

      expect(result).toBe(false);
    });

    it('이미 초대받은 사용자면 false를 반환한다', async () => {
      repository.setDeviceId(userId, deviceId);
      repository.setAlreadyInvited(userId);
      repository.setUserCreatedAt(userId, new Date().toISOString());

      const result = await service.canInputInviteCode(userId);

      expect(result).toBe(false);
    });

    it('가입한 지 24시간이 지났으면 false를 반환한다', async () => {
      repository.setDeviceId(userId, deviceId);
      const twoDaysAgo = new Date(
        Date.now() - 48 * 60 * 60 * 1000,
      ).toISOString();
      repository.setUserCreatedAt(userId, twoDaysAgo);

      const result = await service.canInputInviteCode(userId);

      expect(result).toBe(false);
    });

    it('가입한 지 24시간 이내면 true를 반환한다', async () => {
      repository.setDeviceId(userId, deviceId);
      const oneHourAgo = new Date(
        Date.now() - 1 * 60 * 60 * 1000,
      ).toISOString();
      repository.setUserCreatedAt(userId, oneHourAgo);

      const result = await service.canInputInviteCode(userId);

      expect(result).toBe(true);
    });

    it('created_at이 없으면 false를 반환한다', async () => {
      repository.setDeviceId(userId, deviceId);

      const result = await service.canInputInviteCode(userId);

      expect(result).toBe(false);
    });
  });
});
