import type {
  ICashbackRepository,
  RawEveryReceipt,
  RawPointAction,
  RawStepReward,
  RawAffiliateData,
  RawAttendance,
  RawAttendancePointAction,
  RawClaim,
  RawNaverPayExchange,
  RawCashExchange,
} from '../interfaces/cashback-repository.interface';

export class StubCashbackRepository implements ICashbackRepository {
  private everyReceipts: Map<string, RawEveryReceipt[]> = new Map();
  private pointActions: Map<string, RawPointAction[]> = new Map();
  private stepRewards: Map<string, RawStepReward[]> = new Map();
  private affiliateData: Map<string, RawAffiliateData[]> = new Map();
  private attendances: Map<string, RawAttendance[]> = new Map();
  private attendancePointActions: Map<string, RawAttendancePointAction[]> =
    new Map();
  private claims: Map<string, RawClaim[]> = new Map();
  private naverPayExchanges: Map<string, RawNaverPayExchange[]> = new Map();
  private cashExchanges: Map<string, RawCashExchange[]> = new Map();

  // 데이터 설정 메서드들
  setEveryReceipts(userId: string, data: RawEveryReceipt[]): void {
    this.everyReceipts.set(userId, data);
  }

  setPointActions(userId: string, data: RawPointAction[]): void {
    this.pointActions.set(userId, data);
  }

  setStepRewards(userId: string, data: RawStepReward[]): void {
    this.stepRewards.set(userId, data);
  }

  setAffiliateData(userId: string, data: RawAffiliateData[]): void {
    this.affiliateData.set(userId, data);
  }

  setAttendances(userId: string, data: RawAttendance[]): void {
    this.attendances.set(userId, data);
  }

  setAttendancePointActions(
    userId: string,
    data: RawAttendancePointAction[],
  ): void {
    this.attendancePointActions.set(userId, data);
  }

  setClaims(userId: string, data: RawClaim[]): void {
    this.claims.set(userId, data);
  }

  setNaverPayExchanges(userId: string, data: RawNaverPayExchange[]): void {
    this.naverPayExchanges.set(userId, data);
  }

  setCashExchanges(userId: string, data: RawCashExchange[]): void {
    this.cashExchanges.set(userId, data);
  }

  clear(): void {
    this.everyReceipts.clear();
    this.pointActions.clear();
    this.stepRewards.clear();
    this.affiliateData.clear();
    this.attendances.clear();
    this.attendancePointActions.clear();
    this.claims.clear();
    this.naverPayExchanges.clear();
    this.cashExchanges.clear();
  }

  // ICashbackRepository 구현
  private applyPagination<T extends { created_at: string }>(
    items: T[],
    cursor: string | null,
    limit: number,
  ): T[] {
    let filtered = [...items].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    if (cursor) {
      filtered = filtered.filter((item) => item.created_at < cursor);
    }
    return filtered.slice(0, limit);
  }

  findEveryReceipts(
    userId: string,
    cursor: string | null,
    limit: number,
  ): Promise<RawEveryReceipt[]> {
    const data = this.everyReceipts.get(userId) || [];
    return Promise.resolve(this.applyPagination(data, cursor, limit));
  }

  findPointActions(
    userId: string,
    cursor: string | null,
    limit: number,
  ): Promise<RawPointAction[]> {
    const data = this.pointActions.get(userId) || [];
    return Promise.resolve(this.applyPagination(data, cursor, limit));
  }

  findStepRewards(
    userId: string,
    cursor: string | null,
    limit: number,
  ): Promise<RawStepReward[]> {
    const data = this.stepRewards.get(userId) || [];
    return Promise.resolve(this.applyPagination(data, cursor, limit));
  }

  findAffiliateData(
    userId: string,
    cursor: string | null,
    limit: number,
  ): Promise<RawAffiliateData[]> {
    const data = this.affiliateData.get(userId) || [];
    return Promise.resolve(this.applyPagination(data, cursor, limit));
  }

  findAttendances(
    userId: string,
    cursor: string | null,
    limit: number,
  ): Promise<RawAttendance[]> {
    const data = this.attendances.get(userId) || [];
    return Promise.resolve(this.applyPagination(data, cursor, limit));
  }

  findAttendancePointActions(
    userId: string,
  ): Promise<RawAttendancePointAction[]> {
    return Promise.resolve(this.attendancePointActions.get(userId) || []);
  }

  findClaims(
    userId: string,
    cursor: string | null,
    limit: number,
  ): Promise<RawClaim[]> {
    const data = this.claims.get(userId) || [];
    return Promise.resolve(this.applyPagination(data, cursor, limit));
  }

  findNaverPayExchanges(
    userId: string,
    cursor: string | null,
    limit: number,
  ): Promise<RawNaverPayExchange[]> {
    const data = this.naverPayExchanges.get(userId) || [];
    return Promise.resolve(this.applyPagination(data, cursor, limit));
  }

  sumCompletedClaimCashback(userId: string): Promise<number> {
    const claims = this.claims.get(userId) || [];
    const sum = claims
      .filter((c) => c.status === 'completed')
      .reduce((acc, c) => acc + (c.cashback_amount || 0), 0);
    return Promise.resolve(sum);
  }

  sumExchangePointToCash(userId: string): Promise<number> {
    const actions = this.pointActions.get(userId) || [];
    const sum = actions
      .filter((a) => a.type === 'EXCHANGE_POINT_TO_CASH' && a.status === 'done')
      .reduce((acc, a) => acc + (a.point_amount || 0) * -1, 0);
    return Promise.resolve(sum);
  }

  sumCashExchangeDone(userId: string): Promise<number> {
    const exchanges = this.cashExchanges.get(userId) || [];
    const sum = exchanges
      .filter((e) => e.status === 'done')
      .reduce((acc, e) => acc + (e.amount || 0), 0);
    return Promise.resolve(sum);
  }

  findCashExchangesByPointActionIds(
    pointActionIds: number[],
  ): Promise<RawCashExchange[]> {
    if (pointActionIds.length === 0) {
      return Promise.resolve([]);
    }
    const result: RawCashExchange[] = [];
    for (const exchanges of this.cashExchanges.values()) {
      for (const ex of exchanges) {
        if (
          ex.point_action_id !== null &&
          pointActionIds.includes(ex.point_action_id)
        ) {
          result.push(ex);
        }
      }
    }
    return Promise.resolve(result);
  }
}
