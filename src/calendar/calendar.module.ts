import { Module } from '@nestjs/common';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { CALENDAR_REPOSITORY } from './interfaces/calendar-repository.interface';
import { SupabaseCalendarRepository } from './repositories/supabase-calendar.repository';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CalendarController],
  providers: [
    CalendarService,
    {
      provide: CALENDAR_REPOSITORY,
      useClass: SupabaseCalendarRepository,
    },
  ],
  exports: [CalendarService],
})
export class CalendarModule {}
