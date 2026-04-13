import { describe, it, expect } from 'vitest';
import {
  calculatePointAmount,
  calculateExpiringPoints,
} from './calculate-point.util';
import type { PointAction } from '../interfaces/point-repository.interface';

describe('calculatePointAmount', () => {
  it('모든 point_amount를 단순 합산한다', () => {
    const actions: PointAction[] = [
      {
        id: 1,
        type: 'EVERY_RECEIPT',
        created_at: '2024-01-01',
        point_amount: 500,
        status: 'done',
      },
      {
        id: 2,
        type: 'EXCHANGE_POINT_TO_CASH',
        created_at: '2024-01-02',
        point_amount: -300,
        status: 'done',
      },
      {
        id: 3,
        type: 'EXCHANGE_POINT_TO_CASH',
        created_at: '2024-01-03',
        point_amount: 300,
        status: 'done',
      },
    ];

    expect(calculatePointAmount(actions)).toBe(500);
  });

  it('빈 배열이면 0을 반환한다', () => {
    expect(calculatePointAmount([])).toBe(0);
  });

  it('point_amount가 null인 항목은 0으로 취급한다', () => {
    const actions: PointAction[] = [
      {
        id: 1,
        type: 'EVERY_RECEIPT',
        created_at: '2024-01-01',
        point_amount: null as unknown as number,
        status: 'done',
      },
      {
        id: 2,
        type: 'EVERY_RECEIPT',
        created_at: '2024-01-02',
        point_amount: 500,
        status: 'done',
      },
    ];

    expect(calculatePointAmount(actions)).toBe(500);
  });
});

describe('calculateExpiringPoints', () => {
  it('소멸 배치가 운영되지 않아 항상 0을 반환한다', () => {
    expect(calculateExpiringPoints()).toBe(0);
  });
});
