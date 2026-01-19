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
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { MetricsModule } from './common/metrics';
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
    UserModule,
    MetricsModule,
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
