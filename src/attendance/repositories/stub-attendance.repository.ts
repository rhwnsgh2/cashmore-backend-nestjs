import type {
  IAttendanceRepository,
  AttendanceRecord,
} from '../interfaces/attendance-repository.interface';

export class StubAttendanceRepository implements IAttendanceRepository {
  private attendances = new Map<string, AttendanceRecord[]>();
  private nextId = 1;

  setAttendances(userId: string, records: AttendanceRecord[]): void {
    this.attendances.set(userId, records);
  }

  clear(): void {
    this.attendances.clear();
    this.nextId = 1;
  }

  findByUserId(userId: string): Promise<AttendanceRecord[]> {
    return Promise.resolve(this.attendances.get(userId) || []);
  }

  findByUserIdAndDate(
    userId: string,
    date: string,
  ): Promise<AttendanceRecord | null> {
    const records = this.attendances.get(userId) || [];
    return Promise.resolve(
      records.find((r) => r.createdAtDate === date) || null,
    );
  }

  insertAttendance(userId: string, date: string): Promise<AttendanceRecord> {
    const record: AttendanceRecord = {
      id: this.nextId++,
      userId,
      createdAtDate: date,
      createdAt: new Date().toISOString(),
    };
    const existing = this.attendances.get(userId) || [];
    existing.push(record);
    this.attendances.set(userId, existing);
    return Promise.resolve(record);
  }

  findAttendancesByUserIdInDateRange(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<AttendanceRecord[]> {
    const records = this.attendances.get(userId) || [];
    return Promise.resolve(
      records.filter(
        (r) => r.createdAtDate >= startDate && r.createdAtDate <= endDate,
      ),
    );
  }
}
