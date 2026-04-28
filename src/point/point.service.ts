import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import type {
  IPointRepository,
  PointBalance,
} from './interfaces/point-repository.interface';
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

    // SUM과 cached balance를 병렬 조회 — race window 최소화 (1~5ms)
    const [totalPoint, balance] = await Promise.all([
      this.calculateTotalPoint(userId),
      this.pointRepository.findBalance(userId),
    ]);

    void this.syncBalance(userId, totalPoint, balance);

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

  private async syncBalance(
    userId: string,
    expected: number,
    balance: PointBalance | null,
  ): Promise<void> {
    try {
      const cached = balance?.totalPoint ?? 0;
      if (cached === expected) {
        return;
      }

      const diff = expected - cached;
      void this.slackService?.reportBugToSlack(
        `⚠️ user_point_balance drift\n` +
          `- userId: ${userId}\n` +
          `- cached: ${balance ? balance.totalPoint : '(no row)'}\n` +
          `- expected: ${expected}\n` +
          `- diff: ${diff}`,
      );

      await this.pointRepository.saveBalance(userId, expected);
    } catch (error) {
      this.logger.warn(
        `[BALANCE_SYNC] failed userId=${userId} error=${
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
