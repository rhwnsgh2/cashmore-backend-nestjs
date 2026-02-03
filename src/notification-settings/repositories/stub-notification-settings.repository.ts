import type {
  INotificationSettingsRepository,
  NotificationType,
  NotificationSetting,
} from '../interfaces/notification-settings-repository.interface';

export class StubNotificationSettingsRepository implements INotificationSettingsRepository {
  private settings: Map<string, NotificationSetting> = new Map();
  private userMarketingInfo: Map<
    string,
    { marketing_info: boolean; marketing_info_updated_at: string }
  > = new Map();

  private makeKey(userId: string, type: NotificationType): string {
    return `${userId}:${type}`;
  }

  getSettings(
    userId: string,
    type: NotificationType,
  ): NotificationSetting | undefined {
    return this.settings.get(this.makeKey(userId, type));
  }

  getUserMarketingInfo(
    userId: string,
  ):
    | { marketing_info: boolean; marketing_info_updated_at: string }
    | undefined {
    return this.userMarketingInfo.get(userId);
  }

  clear(): void {
    this.settings.clear();
    this.userMarketingInfo.clear();
  }

  upsertNotificationSetting(
    userId: string,
    type: NotificationType,
    isEnabled: boolean,
  ): Promise<void> {
    const key = this.makeKey(userId, type);
    const existing = this.settings.get(key);
    const now = new Date().toISOString();

    this.settings.set(key, {
      id: existing?.id ?? Math.floor(Math.random() * 10000),
      user_id: userId,
      type,
      is_enabled: isEnabled,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    });
    return Promise.resolve();
  }

  updateUserMarketingInfo(
    userId: string,
    marketingInfo: boolean,
  ): Promise<void> {
    this.userMarketingInfo.set(userId, {
      marketing_info: marketingInfo,
      marketing_info_updated_at: new Date().toISOString(),
    });
    return Promise.resolve();
  }
}
