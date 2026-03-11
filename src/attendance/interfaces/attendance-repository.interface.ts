export interface AttendanceRecord {
  id: number;
  userId: string;
  createdAtDate: string; // YYYY-MM-DD
  createdAt: string;
}

export interface AttendancePointAction {
  id: number;
  createdAt: string;
  pointAmount: number;
  additionalData: {
    attendance_id?: number;
  };
  type: 'ATTENDANCE' | 'ATTENDANCE_AD';
}

export interface Attendance {
  id: number;
  userId: string;
  attendanceDate: string;
  point: number | null;
  adShowPoint: number | null;
  createdAt: string;
}

export interface IAttendanceRepository {
  findByUserId(userId: string): Promise<AttendanceRecord[]>;
  findPointActionsByUserId(userId: string): Promise<AttendancePointAction[]>;
  findByUserIdAndDate(
    userId: string,
    date: string,
  ): Promise<AttendanceRecord | null>;
  insertAttendance(userId: string, date: string): Promise<AttendanceRecord>;
  insertPointAction(
    userId: string,
    type: 'ATTENDANCE' | 'WEEKLY_ATTENDANCE_BONUS',
    pointAmount: number,
    additionalData: Record<string, unknown>,
  ): Promise<void>;
  findAttendancesByUserIdInDateRange(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<AttendanceRecord[]>;
}

export const ATTENDANCE_REPOSITORY = Symbol('ATTENDANCE_REPOSITORY');
