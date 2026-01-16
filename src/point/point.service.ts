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
}

@Injectable()
export class PointService {
  constructor(
    @Inject(POINT_REPOSITORY)
    private pointRepository: IPointRepository,
  ) {}

  async getPointTotal(userId: string): Promise<PointTotalResult> {
    const totalPoint = await this.calculateTotalPoint(userId);
    const expiringPoints = await this.calculateExpiringPoints(userId);
    const expiringDate = dayjs()
      .tz('Asia/Seoul')
      .endOf('month')
      .format('YYYY-MM-DD');

    return {
      totalPoint,
      expiringPoints,
      expiringDate,
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
