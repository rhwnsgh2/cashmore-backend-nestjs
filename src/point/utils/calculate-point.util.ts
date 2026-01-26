import {
  type PointAction,
  type WithdrawalAction,
  POINT_ADD_TYPES,
} from '../interfaces/point-repository.interface';

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
    // EXCHANGE_POINT_TO_CASH: status가 "done" 또는 "pending"일 때 계산
    else if (
      action.type === 'EXCHANGE_POINT_TO_CASH' &&
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
 * 소멸 예정 포인트를 계산합니다.
 * 핵심 로직: 6개월전까지적립총합 - 전체출금총합 = 소멸포인트
 */
export function calculateExpiringPoints(
  totalEarnedBeforeExpiration: number,
  withdrawalActions: WithdrawalAction[],
): number {
  let totalWithdrawn = 0;

  for (const action of withdrawalActions) {
    // EXCHANGE_POINT_TO_CASH: done 또는 pending
    if (
      action.type === 'EXCHANGE_POINT_TO_CASH' &&
      (action.status === 'done' || action.status === 'pending')
    ) {
      totalWithdrawn += Math.abs(action.point_amount || 0);
    }
    // POINT_EXPIRATION: done만
    else if (action.type === 'POINT_EXPIRATION' && action.status === 'done') {
      totalWithdrawn += Math.abs(action.point_amount || 0);
    }
  }

  // 소멸 포인트 계산: 6개월전적립 - 전체출금 (음수 방지)
  return Math.max(0, totalEarnedBeforeExpiration - totalWithdrawn);
}
