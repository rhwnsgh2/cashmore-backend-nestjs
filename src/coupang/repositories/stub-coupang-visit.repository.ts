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

  async insertVisit(
    userId: string,
    date: string,
    pointAmount: number,
  ): Promise<CoupangVisitRecord> {
    const exists = this.visits.find(
      (v) => v.userId === userId && v.createdAtDate === date,
    );
    if (exists) {
      throw new Error('duplicate key value violates unique constraint');
    }

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
}
