import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type {
  INotificationSettingsRepository,
  NotificationType,
} from './interfaces/notification-settings-repository.interface';
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

  private validateType(type: string): NotificationType {
    if (!NOTIFICATION_TYPES.includes(type as NotificationType)) {
      throw new BadRequestException('Invalid notification type');
    }
    return type as NotificationType;
  }

  async getNotificationSetting(
    userId: string,
    type: string,
  ): Promise<{ userId: string; type: string; enabled: boolean }> {
    const validType = this.validateType(type);

    const setting =
      await this.notificationSettingsRepository.findNotificationSetting(
        userId,
        validType,
      );

    // 설정이 없으면 기본값 (enabled: false) 반환
    if (!setting) {
      return {
        userId,
        type: validType,
        enabled: false,
      };
    }

    return {
      userId: setting.user_id,
      type: setting.type,
      enabled: setting.is_enabled,
    };
  }

  async updateNotificationSetting(
    userId: string,
    type: string,
    enabled: boolean,
  ): Promise<{ success: boolean; message: string }> {
    const validType = this.validateType(type);

    await this.notificationSettingsRepository.upsertNotificationSetting(
      userId,
      validType,
      enabled,
    );

    return {
      success: true,
      message: '알림 설정이 업데이트되었습니다.',
    };
  }

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
