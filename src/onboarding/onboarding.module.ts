import { Module } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { ONBOARDING_REPOSITORY } from './interfaces/onboarding-repository.interface';
import { SupabaseOnboardingRepository } from './repositories/supabase-onboarding.repository';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [OnboardingController],
  providers: [
    OnboardingService,
    {
      provide: ONBOARDING_REPOSITORY,
      useClass: SupabaseOnboardingRepository,
    },
  ],
  exports: [OnboardingService],
})
export class OnboardingModule {}
