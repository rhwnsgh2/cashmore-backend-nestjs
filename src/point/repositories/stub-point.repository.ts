import type {
  IPointRepository,
  PointAction,
  PointSnapshot,
  MonthlyEarnedPoint,
  WithdrawalAction,
} from '../interfaces/point-repository.interface';

/**
 * 테스트용 Stub Repository
 * 인메모리 데이터를 설정하고 테스트에서 사용
 */
export class StubPointRepository implements IPointRepository {
  private snapshots: Map<string, PointSnapshot> = new Map();
  private pointActions: Map<string, PointAction[]> = new Map();
  private monthlyEarnedPoints: Map<string, MonthlyEarnedPoint[]> = new Map();
  private withdrawalActions: Map<string, WithdrawalAction[]> = new Map();

  // 데이터 설정 메서드들
  setSnapshot(userId: string, snapshot: PointSnapshot | null): void {
    if (snapshot) {
      this.snapshots.set(userId, snapshot);
    } else {
      this.snapshots.delete(userId);
    }
  }

  setPointActions(userId: string, actions: PointAction[]): void {
    this.pointActions.set(userId, actions);
  }

  setMonthlyEarnedPoints(userId: string, points: MonthlyEarnedPoint[]): void {
    this.monthlyEarnedPoints.set(userId, points);
  }

  setWithdrawalActions(userId: string, actions: WithdrawalAction[]): void {
    this.withdrawalActions.set(userId, actions);
  }

  clear(): void {
    this.snapshots.clear();
    this.pointActions.clear();
    this.monthlyEarnedPoints.clear();
    this.withdrawalActions.clear();
  }

  // IPointRepository 구현
  findLatestSnapshot(userId: string): Promise<PointSnapshot | null> {
    return Promise.resolve(this.snapshots.get(userId) || null);
  }

  findPointActionsSince(userId: string, since: string): Promise<PointAction[]> {
    const actions = this.pointActions.get(userId) || [];
    const sinceDate = new Date(since);
    const filtered = actions.filter(
      (action) => new Date(action.created_at) >= sinceDate,
    );
    return Promise.resolve(filtered);
  }

  findAllPointActions(userId: string): Promise<PointAction[]> {
    return Promise.resolve(this.pointActions.get(userId) || []);
  }

  findMonthlyEarnedPointsUntil(
    userId: string,
    _yearMonth: string,
  ): Promise<MonthlyEarnedPoint[]> {
    // 실제로는 yearMonth 필터링이 필요하지만, 테스트에서는 설정한 값 그대로 반환
    return Promise.resolve(this.monthlyEarnedPoints.get(userId) || []);
  }

  findWithdrawalActions(userId: string): Promise<WithdrawalAction[]> {
    return Promise.resolve(this.withdrawalActions.get(userId) || []);
  }
}
