import { Inject, Injectable } from '@nestjs/common';
import type { INotificationSettingsRepository } from './interfaces/notification-settings-repository.interface';
import {
  NOTIFICATION_SETTINGS_REPOSITORY,
  NOTIFICATION_TYPES,
} from './interfaces/notification-settings-repository.interface';

@Injectable()
export class NotificationSettingsService {
  constructor(
    @Inject(NOTIFICATION_SETTINGS_REPOSITORY)
    private notificationSettingsRepository: INotificationSettingsRepository,
  ) {}

  async enableAll(userId: string): Promise<{ success: boolean }> {
    // 1. 모든 알림 타입을 enabled로 설정
    for (const type of NOTIFICATION_TYPES) {
      await this.notificationSettingsRepository.upsertNotificationSetting(
        userId,
        type,
        true,
      );
    }

    // 2. user 테이블의 marketing_info를 true로 업데이트
    await this.notificationSettingsRepository.updateUserMarketingInfo(
      userId,
      true,
    );

    return { success: true };
  }
}
