import { Module } from '@nestjs/common';
import { NaverPayController } from './naver-pay.controller';
import { NaverPayService } from './naver-pay.service';
import { NAVER_PAY_REPOSITORY } from './interfaces/naver-pay-repository.interface';
import { SupabaseNaverPayRepository } from './repositories/supabase-naver-pay.repository';
import { DAOU_API_CLIENT } from './interfaces/daou-api-client.interface';
import { StubDaouApiClient } from './clients/stub-daou-api.client';
// TODO: 다우 개발서버 방화벽 오픈 후 실제 클라이언트로 교체
// import { DaouApiClient } from './clients/daou-api.client';
import { AuthModule } from '../auth/auth.module';
import { PointModule } from '../point/point.module';
import { SlackModule } from '../slack/slack.module';

@Module({
  imports: [AuthModule, PointModule, SlackModule],
  controllers: [NaverPayController],
  providers: [
    NaverPayService,
    {
      provide: NAVER_PAY_REPOSITORY,
      useClass: SupabaseNaverPayRepository,
    },
    {
      provide: DAOU_API_CLIENT,
      useClass: StubDaouApiClient,
    },
  ],
  exports: [NaverPayService],
})
export class NaverPayModule {}
