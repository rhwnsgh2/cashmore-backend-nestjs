import { Module } from '@nestjs/common';
import { EveryReceiptController } from './every-receipt.controller';
import { EveryReceiptService } from './every-receipt.service';
import { EVERY_RECEIPT_REPOSITORY } from './interfaces/every-receipt-repository.interface';
import { SupabaseEveryReceiptRepository } from './repositories/supabase-every-receipt.repository';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [EveryReceiptController],
  providers: [
    EveryReceiptService,
    {
      provide: EVERY_RECEIPT_REPOSITORY,
      useClass: SupabaseEveryReceiptRepository,
    },
  ],
  exports: [EveryReceiptService],
})
export class EveryReceiptModule {}
