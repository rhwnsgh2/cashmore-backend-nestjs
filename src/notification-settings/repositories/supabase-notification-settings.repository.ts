import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type {
  INotificationSettingsRepository,
  NotificationType,
} from '../interfaces/notification-settings-repository.interface';

@Injectable()
export class SupabaseNotificationSettingsRepository implements INotificationSettingsRepository {
  constructor(private supabaseService: SupabaseService) {}

  async upsertNotificationSetting(
    userId: string,
    type: NotificationType,
    isEnabled: boolean,
  ): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('notification_settings')
      .upsert(
        {
          user_id: userId,
          type,
          is_enabled: isEnabled,
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: 'user_id,type' },
      );

    if (error) {
      throw error;
    }
  }

  async updateUserMarketingInfo(
    userId: string,
    marketingInfo: boolean,
  ): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('user')
      .update({
        marketing_info: marketingInfo,
        marketing_info_updated_at: new Date().toISOString(),
      } as never)
      .eq('id', userId);

    if (error) {
      throw error;
    }
  }
}
