import { Inject, Injectable } from '@nestjs/common';
import { POINT_EXPIRATION_MONTHS } from '../common/constants/point.constants';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import type { IPointRepository } from './interfaces/point-repository.interface';
import { POINT_REPOSITORY } from './interfaces/point-repository.interface';
import {
  calculatePointAmount,
  calculatePointAmountWithSnapshot,
  calculateExpiringPoints,
} from './utils/calculate-point.util';

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
  constructor(
    @Inject(POINT_REPOSITORY)
    private pointRepository: IPointRepository,
  ) {}

  async getPointTotal(userId: string): Promise<PointTotalResult> {
    const now = dayjs().tz('Asia/Seoul');

    const totalPoint = await this.calculateTotalPoint(userId);
    const expiringPoints = await this.calculateExpiringPoints(userId);
    const expiringDate = now.endOf('month').format('YYYY-MM-DD');

    // 오늘
    const todayStart = now.startOf('day');

    // 이번주 월요일 ~ 다음주 월요일
    const thisWeekStart = now.startOf('week').add(1, 'day'); // 월요일

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

      return calculatePointAmountWithSnapshot(
        snapshot.point_balance,
        pointActions,
      );
    }

    const pointActions = await this.pointRepository.findAllPointActions(userId);
    return calculatePointAmount(pointActions);
  }

  private async calculateExpiringPoints(userId: string): Promise<number> {
    const baseDate = dayjs().tz('Asia/Seoul').format('YYYY-MM-DD');

    // 소멸 기준월 계산
    const expirationMonth = dayjs(baseDate)
      .startOf('month')
      .subtract(POINT_EXPIRATION_MONTHS, 'month')
      .format('YYYY-MM-DD');

    // 소멸 기준월까지의 월별 적립 포인트 조회
    const monthlyPoints =
      await this.pointRepository.findMonthlyEarnedPointsUntil(
        userId,
        expirationMonth,
      );

    const totalEarnedBeforeExpiration = monthlyPoints.reduce(
      (sum, row) => sum + (row.earned_points || 0),
      0,
    );

    // 전체 출금/차감 포인트 조회
    const withdrawalActions =
      await this.pointRepository.findWithdrawalActions(userId);

    return calculateExpiringPoints(
      totalEarnedBeforeExpiration,
      withdrawalActions,
    );
  }
}
