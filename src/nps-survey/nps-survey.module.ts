import { Module } from '@nestjs/common';
import { NpsSurveyController } from './nps-survey.controller';
import { NpsSurveyService } from './nps-survey.service';
import { NPS_SURVEY_REPOSITORY } from './interfaces/nps-survey-repository.interface';
import { SupabaseNpsSurveyRepository } from './repositories/supabase-nps-survey.repository';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';
import { UserModalModule } from '../user-modal/user-modal.module';

@Module({
  imports: [SupabaseModule, AuthModule, UserModalModule],
  controllers: [NpsSurveyController],
  providers: [
    NpsSurveyService,
    {
      provide: NPS_SURVEY_REPOSITORY,
      useClass: SupabaseNpsSurveyRepository,
    },
  ],
})
export class NpsSurveyModule {}
