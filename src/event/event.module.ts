import { Module } from '@nestjs/common';
import { EventController } from './event.controller';
import { DoublePointEventController } from './double-point-event.controller';
import { EventService } from './event.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [SupabaseModule, AuthModule],
  controllers: [EventController, DoublePointEventController],
  providers: [EventService],
})
export class EventModule {}
