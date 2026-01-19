import { Module } from '@nestjs/common';
import { StreakController } from './streak.controller';
import { StreakService } from './streak.service';
import { STREAK_REPOSITORY } from './interfaces/streak-repository.interface';
import { SupabaseStreakRepository } from './repositories/supabase-streak.repository';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [StreakController],
  providers: [
    StreakService,
    {
      provide: STREAK_REPOSITORY,
      useClass: SupabaseStreakRepository,
    },
  ],
  exports: [StreakService],
})
export class StreakModule {}
