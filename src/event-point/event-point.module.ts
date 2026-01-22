import { Module } from '@nestjs/common';
import { EventPointController } from './event-point.controller';
import { EventPointService } from './event-point.service';
import { EVENT_POINT_REPOSITORY } from './interfaces/event-point-repository.interface';
import { SupabaseEventPointRepository } from './repositories/supabase-event-point.repository';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [SupabaseModule, AuthModule],
  controllers: [EventPointController],
  providers: [
    EventPointService,
    {
      provide: EVENT_POINT_REPOSITORY,
      useClass: SupabaseEventPointRepository,
    },
  ],
})
export class EventPointModule {}
