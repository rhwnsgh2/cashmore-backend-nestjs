import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import type { IPointRepository } from './interfaces/point-repository.interface';
import { POINT_REPOSITORY } from './interfaces/point-repository.interface';
import {
  calculatePointAmount,
  calculateExpiringPoints,
} from './utils/calculate-point.util';
import type { IPointWriteService } from '../point-write/point-write.interface';
import { POINT_WRITE_SERVICE } from '../point-write/point-write.interface';
import { SlackService } from '../slack/slack.service';

dayjs.extend(utc);
dayjs.extend(timezone);

export interface PointTotalResult {
  totalPoint: number;
  expiringPoints: number;
  expiringDate: string;
  todayPoint: number;
  lastWeekPoint: number;
  weeklyPoint: number;
}

@Injectable()
export class PointService {
  private readonly logger = new Logger(PointService.name);

  constructor(
    @Inject(POINT_REPOSITORY)
    private pointRepository: IPointRepository,
    @Inject(POINT_WRITE_SERVICE)
    private pointWriteService: IPointWriteService,
    @Optional() private slackService?: SlackService,
  ) {}

  async getPointTotal(userId: string): Promise<PointTotalResult> {
    const now = dayjs().tz('Asia/Seoul');

    const totalPoint = await this.calculateTotalPoint(userId);

    // 병행 운영 검증: user_point_balance와 비교해 drift 감지 (비차단)
    void this.verifyBalance(userId, totalPoint);
    const expiringPoints = calculateExpiringPoints();
    const expiringDate = now.endOf('month').format('YYYY-MM-DD');

    // 오늘
    const todayStart = now.startOf('day');

    // 이번주 월요일 (일요일인 경우 -6일로 이번주 월요일 계산)
    const thisWeekStart =
      now.day() === 0
        ? now.subtract(6, 'day').startOf('day')
        : now.startOf('week').add(1, 'day');

    // 지난주 월요일
    const lastWeekStart = thisWeekStart.subtract(7, 'day');

    // 지난주 월요일 ~ 현재까지 범위로 한 번에 조회
    const earnedActions =
      await this.pointRepository.findEarnedPointActionsInRange(
        userId,
        lastWeekStart.toISOString(),
        now.toISOString(),
      );

    // JS에서 기간별로 필터링하여 합산
    const todayStartMs = todayStart.valueOf();
    const thisWeekStartMs = thisWeekStart.valueOf();
    const lastWeekStartMs = lastWeekStart.valueOf();

    let todayPoint = 0;
    let weeklyPoint = 0;
    let lastWeekPoint = 0;

    for (const action of earnedActions) {
      const createdAtMs = dayjs(action.created_at).valueOf();

      if (createdAtMs >= todayStartMs) {
        todayPoint += action.point_amount;
      }
      if (createdAtMs >= thisWeekStartMs) {
        weeklyPoint += action.point_amount;
      } else if (createdAtMs >= lastWeekStartMs) {
        lastWeekPoint += action.point_amount;
      }
    }

    return {
      totalPoint,
      expiringPoints,
      expiringDate,
      todayPoint,
      lastWeekPoint,
      weeklyPoint,
    };
  }

  private async calculateTotalPoint(userId: string): Promise<number> {
    const snapshot = await this.pointRepository.findLatestSnapshot(userId);

    if (snapshot) {
      const pointActions = await this.pointRepository.findPointActionsSince(
        userId,
        dayjs(snapshot.updated_at).toISOString(),
      );
      return snapshot.point_balance + calculatePointAmount(pointActions);
    }

    const pointActions = await this.pointRepository.findAllPointActions(userId);
    return calculatePointAmount(pointActions);
  }

  /**
   * user_point_balance 테이블 값과 SUM 기반 계산을 비교해 drift를 감지한다.
   * 병행 운영 단계의 best-effort 검사. 검증 실패나 row 없음(첫 write 전 등)은 조용히 무시.
   */
  private async verifyBalance(
    userId: string,
    expectedTotal: number,
  ): Promise<void> {
    try {
      const balance = await this.pointRepository.findBalance(userId);
      if (!balance) return;

      if (balance.totalPoint !== expectedTotal) {
        const diff = balance.totalPoint - expectedTotal;
        this.logger.error(
          `[BALANCE_DRIFT] userId=${userId} expected=${expectedTotal} balance=${balance.totalPoint} diff=${diff}`,
        );
        void this.slackService?.reportBugToSlack(
          `⚠️ user_point_balance drift 감지\n` +
            `- userId: ${userId}\n` +
            `- expected (SUM 기반): ${expectedTotal}\n` +
            `- balance: ${balance.totalPoint}\n` +
            `- diff: ${diff}\n` +
            `- last_point_action_id: ${balance.lastPointActionId}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `[BALANCE_VERIFY] 검증 실패 userId=${userId} error=${
          error instanceof Error ? error.message : 'Unknown'
        }`,
      );
    }
  }

  async deductPoint(
    userId: string,
    amount: number,
    type: 'EXCHANGE_POINT_TO_NAVERPAY',
    additionalData: Record<string, unknown> = {},
  ): Promise<{ pointActionId: number }> {
    const result = await this.pointWriteService.addPoint({
      userId,
      amount: -amount,
      type,
      additionalData,
    });
    return { pointActionId: result.id };
  }

  async restorePoint(
    userId: string,
    amount: number,
    type: 'EXCHANGE_POINT_TO_NAVERPAY',
    originalPointActionId: number,
    additionalData: Record<string, unknown> = {},
  ): Promise<void> {
    await this.pointWriteService.addPoint({
      userId,
      amount,
      type,
      additionalData: {
        ...additionalData,
        original_point_action_id: originalPointActionId,
      },
    });
  }
}
