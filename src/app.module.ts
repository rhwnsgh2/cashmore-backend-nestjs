import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { SupabaseModule } from './supabase/supabase.module';
import { PointModule } from './point/point.module';
import { LotteryModule } from './lottery/lottery.module';
import { AdLotterySlotModule } from './ad-lottery-slot/ad-lottery-slot.module';
import { UserModule } from './user/user.module';
import { StreakModule } from './streak/streak.module';
import { CalendarModule } from './calendar/calendar.module';
import { EveryReceiptModule } from './every-receipt/every-receipt.module';
import { AttendanceModule } from './attendance/attendance.module';
import { EventPointModule } from './event-point/event-point.module';
import { UserModalModule } from './user-modal/user-modal.module';
import { AuthModule } from './auth/auth.module';
import { MetricsModule } from './common/metrics';
import { DebugModule } from './debug/debug.module';
import { ExchangePointModule } from './exchange-point/exchange-point.module';
import { PointBatchModule } from './point-batch/point-batch.module';
import { InviteCodeModule } from './invite-code/invite-code.module';
import { NotificationSettingsModule } from './notification-settings/notification-settings.module';
import { StepRewardsModule } from './step-rewards/step-rewards.module';
import { WatchedAdModule } from './watched-ad/watched-ad.module';
import { LocalPromotionModule } from './local-promotion/local-promotion.module';
import { DividendModule } from './dividend/dividend.module';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1초
        limit: 50, // 1초에 50 요청 (버스트 방지)
      },
      {
        name: 'medium',
        ttl: 60000, // 1분
        limit: 300, // 1분에 300 요청
      },
    ]),
    SupabaseModule,
    AuthModule,
    HealthModule,
    PointModule,
    LotteryModule,
    AdLotterySlotModule,
    UserModule,
    StreakModule,
    CalendarModule,
    EveryReceiptModule,
    AttendanceModule,
    EventPointModule,
    UserModalModule,
    MetricsModule,
    DebugModule,
    ExchangePointModule,
    PointBatchModule,
    InviteCodeModule,
    NotificationSettingsModule,
    StepRewardsModule,
    WatchedAdModule,
    LocalPromotionModule,
    DividendModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
