/**
 * @deprecated 쿠팡 오늘 방문 여부 확인용으로 축소됨. 신규 전용 엔드포인트로 대체 예정.
 */
export type EventPointType = 'COUPANG_VISIT';

/**
 * @deprecated 쿠팡 오늘 방문 여부 확인용으로 축소됨. 신규 전용 엔드포인트로 대체 예정.
 */
export interface EventPoint {
  id: number;
  type: EventPointType;
  createdAt: string;
  point: number;
}

/**
 * @deprecated 쿠팡 오늘 방문 여부 확인용으로 축소됨. 신규 전용 엔드포인트로 대체 예정.
 */
export interface IEventPointRepository {
  findByUserId(userId: string): Promise<EventPoint[]>;
}

export const EVENT_POINT_REPOSITORY = Symbol('EVENT_POINT_REPOSITORY');
