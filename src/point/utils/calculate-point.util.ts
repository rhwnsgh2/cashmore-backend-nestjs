import { type PointAction } from '../interfaces/point-repository.interface';

/**
 * 포인트 액션 목록의 point_amount를 단순 합산합니다.
 *
 * point_actions가 append-only 원장으로 전환되어 모든 행이 status='done'이고
 * 취소/거절도 복원 행 패턴으로 기록되므로, status 분기 없이 단순 SUM으로
 * 잔액을 계산합니다.
 */
export function calculatePointAmount(pointActions: PointAction[]): number {
  return pointActions.reduce(
    (sum, action) => sum + (action.point_amount || 0),
    0,
  );
}

/**
 * 소멸 예정 포인트.
 *
 * 현재 소멸 배치가 운영되지 않고 있어 항상 0을 반환합니다.
 * 소멸 정책이 정해지고 배치가 운영되는 시점에 다시 구현해야 합니다.
 */
export function calculateExpiringPoints(): number {
  return 0;
}
