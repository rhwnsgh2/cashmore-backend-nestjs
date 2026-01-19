import { Module } from '@nestjs/common';
import { LotteryController } from './lottery.controller';
import { LotteryService } from './lottery.service';
import { LOTTERY_REPOSITORY } from './interfaces/lottery-repository.interface';
import { SupabaseLotteryRepository } from './repositories/supabase-lottery.repository';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
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
