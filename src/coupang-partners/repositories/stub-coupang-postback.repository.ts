import type {
  ICoupangPostbackRepository,
  CoupangPostbackRecord,
} from '../interfaces/coupang-postback-repository.interface';

export class StubCoupangPostbackRepository
  implements ICoupangPostbackRepository
{
  private records: CoupangPostbackRecord[] = [];
  private nextId = 1;

  getInsertedRecords(): CoupangPostbackRecord[] {
    return [...this.records];
  }

  clear(): void {
    this.records = [];
    this.nextId = 1;
  }

  async save(
    data: Omit<CoupangPostbackRecord, 'id' | 'createdAt'>,
  ): Promise<void> {
    this.records.push({
      ...data,
      id: this.nextId++,
      createdAt: new Date().toISOString(),
    });
  }
}
