import { Inject, Injectable } from '@nestjs/common';
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

    // 이번주 월요일 ~ 다음주 월요일
    const thisWeekStart = now.startOf('week').add(1, 'day'); // 월요일
    const thisWeekEnd = thisWeekStart.add(7, 'day');

    // 지난주 월요일 ~ 이번주 월요일
    const lastWeekStart = thisWeekStart.subtract(7, 'day');
    const lastWeekEnd = thisWeekStart;

    const [lastWeekPoint, weeklyPoint] = await Promise.all([
      this.pointRepository.findEarnedPointsBetween(
        userId,
        lastWeekStart.toISOString(),
        lastWeekEnd.toISOString(),
      ),
      this.pointRepository.findEarnedPointsBetween(
        userId,
        thisWeekStart.toISOString(),
        thisWeekEnd.toISOString(),
      ),
    ]);

    return {
      totalPoint,
      expiringPoints,
      expiringDate,
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

    // 6개월 전 월 계산
    const expirationMonth = dayjs(baseDate)
      .startOf('month')
      .subtract(6, 'month')
      .format('YYYY-MM-DD');

    // 6개월 전까지의 월별 적립 포인트 조회
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
