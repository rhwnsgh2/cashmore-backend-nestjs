import { describe, it, expect } from 'vitest';
import {
  calculatePointAmount,
  calculatePointAmountWithSnapshot,
  calculateExpiringPoints,
} from './calculate-point.util';
import type {
  PointAction,
  WithdrawalAction,
} from '../interfaces/point-repository.interface';

describe('calculatePointAmount', () => {
  it('적립 타입이고 status가 done이면 포인트를 더한다', () => {
    const actions: PointAction[] = [
      {
        id: 1,
        type: 'EVERY_RECEIPT',
        created_at: '2024-01-01',
        point_amount: 100,
        status: 'done',
      },
      {
        id: 2,
        type: 'ATTENDANCE',
        created_at: '2024-01-02',
        point_amount: 50,
        status: 'done',
      },
    ];

    expect(calculatePointAmount(actions)).toBe(150);
  });

  it('적립 타입이지만 status가 done이 아니면 계산하지 않는다', () => {
    const actions: PointAction[] = [
      {
        id: 1,
        type: 'EVERY_RECEIPT',
        created_at: '2024-01-01',
        point_amount: 100,
        status: 'pending',
      },
      {
        id: 2,
        type: 'ATTENDANCE',
        created_at: '2024-01-02',
        point_amount: 50,
        status: 'failed',
      },
    ];

    expect(calculatePointAmount(actions)).toBe(0);
  });

  it('EXCHANGE_POINT_TO_CASH는 done 또는 pending일 때 차감한다', () => {
    const actions: PointAction[] = [
      {
        id: 1,
        type: 'EVERY_RECEIPT',
        created_at: '2024-01-01',
        point_amount: 1000,
        status: 'done',
      },
      {
        id: 2,
        type: 'EXCHANGE_POINT_TO_CASH',
        created_at: '2024-01-02',
        point_amount: -500, // 음수로 저장됨
        status: 'done',
      },
    ];

    expect(calculatePointAmount(actions)).toBe(500);
  });

  it('EXCHANGE_POINT_TO_CASH pending도 차감에 포함한다', () => {
    const actions: PointAction[] = [
      {
        id: 1,
        type: 'EVERY_RECEIPT',
        created_at: '2024-01-01',
        point_amount: 1000,
        status: 'done',
      },
      {
        id: 2,
        type: 'EXCHANGE_POINT_TO_CASH',
        created_at: '2024-01-02',
        point_amount: -300,
        status: 'pending',
      },
    ];

    expect(calculatePointAmount(actions)).toBe(700);
  });

  it('POINT_EXPIRATION은 done일 때만 차감한다', () => {
    const actions: PointAction[] = [
      {
        id: 1,
        type: 'EVERY_RECEIPT',
        created_at: '2024-01-01',
        point_amount: 1000,
        status: 'done',
      },
      {
        id: 2,
        type: 'POINT_EXPIRATION',
        created_at: '2024-01-02',
        point_amount: -200,
        status: 'done',
      },
      {
        id: 3,
        type: 'POINT_EXPIRATION',
        created_at: '2024-01-03',
        point_amount: -100,
        status: 'pending', // pending은 계산 안함
      },
    ];

    expect(calculatePointAmount(actions)).toBe(800);
  });

  it('빈 배열이면 0을 반환한다', () => {
    expect(calculatePointAmount([])).toBe(0);
  });
});

describe('calculatePointAmountWithSnapshot', () => {
  it('스냅샷 잔액에 추가 포인트 액션을 더한다', () => {
    const beforeTotalPoints = 5000;
    const actions: PointAction[] = [
      {
        id: 1,
        type: 'EVERY_RECEIPT',
        created_at: '2024-01-01',
        point_amount: 100,
        status: 'done',
      },
    ];

    expect(calculatePointAmountWithSnapshot(beforeTotalPoints, actions)).toBe(
      5100,
    );
  });

  it('추가 액션이 없으면 스냅샷 잔액을 그대로 반환한다', () => {
    expect(calculatePointAmountWithSnapshot(5000, [])).toBe(5000);
  });

  it('차감 액션이 있으면 스냅샷에서 뺀다', () => {
    const beforeTotalPoints = 5000;
    const actions: PointAction[] = [
      {
        id: 1,
        type: 'EXCHANGE_POINT_TO_CASH',
        created_at: '2024-01-01',
        point_amount: -1000,
        status: 'done',
      },
    ];

    expect(calculatePointAmountWithSnapshot(beforeTotalPoints, actions)).toBe(
      4000,
    );
  });
});

describe('calculateExpiringPoints', () => {
  it('6개월전 적립 - 전체 출금 = 소멸 포인트', () => {
    const totalEarnedBeforeExpiration = 10000;
    const withdrawalActions: WithdrawalAction[] = [
      {
        type: 'EXCHANGE_POINT_TO_CASH',
        point_amount: -3000,
        status: 'done',
      },
    ];

    expect(
      calculateExpiringPoints(totalEarnedBeforeExpiration, withdrawalActions),
    ).toBe(7000);
  });

  it('출금이 적립보다 많으면 0을 반환한다 (음수 방지)', () => {
    const totalEarnedBeforeExpiration = 1000;
    const withdrawalActions: WithdrawalAction[] = [
      {
        type: 'EXCHANGE_POINT_TO_CASH',
        point_amount: -5000,
        status: 'done',
      },
    ];

    expect(
      calculateExpiringPoints(totalEarnedBeforeExpiration, withdrawalActions),
    ).toBe(0);
  });

  it('EXCHANGE_POINT_TO_CASH pending도 출금에 포함한다', () => {
    const totalEarnedBeforeExpiration = 10000;
    const withdrawalActions: WithdrawalAction[] = [
      {
        type: 'EXCHANGE_POINT_TO_CASH',
        point_amount: -2000,
        status: 'done',
      },
      {
        type: 'EXCHANGE_POINT_TO_CASH',
        point_amount: -1000,
        status: 'pending',
      },
    ];

    expect(
      calculateExpiringPoints(totalEarnedBeforeExpiration, withdrawalActions),
    ).toBe(7000);
  });

  it('POINT_EXPIRATION은 done만 출금에 포함한다', () => {
    const totalEarnedBeforeExpiration = 10000;
    const withdrawalActions: WithdrawalAction[] = [
      {
        type: 'POINT_EXPIRATION',
        point_amount: -2000,
        status: 'done',
      },
      {
        type: 'POINT_EXPIRATION',
        point_amount: -1000,
        status: 'pending', // 포함 안됨
      },
    ];

    expect(
      calculateExpiringPoints(totalEarnedBeforeExpiration, withdrawalActions),
    ).toBe(8000);
  });

  it('출금 액션이 없으면 적립 전체가 소멸 대상', () => {
    expect(calculateExpiringPoints(5000, [])).toBe(5000);
  });
});
