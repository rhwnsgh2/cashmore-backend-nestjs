import { Module } from '@nestjs/common';
import { AdLotterySlotController } from './ad-lottery-slot.controller';
import { AdLotterySlotService } from './ad-lottery-slot.service';
import { AD_LOTTERY_SLOT_REPOSITORY } from './interfaces/ad-lottery-slot-repository.interface';
import { SupabaseAdLotterySlotRepository } from './repositories/supabase-ad-lottery-slot.repository';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AdLotterySlotController],
  providers: [
    AdLotterySlotService,
    {
      provide: AD_LOTTERY_SLOT_REPOSITORY,
      useClass: SupabaseAdLotterySlotRepository,
    },
  ],
  exports: [AdLotterySlotService],
})
export class AdLotterySlotModule {}
