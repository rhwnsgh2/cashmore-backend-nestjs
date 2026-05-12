import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import type { IPointRepository } from './interfaces/point-repository.interface';
import { POINT_REPOSITORY } from './interfaces/point-repository.interface';
import { calculateExpiringPoints } from './utils/calculate-point.util';
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

    // user_point_balance에서 직접 totalPoint 조회 (sum_user_points RPC 대체)
    // row가 없거나 조회 실패 시 sum_user_points로 폴백 (안전망)
    let totalPoint: number;
    try {
      const balance = await this.pointRepository.findBalance(userId);
      if (balance) {
        totalPoint = balance.totalPoint;
      } else {
        // row 없음 (신규 유저이거나 누락 케이스) → SUM으로 폴백
        totalPoint = await this.calculateTotalPoint(userId);
      }
    } catch (error) {
      // DB 에러 → SUM으로 폴백
      this.logger.warn(
        `[POINT_TOTAL] findBalance failed, fallback to SUM userId=${userId} error=${
          error instanceof Error ? error.message : 'Unknown'
        }`,
      );
      totalPoint = await this.calculateTotalPoint(userId);
    }

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
    return this.pointRepository.findTotalPointSum(userId);
  }

  /**
   * 어드민 큐 등 N+1 회피용 배치 잔액 조회.
   * user_point_balance row 없으면 0으로 반환 (어드민 큐에 등장한다는 건 차감 이력이 있다는 뜻이라 보통 row 존재).
   */
  async getTotalPointsMap(userIds: string[]): Promise<Map<string, number>> {
    const unique = Array.from(new Set(userIds));
    const map = await this.pointRepository.findBalancesByUserIds(unique);
    for (const id of unique) {
      if (!map.has(id)) map.set(id, 0);
    }
    return map;
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
