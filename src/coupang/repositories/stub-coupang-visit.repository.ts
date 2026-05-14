import type {
  ICoupangVisitRepository,
  CoupangVisitRecord,
} from '../interfaces/coupang-visit-repository.interface';

export class StubCoupangVisitRepository implements ICoupangVisitRepository {
  private visits: CoupangVisitRecord[] = [];
  private nextId = 1;

  getInsertedVisits(): CoupangVisitRecord[] {
    return [...this.visits];
  }

  clear(): void {
    this.visits = [];
    this.nextId = 1;
  }

  async findByUserIdAndDate(
    userId: string,
    date: string,
  ): Promise<CoupangVisitRecord | null> {
    const found = this.visits.find(
      (v) => v.userId === userId && v.createdAtDate === date,
    );
    return found ?? null;
  }

  async findLatestByUserId(
    userId: string,
  ): Promise<CoupangVisitRecord | null> {
    const userVisits = this.visits
      .filter((v) => v.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return userVisits[0] ?? null;
  }

  async insertVisit(
    userId: string,
    date: string,
    pointAmount: number,
  ): Promise<CoupangVisitRecord> {
    const visit: CoupangVisitRecord = {
      id: this.nextId++,
      userId,
      createdAtDate: date,
      pointAmount,
      createdAt: new Date().toISOString(),
    };
    this.visits.push(visit);
    return visit;
  }

  seedVisit(record: Omit<CoupangVisitRecord, 'id'>): CoupangVisitRecord {
    const visit: CoupangVisitRecord = { id: this.nextId++, ...record };
    this.visits.push(visit);
    return visit;
  }
}
