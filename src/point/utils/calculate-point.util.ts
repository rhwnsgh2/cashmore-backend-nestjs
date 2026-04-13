import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import {
  type PointAction,
  type WithdrawalAction,
  POINT_ADD_TYPES,
} from '../interfaces/point-repository.interface';

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * 포인트 액션 목록을 받아서 총 포인트를 계산합니다.
 */
export function calculatePointAmount(pointActions: PointAction[]): number {
  let totalPoints = 0;

  for (const action of pointActions) {
    // 적립 타입: status가 "done"일 때만 계산
    if (
      POINT_ADD_TYPES.includes(
        action.type as (typeof POINT_ADD_TYPES)[number],
      ) &&
      action.status === 'done'
    ) {
      totalPoints += action.point_amount || 0;
    }
    // EXCHANGE_POINT_TO_CASH / EXCHANGE_POINT_TO_NAVERPAY: status가 "done" 또는 "pending"일 때 계산
    else if (
      (action.type === 'EXCHANGE_POINT_TO_CASH' ||
        action.type === 'EXCHANGE_POINT_TO_NAVERPAY') &&
      (action.status === 'done' || action.status === 'pending')
    ) {
      totalPoints += action.point_amount || 0; // point_amount가 음수로 저장됨
    }
    // POINT_EXPIRATION: status가 "done"일 때만 계산
    else if (action.type === 'POINT_EXPIRATION' && action.status === 'done') {
      totalPoints += action.point_amount || 0; // point_amount가 음수로 저장됨
    }
  }

  return totalPoints;
}

/**
 * 스냅샷 기준으로 포인트를 계산합니다.
 */
export function calculatePointAmountWithSnapshot(
  beforeTotalPoints: number,
  pointActions: PointAction[],
): number {
  const additionalPoints = calculatePointAmount(pointActions);
  return beforeTotalPoints + additionalPoints;
}

/**
 * [Phase 5 검증용] 단순 SUM으로 포인트를 계산합니다.
 *
 * Phase 3/4 완료 후 모든 EXCHANGE_POINT_TO_CASH 행이 status='done'이고
 * 취소/거절도 복원 행 패턴으로 기록되므로 status 분기 없이 전체를 합산해도
 * 기존 로직과 동일한 결과가 나와야 합니다.
 *
 * 병행 검증 기간 동안 calculatePointAmount의 결과와 이 함수의 결과를 비교하여
 * 차이가 발생하면 슬랙으로 리포트합니다.
 */
export function calculatePointAmountSimple(
  pointActions: PointAction[],
): number {
  return pointActions.reduce(
    (sum, action) => sum + (action.point_amount || 0),
    0,
  );
}

/**
 * 소멸 예정 포인트를 계산합니다.
 * 핵심 로직: 소멸기준월 이전까지적립총합 - 전체출금총합 = 소멸포인트
 */
export function calculateExpiringPoints(
  totalEarnedBeforeExpiration: number,
  withdrawalActions: WithdrawalAction[],
): number {
  let totalWithdrawn = 0;

  for (const action of withdrawalActions) {
    // EXCHANGE_POINT_TO_CASH / EXCHANGE_POINT_TO_NAVERPAY: done 또는 pending
    if (
      (action.type === 'EXCHANGE_POINT_TO_CASH' ||
        action.type === 'EXCHANGE_POINT_TO_NAVERPAY') &&
      (action.status === 'done' || action.status === 'pending')
    ) {
      totalWithdrawn += Math.abs(action.point_amount || 0);
    }
    // POINT_EXPIRATION: done만
    else if (action.type === 'POINT_EXPIRATION' && action.status === 'done') {
      totalWithdrawn += Math.abs(action.point_amount || 0);
    }
  }

  // 소멸 포인트 계산: 소멸기준월 이전적립 - 전체출금 (음수 방지)
  return Math.max(0, totalEarnedBeforeExpiration - totalWithdrawn);
}

/**
 * 포인트 액션 목록을 받아서 월별로 적립된 포인트를 계산합니다.
 * created_at을 한국 시간대(Asia/Seoul) 기준으로 변환하여 월별로 그룹화합니다.
 */
export function calculateMonthlyEarnedPoints(
  pointActions: PointAction[],
): Record<string, number> {
  const monthlyPoints: Record<string, number> = {};

  for (const action of pointActions) {
    if (
      POINT_ADD_TYPES.includes(
        action.type as (typeof POINT_ADD_TYPES)[number],
      ) &&
      action.status === 'done'
    ) {
      const yearMonth = dayjs(action.created_at)
        .tz('Asia/Seoul')
        .format('YYYY-MM');

      monthlyPoints[yearMonth] =
        (monthlyPoints[yearMonth] || 0) + (action.point_amount || 0);
    }
  }

  return monthlyPoints;
}

/**
 * 포인트 액션 목록을 받아서 총 차감된 포인트를 계산합니다.
 * point_amount가 음수로 저장되어 있으므로 절대값으로 변환하여 양수로 반환합니다.
 */
export function calculateTotalWithdrawnPoints(
  pointActions: PointAction[],
): number {
  let totalWithdrawn = 0;

  for (const action of pointActions) {
    if (
      (action.type === 'EXCHANGE_POINT_TO_CASH' ||
        action.type === 'EXCHANGE_POINT_TO_NAVERPAY') &&
      (action.status === 'done' || action.status === 'pending')
    ) {
      totalWithdrawn += Math.abs(action.point_amount || 0);
    } else if (action.type === 'POINT_EXPIRATION' && action.status === 'done') {
      totalWithdrawn += Math.abs(action.point_amount || 0);
    }
  }

  return totalWithdrawn;
}

/**
 * 월별 적립 포인트와 총 차감 포인트를 받아서 FIFO 방식으로 계산하여
 * 각 월별로 남은 포인트를 반환합니다.
 */
export function calculateMonthlyRemainingPoints(
  monthlyEarnedPoints: Record<string, number>,
  totalWithdrawn: number,
): Record<string, number> {
  const sortedMonths = Object.keys(monthlyEarnedPoints).sort();
  const remainingPoints: Record<string, number> = {};
  let remainingWithdrawn = totalWithdrawn;

  for (const month of sortedMonths) {
    const earnedAmount = monthlyEarnedPoints[month];

    if (remainingWithdrawn <= 0) {
      remainingPoints[month] = earnedAmount;
    } else if (remainingWithdrawn >= earnedAmount) {
      remainingPoints[month] = 0;
      remainingWithdrawn -= earnedAmount;
    } else {
      remainingPoints[month] = earnedAmount - remainingWithdrawn;
      remainingWithdrawn = 0;
    }
  }

  return remainingPoints;
}
