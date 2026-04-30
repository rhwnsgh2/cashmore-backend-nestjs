import { Inject, Injectable } from '@nestjs/common';
import type { IAttendanceRepository } from './interfaces/attendance-repository.interface';
import {
  Attendance,
  ATTENDANCE_REPOSITORY,
} from './interfaces/attendance-repository.interface';
import type { IPointWriteService } from '../point-write/point-write.interface';
import { POINT_WRITE_SERVICE } from '../point-write/point-write.interface';

const POINT_AMOUNT = 2;
const WEEKLY_COMPLETION_BONUS = 5;

export interface CheckInResult {
  success: boolean;
  weeklyBonusEarned: boolean;
  point: number;
  reason?: string;
}

@Injectable()
export class AttendanceService {
  constructor(
    @Inject(ATTENDANCE_REPOSITORY)
    private attendanceRepository: IAttendanceRepository,
    @Inject(POINT_WRITE_SERVICE)
    private pointWriteService: IPointWriteService,
  ) {}

  async getAttendances(userId: string): Promise<Attendance[]> {
    const attendanceRecords =
      await this.attendanceRepository.findByUserId(userId);

    return attendanceRecords.map((record) => ({
      id: record.id,
      userId: record.userId,
      attendanceDate: record.createdAtDate,
      createdAt: record.createdAt,
    }));
  }

  async checkIn(userId: string): Promise<CheckInResult> {
    const today = this.getTodayKST();

    const existing = await this.attendanceRepository.findByUserIdAndDate(
      userId,
      today,
    );

    if (existing) {
      return {
        success: false,
        weeklyBonusEarned: false,
        point: 0,
        reason: 'Already attended today',
      };
    }

    let attendance;
    try {
      attendance = await this.attendanceRepository.insertAttendance(
        userId,
        today,
      );
    } catch {
      return {
        success: false,
        weeklyBonusEarned: false,
        point: 0,
        reason: 'Already attended today',
      };
    }

    await this.pointWriteService.addPoint({
      userId,
      amount: POINT_AMOUNT,
      type: 'ATTENDANCE',
      additionalData: { attendance_id: attendance.id },
    });

    const weeklyBonusEarned =
      await this.checkAndAssignWeeklyCompletionBonus(userId);

    const point = weeklyBonusEarned
      ? POINT_AMOUNT + WEEKLY_COMPLETION_BONUS
      : POINT_AMOUNT;

    return { success: true, weeklyBonusEarned, point };
  }

  private async checkAndAssignWeeklyCompletionBonus(
    userId: string,
  ): Promise<boolean> {
    const today = this.getTodayDateKST();
    const dayOfWeek = today.getDay();

    const startOfWeek = new Date(today);
    if (dayOfWeek === 0) {
      startOfWeek.setDate(today.getDate() - 6);
    } else {
      startOfWeek.setDate(today.getDate() - dayOfWeek + 1);
    }

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const startDate = this.formatDate(startOfWeek);
    const endDate = this.formatDate(endOfWeek);

    const attendances =
      await this.attendanceRepository.findAttendancesByUserIdInDateRange(
        userId,
        startDate,
        endDate,
      );

    if (attendances.length !== 7) {
      return false;
    }

    const attendanceDates = new Set(attendances.map((a) => a.createdAtDate));
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(startOfWeek);
      checkDate.setDate(startOfWeek.getDate() + i);
      if (!attendanceDates.has(this.formatDate(checkDate))) {
        return false;
      }
    }

    await this.pointWriteService.addPoint({
      userId,
      amount: WEEKLY_COMPLETION_BONUS,
      type: 'WEEKLY_ATTENDANCE_BONUS',
      additionalData: { week_start: startDate, week_end: endDate },
    });

    return true;
  }

  private getTodayKST(): string {
    return this.formatDate(this.getTodayDateKST());
  }

  private getTodayDateKST(): Date {
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const kst = new Date(now.getTime() + kstOffset);
    return new Date(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate());
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
