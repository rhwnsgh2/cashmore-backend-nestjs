export const NOTIFICATION_TYPES = ['AD_LOTTERY'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NotificationSetting {
  id: number;
  user_id: string;
  type: NotificationType;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface INotificationSettingsRepository {
  upsertNotificationSetting(
    userId: string,
    type: NotificationType,
    isEnabled: boolean,
  ): Promise<void>;

  updateUserMarketingInfo(
    userId: string,
    marketingInfo: boolean,
  ): Promise<void>;
}

export const NOTIFICATION_SETTINGS_REPOSITORY = Symbol(
  'NOTIFICATION_SETTINGS_REPOSITORY',
);
