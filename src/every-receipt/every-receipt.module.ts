import { Module } from '@nestjs/common';
import { EveryReceiptController } from './every-receipt.controller';
import { EveryReceiptService } from './every-receipt.service';
import { EVERY_RECEIPT_REPOSITORY } from './interfaces/every-receipt-repository.interface';
import { SupabaseEveryReceiptRepository } from './repositories/supabase-every-receipt.repository';
import { AuthModule } from '../auth/auth.module';
import { ReceiptQueueService } from './receipt-queue.service';
import { EventModule } from '../event/event.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { FcmModule } from '../fcm/fcm.module';
import { UserModalModule } from '../user-modal/user-modal.module';
import { SlackModule } from '../slack/slack.module';

@Module({
  imports: [
    AuthModule,
    EventModule,
    OnboardingModule,
    FcmModule,
    UserModalModule,
    SlackModule,
  ],
  controllers: [EveryReceiptController],
  providers: [
    EveryReceiptService,
    ReceiptQueueService,
    {
      provide: EVERY_RECEIPT_REPOSITORY,
      useClass: SupabaseEveryReceiptRepository,
    },
  ],
  exports: [EveryReceiptService, EVERY_RECEIPT_REPOSITORY],
})
export class EveryReceiptModule {}
