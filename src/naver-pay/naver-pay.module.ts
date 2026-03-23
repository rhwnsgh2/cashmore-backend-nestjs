import { Module } from '@nestjs/common';
import { NaverPayController } from './naver-pay.controller';
import { NaverPayService } from './naver-pay.service';
import { NAVER_PAY_REPOSITORY } from './interfaces/naver-pay-repository.interface';
import { SupabaseNaverPayRepository } from './repositories/supabase-naver-pay.repository';
import { DAOU_API_CLIENT } from './interfaces/daou-api-client.interface';
import { StubDaouApiClient } from './clients/stub-daou-api.client';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [NaverPayController],
  providers: [
    NaverPayService,
    {
      provide: NAVER_PAY_REPOSITORY,
      useClass: SupabaseNaverPayRepository,
    },
    {
      // TODO: 다우기술 API 실제 구현체로 교체
      provide: DAOU_API_CLIENT,
      useClass: StubDaouApiClient,
    },
  ],
  exports: [NaverPayService],
})
export class NaverPayModule {}
