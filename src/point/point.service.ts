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

    // user_point_balance 검증 일시 중단 (정합성 설계 재검토 중)
    // void this.verifyBalance(userId);

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
    const legacyTotal = calculatePointAmount(pointActions);

    // 병렬 검증: DB SUM(RPC)과 비교 (비차단). cutoff로 race 면역.
    const cutoff = pointActions.reduce(
      (max, a) => (a.id > max ? a.id : max),
      0,
    );
    void this.compareWithRpcSum(userId, legacyTotal, cutoff);

    return legacyTotal;
  }

  /**
   * 기존 JS reduce SUM과 DB RPC SUM을 같은 cutoff(id <= maxId)로 비교.
   * point_actions가 append-only라 두 호출 시점이 달라도 같은 행 집합 위에서 동작.
   * 비차단 fire-and-forget. 불일치 시에만 로그 + 슬랙 리포트.
   */
  private async compareWithRpcSum(
    userId: string,
    legacyTotal: number,
    maxId: number,
  ): Promise<void> {
    try {
      const rpcSum = await this.pointRepository.findTotalPointSumViaRpc(
        userId,
        maxId,
      );
      if (rpcSum !== legacyTotal) {
        const diff = legacyTotal - rpcSum;
        this.logger.error(
          `[POINT_SUM_DRIFT] userId=${userId} legacy=${legacyTotal} rpc=${rpcSum} diff=${diff} maxId=${maxId}`,
        );
        void this.slackService?.reportBugToSlack(
          `⚠️ point sum 병렬 검증 불일치\n` +
            `- userId: ${userId}\n` +
            `- legacy(JS reduce): ${legacyTotal}\n` +
            `- rpc(DB SUM): ${rpcSum}\n` +
            `- diff: ${diff}\n` +
            `- maxId: ${maxId}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `[POINT_SUM_VERIFY] 검증 실패 userId=${userId} error=${
          error instanceof Error ? error.message : 'Unknown'
        }`,
      );
    }
  }

  // user_point_balance 검증 일시 중단 (정합성 설계 재검토 중)
  // private async verifyBalance(userId: string): Promise<void> {
  //   try {
  //     const balance = await this.pointRepository.findBalance(userId);
  //     if (!balance) return;
  //
  //     const expectedSum = await this.pointRepository.findSumUpToId(
  //       userId,
  //       balance.lastPointActionId,
  //     );
  //
  //     if (balance.totalPoint !== expectedSum) {
  //       const diff = balance.totalPoint - expectedSum;
  //       this.logger.error(
  //         `[BALANCE_DRIFT] userId=${userId} balance=${balance.totalPoint} expected=${expectedSum} diff=${diff} last_id=${balance.lastPointActionId}`,
  //       );
  //       void this.slackService?.reportBugToSlack(
  //         `⚠️ user_point_balance drift 감지\n` +
  //           `- userId: ${userId}\n` +
  //           `- balance: ${balance.totalPoint}\n` +
  //           `- expected (SUM up to last_id): ${expectedSum}\n` +
  //           `- diff: ${diff}\n` +
  //           `- last_point_action_id: ${balance.lastPointActionId}`,
  //       );
  //     }
  //   } catch (error) {
  //     this.logger.warn(
  //       `[BALANCE_VERIFY] 검증 실패 userId=${userId} error=${
  //         error instanceof Error ? error.message : 'Unknown'
  //       }`,
  //     );
  //   }
  // }

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
