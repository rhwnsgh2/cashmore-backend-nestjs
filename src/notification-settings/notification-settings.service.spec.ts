import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationSettingsService } from './notification-settings.service';
import { NOTIFICATION_SETTINGS_REPOSITORY } from './interfaces/notification-settings-repository.interface';
import { StubNotificationSettingsRepository } from './repositories/stub-notification-settings.repository';

describe('NotificationSettingsService', () => {
  let service: NotificationSettingsService;
  let repository: StubNotificationSettingsRepository;
  const userId = 'test-user-id';

  beforeEach(async () => {
    repository = new StubNotificationSettingsRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationSettingsService,
        {
          provide: NOTIFICATION_SETTINGS_REPOSITORY,
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<NotificationSettingsService>(
      NotificationSettingsService,
    );
  });

  describe('enableAll', () => {
    it('성공 응답을 반환한다', async () => {
      const result = await service.enableAll(userId);

      expect(result).toEqual({ success: true });
    });

    it('AD_LOTTERY 알림 설정을 활성화한다', async () => {
      await service.enableAll(userId);

      const setting = repository.getSettings(userId, 'AD_LOTTERY');
      expect(setting).toBeDefined();
      expect(setting?.is_enabled).toBe(true);
    });

    it('user의 marketing_info를 true로 업데이트한다', async () => {
      await service.enableAll(userId);

      const userInfo = repository.getUserMarketingInfo(userId);
      expect(userInfo).toBeDefined();
      expect(userInfo?.marketing_info).toBe(true);
    });

    it('marketing_info_updated_at에 타임스탬프를 기록한다', async () => {
      const beforeCall = new Date().toISOString();

      await service.enableAll(userId);

      const userInfo = repository.getUserMarketingInfo(userId);
      expect(userInfo?.marketing_info_updated_at).toBeDefined();
      expect(
        new Date(userInfo!.marketing_info_updated_at).getTime(),
      ).toBeGreaterThanOrEqual(new Date(beforeCall).getTime());
    });

    it('이미 설정이 있어도 다시 호출하면 업데이트된다', async () => {
      // 첫 번째 호출
      await service.enableAll(userId);
      const firstSetting = repository.getSettings(userId, 'AD_LOTTERY');
      const firstUpdatedAt = firstSetting?.updated_at;

      // 약간의 딜레이 후 두 번째 호출
      await new Promise((resolve) => setTimeout(resolve, 10));
      await service.enableAll(userId);

      const secondSetting = repository.getSettings(userId, 'AD_LOTTERY');
      expect(secondSetting?.is_enabled).toBe(true);
      expect(
        new Date(secondSetting!.updated_at).getTime(),
      ).toBeGreaterThanOrEqual(new Date(firstUpdatedAt!).getTime());
    });
  });

  describe('getNotificationSetting', () => {
    it('설정이 없으면 기본값 (enabled: false)을 반환한다', async () => {
      const result = await service.getNotificationSetting(userId, 'AD_LOTTERY');

      expect(result).toEqual({
        userId,
        type: 'AD_LOTTERY',
        enabled: false,
      });
    });

    it('설정이 있으면 해당 값을 반환한다', async () => {
      await repository.upsertNotificationSetting(userId, 'AD_LOTTERY', true);

      const result = await service.getNotificationSetting(userId, 'AD_LOTTERY');

      expect(result).toEqual({
        userId,
        type: 'AD_LOTTERY',
        enabled: true,
      });
    });

    it('잘못된 타입이면 BadRequestException을 던진다', async () => {
      await expect(
        service.getNotificationSetting(userId, 'INVALID_TYPE'),
      ).rejects.toThrow('Invalid notification type');
    });
  });

  describe('updateNotificationSetting', () => {
    it('알림 설정을 활성화한다', async () => {
      const result = await service.updateNotificationSetting(
        userId,
        'AD_LOTTERY',
        true,
      );

      expect(result).toEqual({
        success: true,
        message: '알림 설정이 업데이트되었습니다.',
      });

      const setting = repository.getSettings(userId, 'AD_LOTTERY');
      expect(setting?.is_enabled).toBe(true);
    });

    it('알림 설정을 비활성화한다', async () => {
      await repository.upsertNotificationSetting(userId, 'AD_LOTTERY', true);

      const result = await service.updateNotificationSetting(
        userId,
        'AD_LOTTERY',
        false,
      );

      expect(result).toEqual({
        success: true,
        message: '알림 설정이 업데이트되었습니다.',
      });

      const setting = repository.getSettings(userId, 'AD_LOTTERY');
      expect(setting?.is_enabled).toBe(false);
    });

    it('잘못된 타입이면 BadRequestException을 던진다', async () => {
      await expect(
        service.updateNotificationSetting(userId, 'INVALID_TYPE', true),
      ).rejects.toThrow('Invalid notification type');
    });
  });
});
