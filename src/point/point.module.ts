import { Module } from '@nestjs/common';
import { PointController } from './point.controller';
import { PointService } from './point.service';
import { POINT_REPOSITORY } from './interfaces/point-repository.interface';
import { SupabasePointRepository } from './repositories/supabase-point.repository';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
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
