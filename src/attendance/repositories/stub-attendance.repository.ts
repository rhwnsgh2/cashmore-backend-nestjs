import type {
  IAttendanceRepository,
  AttendanceRecord,
  AttendancePointAction,
} from '../interfaces/attendance-repository.interface';

export class StubAttendanceRepository implements IAttendanceRepository {
  private attendances = new Map<string, AttendanceRecord[]>();
  private pointActions = new Map<string, AttendancePointAction[]>();
  private insertedPointActions: {
    userId: string;
    type: string;
    pointAmount: number;
    additionalData: Record<string, unknown>;
  }[] = [];
  private nextId = 1;

  setAttendances(userId: string, records: AttendanceRecord[]): void {
    this.attendances.set(userId, records);
  }

  setPointActions(userId: string, actions: AttendancePointAction[]): void {
    this.pointActions.set(userId, actions);
  }

  getInsertedPointActions() {
    return this.insertedPointActions;
  }

  clear(): void {
    this.attendances.clear();
    this.pointActions.clear();
    this.insertedPointActions = [];
    this.nextId = 1;
  }

  findByUserId(userId: string): Promise<AttendanceRecord[]> {
    return Promise.resolve(this.attendances.get(userId) || []);
  }

  findPointActionsByUserId(userId: string): Promise<AttendancePointAction[]> {
    return Promise.resolve(this.pointActions.get(userId) || []);
  }

  async findByUserIdAndDate(
    userId: string,
    date: string,
  ): Promise<AttendanceRecord | null> {
    const records = this.attendances.get(userId) || [];
    return records.find((r) => r.createdAtDate === date) || null;
  }

  async insertAttendance(
    userId: string,
    date: string,
  ): Promise<AttendanceRecord> {
    const record: AttendanceRecord = {
      id: this.nextId++,
      userId,
      createdAtDate: date,
      createdAt: new Date().toISOString(),
    };
    const existing = this.attendances.get(userId) || [];
    existing.push(record);
    this.attendances.set(userId, existing);
    return record;
  }

  async insertPointAction(
    userId: string,
    type: 'ATTENDANCE' | 'WEEKLY_ATTENDANCE_BONUS',
    pointAmount: number,
    additionalData: Record<string, unknown>,
  ): Promise<void> {
    this.insertedPointActions.push({ userId, type, pointAmount, additionalData });
  }

  async findAttendancesByUserIdInDateRange(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<AttendanceRecord[]> {
    const records = this.attendances.get(userId) || [];
    return records.filter(
      (r) => r.createdAtDate >= startDate && r.createdAtDate <= endDate,
    );
  }
}
