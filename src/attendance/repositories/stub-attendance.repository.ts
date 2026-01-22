import {
  IAttendanceRepository,
  AttendanceRecord,
  AttendancePointAction,
} from '../interfaces/attendance-repository.interface';

export class StubAttendanceRepository implements IAttendanceRepository {
  private attendances = new Map<string, AttendanceRecord[]>();
  private pointActions = new Map<string, AttendancePointAction[]>();

  setAttendances(userId: string, records: AttendanceRecord[]): void {
    this.attendances.set(userId, records);
  }

  setPointActions(userId: string, actions: AttendancePointAction[]): void {
    this.pointActions.set(userId, actions);
  }

  clear(): void {
    this.attendances.clear();
    this.pointActions.clear();
  }

  async findByUserId(userId: string): Promise<AttendanceRecord[]> {
    return this.attendances.get(userId) || [];
  }

  async findPointActionsByUserId(
    userId: string,
  ): Promise<AttendancePointAction[]> {
    return this.pointActions.get(userId) || [];
  }
}
