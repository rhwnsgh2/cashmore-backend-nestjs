import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { ATTENDANCE_REPOSITORY } from './interfaces/attendance-repository.interface';
import { SupabaseAttendanceRepository } from './repositories/supabase-attendance.repository';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AttendanceController],
  providers: [
    AttendanceService,
    {
      provide: ATTENDANCE_REPOSITORY,
      useClass: SupabaseAttendanceRepository,
    },
  ],
  exports: [AttendanceService],
})
export class AttendanceModule {}
