import { Module } from '@nestjs/common';
import { StepRewardsController } from './step-rewards.controller';
import { StepRewardsService } from './step-rewards.service';
import { STEP_REWARDS_REPOSITORY } from './interfaces/step-rewards-repository.interface';
import { SupabaseStepRewardsRepository } from './repositories/supabase-step-rewards.repository';
import { AuthModule } from '../auth/auth.module';
import { LotteryModule } from '../lottery/lottery.module';

@Module({
  imports: [AuthModule, LotteryModule],
  controllers: [StepRewardsController],
  providers: [
    StepRewardsService,
    {
      provide: STEP_REWARDS_REPOSITORY,
      useClass: SupabaseStepRewardsRepository,
    },
  ],
})
export class StepRewardsModule {}
