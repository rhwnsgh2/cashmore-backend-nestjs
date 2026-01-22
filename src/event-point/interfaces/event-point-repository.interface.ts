export type EventPointType =
  | 'COUPANG_VISIT'
  | 'ONBOARDING_EVENT'
  | 'AFFILIATE'
  | 'LOTTERY';

export interface EventPoint {
  id: number;
  type: EventPointType;
  createdAt: string;
  point: number;
}

export interface IEventPointRepository {
  findByUserId(userId: string): Promise<EventPoint[]>;
}

export const EVENT_POINT_REPOSITORY = Symbol('EVENT_POINT_REPOSITORY');
