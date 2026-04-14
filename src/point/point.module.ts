import { Module } from '@nestjs/common';
import { PointController } from './point.controller';
import { PointService } from './point.service';
import { POINT_REPOSITORY } from './interfaces/point-repository.interface';
import { SupabasePointRepository } from './repositories/supabase-point.repository';
import { AuthModule } from '../auth/auth.module';
import { SlackModule } from '../slack/slack.module';

@Module({
  imports: [AuthModule, SlackModule],
  controllers: [PointController],
  providers: [
    PointService,
    {
      provide: POINT_REPOSITORY,
      useClass: SupabasePointRepository,
    },
  ],
  exports: [PointService],
})
export class PointModule {}
