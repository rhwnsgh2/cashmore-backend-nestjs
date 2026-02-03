import { Module } from '@nestjs/common';
import { NotificationSettingsController } from './notification-settings.controller';
import { NotificationSettingsService } from './notification-settings.service';
import { NOTIFICATION_SETTINGS_REPOSITORY } from './interfaces/notification-settings-repository.interface';
import { SupabaseNotificationSettingsRepository } from './repositories/supabase-notification-settings.repository';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [NotificationSettingsController],
  providers: [
    NotificationSettingsService,
    {
      provide: NOTIFICATION_SETTINGS_REPOSITORY,
      useClass: SupabaseNotificationSettingsRepository,
    },
  ],
})
export class NotificationSettingsModule {}
