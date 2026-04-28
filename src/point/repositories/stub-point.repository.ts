import {
  type IPointRepository,
  type PointAction,
  type PointBalance,
  type EarnedPointAction,
  POINT_ADD_TYPES,
} from '../interfaces/point-repository.interface';

/**
 * 테스트용 Stub Repository
 * 인메모리 데이터를 설정하고 테스트에서 사용
 */
export class StubPointRepository implements IPointRepository {
  private pointActions: Map<string, PointAction[]> = new Map();
  private balances: Map<string, PointBalance> = new Map();

  // 데이터 설정 메서드들
  setPointActions(userId: string, actions: PointAction[]): void {
    this.pointActions.set(userId, actions);
  }

  setBalance(userId: string, balance: PointBalance | null): void {
    if (balance) {
      this.balances.set(userId, balance);
    } else {
      this.balances.delete(userId);
    }
  }

  clear(): void {
    this.pointActions.clear();
    this.balances.clear();
  }

  // IPointRepository 구현
  findAllPointActions(userId: string): Promise<PointAction[]> {
    return Promise.resolve(this.pointActions.get(userId) || []);
  }

  findEarnedPointsBetween(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<number> {
    const actions = this.pointActions.get(userId) || [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const addTypes: readonly string[] = POINT_ADD_TYPES;
    const total = actions
      .filter((action) => {
        const date = new Date(action.created_at);
        return (
          date >= start &&
          date < end &&
          addTypes.includes(action.type) &&
          action.status === 'done'
        );
      })
      .reduce((sum, action) => sum + action.point_amount, 0);
    return Promise.resolve(total);
  }

  findEarnedPointActionsInRange(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<EarnedPointAction[]> {
    const actions = this.pointActions.get(userId) || [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const addTypes: readonly string[] = POINT_ADD_TYPES;
    const filtered = actions
      .filter((action) => {
        const date = new Date(action.created_at);
        return (
          date >= start &&
          date < end &&
          addTypes.includes(action.type) &&
          action.status === 'done'
        );
      })
      .map((action) => ({
        point_amount: action.point_amount,
        created_at: action.created_at,
      }));
    return Promise.resolve(filtered);
  }

  findBalance(userId: string): Promise<PointBalance | null> {
    return Promise.resolve(this.balances.get(userId) ?? null);
  }

  saveBalance(userId: string, total: number): Promise<void> {
    this.balances.set(userId, { totalPoint: total });
    return Promise.resolve();
  }

  findSumUpToId(userId: string, maxId: number): Promise<number> {
    const actions = this.pointActions.get(userId) ?? [];
    const sum = actions
      .filter((a) => a.id <= maxId)
      .reduce((acc, a) => acc + a.point_amount, 0);
    return Promise.resolve(sum);
  }

  private rpcOverride?: (userId: string, maxId: number) => number;

  setRpcOverride(fn: (userId: string, maxId: number) => number): void {
    this.rpcOverride = fn;
  }

  clearRpcOverride(): void {
    this.rpcOverride = undefined;
  }

  findTotalPointSumViaRpc(userId: string, maxId: number): Promise<number> {
    if (this.rpcOverride) {
      return Promise.resolve(this.rpcOverride(userId, maxId));
    }
    const actions = this.pointActions.get(userId) ?? [];
    const sum = actions
      .filter((a) => a.id <= maxId)
      .reduce((acc, a) => acc + a.point_amount, 0);
    return Promise.resolve(sum);
  }

  private totalSumOverride?: (userId: string) => number;

  setTotalSumOverride(fn: (userId: string) => number): void {
    this.totalSumOverride = fn;
  }

  clearTotalSumOverride(): void {
    this.totalSumOverride = undefined;
  }

  findTotalPointSum(userId: string): Promise<number> {
    if (this.totalSumOverride) {
      return Promise.resolve(this.totalSumOverride(userId));
    }
    const actions = this.pointActions.get(userId) ?? [];
    const sum = actions.reduce((acc, a) => acc + a.point_amount, 0);
    return Promise.resolve(sum);
  }
}
