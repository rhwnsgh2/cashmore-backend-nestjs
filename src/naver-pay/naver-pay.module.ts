import { Module } from '@nestjs/common';
import { NaverPayController } from './naver-pay.controller';
import { NaverPayService } from './naver-pay.service';
import { NAVER_PAY_REPOSITORY } from './interfaces/naver-pay-repository.interface';
import { SupabaseNaverPayRepository } from './repositories/supabase-naver-pay.repository';
import { DAOU_API_CLIENT } from './interfaces/daou-api-client.interface';
import { DaouApiClient } from './clients/daou-api.client';
import { AuthModule } from '../auth/auth.module';
import { PointModule } from '../point/point.module';
import { SlackModule } from '../slack/slack.module';
import { UserModalModule } from '../user-modal/user-modal.module';
import { FcmModule } from '../fcm/fcm.module';

@Module({
  imports: [AuthModule, PointModule, SlackModule, UserModalModule, FcmModule],
  controllers: [NaverPayController],
  providers: [
    NaverPayService,
    {
      provide: NAVER_PAY_REPOSITORY,
      useClass: SupabaseNaverPayRepository,
    },
    {
      provide: DAOU_API_CLIENT,
      useClass: DaouApiClient,
    },
  ],
  exports: [NaverPayService],
})
export class NaverPayModule {}
