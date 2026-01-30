import { Inject, Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { POINT_ADD_TYPES } from '../point/interfaces/point-repository.interface';
import type {
  IPointBatchRepository,
  ExpirationTarget,
  WithdrawRule,
} from './interfaces/point-batch-repository.interface';
import { POINT_BATCH_REPOSITORY } from './interfaces/point-batch-repository.interface';

export const WITHDRAW_RULES: readonly WithdrawRule[] = [
  { type: 'EXCHANGE_POINT_TO_CASH', statuses: ['done', 'pending'] },
  { type: 'POINT_EXPIRATION', statuses: ['done'] },
] as const;

dayjs.extend(utc);
dayjs.extend(timezone);

export interface AggregateResult {
  aggregatedUsers: number;
  targetMonth: string;
}

export interface ExpirePreviewResult {
  targets: ExpirationTarget[];
  totalExpiredPoints: number;
  expirationMonth: string;
}

export interface ExpireResult {
  expiredUsers: number;
  totalExpiredPoints: number;
  expirationMonth: string;
}

export interface RollbackExpireResult {
  deletedCount: number;
  expirationMonth: string;
}

export interface MonthlyBatchResult {
  aggregatedUsers: number;
  expiredUsers: number;
  totalExpiredPoints: number;
  targetMonth: string;
  expirationMonth: string;
}

@Injectable()
export class PointBatchService {
  private readonly logger = new Logger(PointBatchService.name);

  constructor(
    @Inject(POINT_BATCH_REPOSITORY)
    private batchRepository: IPointBatchRepository,
  ) {}

  /**
   * 지난달 월별 적립 포인트를 집계하여 monthly_earned_points에 upsert
   */
  async aggregate(baseDate?: string): Promise<AggregateResult> {
    const base = this.resolveBaseDate(baseDate);
    const targetMonth = base.subtract(1, 'month').format('YYYY-MM');

    this.logger.log(`월별 적립 집계 시작 - 대상: ${targetMonth}`);

    const targets = await this.batchRepository.calculateMonthlyEarnedPoints(
      targetMonth,
      POINT_ADD_TYPES,
    );

    let aggregatedUsers = 0;
    if (targets.length > 0) {
      aggregatedUsers = await this.batchRepository.upsertMonthlyEarnedPoints(
        targetMonth,
        targets,
      );
    }

    this.logger.log(`월별 적립 집계 완료: ${aggregatedUsers}명`);

    return { aggregatedUsers, targetMonth };
  }

  /**
   * 소멸 대상 유저와 소멸 포인트를 미리 조회 (dry-run)
   */
  async expirePreview(baseDate?: string): Promise<ExpirePreviewResult> {
    const base = this.resolveBaseDate(baseDate);
    const expirationMonth = base
      .startOf('month')
      .subtract(7, 'month')
      .format('YYYY-MM');

    this.logger.log(`소멸 미리보기 - 기준: ${expirationMonth}`);

    const targets = await this.batchRepository.findExpirationTargets(
      expirationMonth,
      WITHDRAW_RULES,
    );

    const totalExpiredPoints = targets.reduce(
      (sum, t) => sum + t.expiringPoints,
      0,
    );

    this.logger.log(
      `소멸 대상: ${targets.length}명, 총 ${totalExpiredPoints}포인트`,
    );

    return { targets, totalExpiredPoints, expirationMonth };
  }

  /**
   * 실제 포인트 소멸 실행
   */
  async expire(baseDate?: string): Promise<ExpireResult> {
    const base = this.resolveBaseDate(baseDate);
    const expirationMonth = base
      .startOf('month')
      .subtract(7, 'month')
      .format('YYYY-MM');

    this.logger.log(`포인트 소멸 실행 - 기준: ${expirationMonth}`);

    const targets = await this.batchRepository.findExpirationTargets(
      expirationMonth,
      WITHDRAW_RULES,
    );

    let expiredUsers = 0;
    let totalExpiredPoints = 0;

    if (targets.length > 0) {
      expiredUsers = await this.batchRepository.insertExpirationActions(
        targets,
        base.format('YYYY-MM-DD'),
        expirationMonth,
      );
      totalExpiredPoints = targets.reduce(
        (sum, t) => sum + t.expiringPoints,
        0,
      );
    }

    this.logger.log(
      `소멸 완료: ${expiredUsers}명, 총 ${totalExpiredPoints}포인트`,
    );

    return { expiredUsers, totalExpiredPoints, expirationMonth };
  }

  /**
   * 월간 배치 전체 실행: 집계(2개월 전) + 소멸
   * aggregate는 2개월 전 데이터를 집계 (1개월 전은 정산 미완료 가능)
   */
  async executeMonthlyBatch(baseDate?: string): Promise<MonthlyBatchResult> {
    const base = this.resolveBaseDate(baseDate);
    const aggregateBaseDate = base.subtract(1, 'month').format('YYYY-MM-DD');
    const aggregateResult = await this.aggregate(aggregateBaseDate);
    const expireResult = await this.expire(baseDate);

    return {
      aggregatedUsers: aggregateResult.aggregatedUsers,
      targetMonth: aggregateResult.targetMonth,
      expiredUsers: expireResult.expiredUsers,
      totalExpiredPoints: expireResult.totalExpiredPoints,
      expirationMonth: expireResult.expirationMonth,
    };
  }

  /**
   * 특정 소멸 기준월의 POINT_EXPIRATION 레코드를 롤백 (삭제)
   */
  async rollbackExpire(expirationMonth: string): Promise<RollbackExpireResult> {
    this.logger.log(`소멸 롤백 실행 - 기준월: ${expirationMonth}`);

    const deletedCount =
      await this.batchRepository.deleteExpirationActions(expirationMonth);

    this.logger.log(`소멸 롤백 완료: ${deletedCount}건 삭제`);

    return { deletedCount, expirationMonth };
  }

  private resolveBaseDate(baseDate?: string) {
    return baseDate
      ? dayjs(baseDate).tz('Asia/Seoul')
      : dayjs().tz('Asia/Seoul');
  }
}
