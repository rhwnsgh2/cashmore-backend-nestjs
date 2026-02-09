import { Module } from '@nestjs/common';
import { LotteryController } from './lottery.controller';
import { LotteryService } from './lottery.service';
import { LOTTERY_REPOSITORY } from './interfaces/lottery-repository.interface';
import { SupabaseLotteryRepository } from './repositories/supabase-lottery.repository';
import { AuthModule } from '../auth/auth.module';
import { FcmModule } from '../fcm/fcm.module';

@Module({
  imports: [AuthModule, FcmModule],
  controllers: [LotteryController],
  providers: [
    LotteryService,
    {
      provide: LOTTERY_REPOSITORY,
      useClass: SupabaseLotteryRepository,
    },
  ],
  exports: [LotteryService],
})
export class LotteryModule {}
