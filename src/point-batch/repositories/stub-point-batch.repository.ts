import type {
  IPointBatchRepository,
  MonthlyEarnedPoint,
  ExpirationTarget,
  WithdrawRule,
} from '../interfaces/point-batch-repository.interface';

/**
 * 테스트용 Stub Repository
 */
export class StubPointBatchRepository implements IPointBatchRepository {
  private aggregationTargets: MonthlyEarnedPoint[] = [];
  private upsertedMonthly: {
    yearMonth: string;
    targets: MonthlyEarnedPoint[];
  }[] = [];
  private expirationTargets: ExpirationTarget[] = [];
  private insertedExpirations: {
    targets: ExpirationTarget[];
    baseDate: string;
    expirationMonth: string;
  }[] = [];

  // 데이터 설정 메서드
  setMonthlyEarnedPoints(targets: MonthlyEarnedPoint[]): void {
    this.aggregationTargets = targets;
  }

  getUpsertedMonthly() {
    return this.upsertedMonthly;
  }

  setExpirationTargets(targets: ExpirationTarget[]): void {
    this.expirationTargets = targets;
  }

  getInsertedExpirations() {
    return this.insertedExpirations;
  }

  private deletedExpirationMonths: string[] = [];

  getDeletedExpirationMonths() {
    return this.deletedExpirationMonths;
  }

  clear(): void {
    this.aggregationTargets = [];
    this.upsertedMonthly = [];
    this.expirationTargets = [];
    this.insertedExpirations = [];
    this.deletedExpirationMonths = [];
  }

  // IPointBatchRepository 구현
  calculateMonthlyEarnedPoints(
    _yearMonth: string,
    _earnTypes: readonly string[],
  ): Promise<MonthlyEarnedPoint[]> {
    return Promise.resolve(this.aggregationTargets);
  }

  upsertMonthlyEarnedPoints(
    yearMonth: string,
    targets: MonthlyEarnedPoint[],
  ): Promise<number> {
    this.upsertedMonthly.push({ yearMonth, targets });
    return Promise.resolve(targets.length);
  }

  findExpirationTargets(
    _expirationMonth: string,
    _withdrawRules: readonly WithdrawRule[],
  ): Promise<ExpirationTarget[]> {
    return Promise.resolve(this.expirationTargets);
  }

  insertExpirationActions(
    targets: ExpirationTarget[],
    baseDate: string,
    expirationMonth: string,
  ): Promise<number> {
    this.insertedExpirations.push({ targets, baseDate, expirationMonth });
    return Promise.resolve(targets.length);
  }

  deleteExpirationActions(expirationMonth: string): Promise<number> {
    this.deletedExpirationMonths.push(expirationMonth);
    const matched = this.insertedExpirations.filter(
      (e) => e.expirationMonth === expirationMonth,
    );
    const count = matched.reduce((s, e) => s + e.targets.length, 0);
    this.insertedExpirations = this.insertedExpirations.filter(
      (e) => e.expirationMonth !== expirationMonth,
    );
    return Promise.resolve(count);
  }
}
