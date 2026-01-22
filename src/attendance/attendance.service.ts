import { Inject, Injectable } from '@nestjs/common';
import type { IAttendanceRepository } from './interfaces/attendance-repository.interface';
import {
  Attendance,
  ATTENDANCE_REPOSITORY,
} from './interfaces/attendance-repository.interface';

@Injectable()
export class AttendanceService {
  constructor(
    @Inject(ATTENDANCE_REPOSITORY)
    private attendanceRepository: IAttendanceRepository,
  ) {}

  async getAttendances(userId: string): Promise<Attendance[]> {
    const [attendanceRecords, pointActions] = await Promise.all([
      this.attendanceRepository.findByUserId(userId),
      this.attendanceRepository.findPointActionsByUserId(userId),
    ]);

    return attendanceRecords.map((record) => {
      const attendancePoint = pointActions.find(
        (action) =>
          action.additionalData.attendance_id === record.id &&
          action.type === 'ATTENDANCE',
      );

      const adShowPointAction = pointActions.find(
        (action) =>
          action.additionalData.attendance_id === record.id &&
          action.type === 'ATTENDANCE_AD',
      );

      return {
        id: record.id,
        userId: record.userId,
        attendanceDate: record.createdAtDate,
        point: attendancePoint?.pointAmount ?? null,
        adShowPoint: adShowPointAction?.pointAmount ?? null,
        createdAt: record.createdAt,
      };
    });
  }
}
