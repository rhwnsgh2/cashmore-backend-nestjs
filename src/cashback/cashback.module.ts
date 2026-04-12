import { Module } from '@nestjs/common';
import { CashbackController } from './cashback.controller';
import { CashbackService } from './cashback.service';
import { CASHBACK_REPOSITORY } from './interfaces/cashback-repository.interface';
import { SupabaseCashbackRepository } from './repositories/supabase-cashback.repository';
import { AuthModule } from '../auth/auth.module';
import { SlackModule } from '../slack/slack.module';

@Module({
  imports: [AuthModule, SlackModule],
  controllers: [CashbackController],
  providers: [
    CashbackService,
    {
      provide: CASHBACK_REPOSITORY,
      useClass: SupabaseCashbackRepository,
    },
  ],
})
export class CashbackModule {}
