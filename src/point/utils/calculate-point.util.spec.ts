import { describe, it, expect } from 'vitest';
import {
  calculatePointAmount,
  calculatePointAmountWithSnapshot,
  calculateExpiringPoints,
  calculateMonthlyEarnedPoints,
  calculateTotalWithdrawnPoints,
  calculateMonthlyRemainingPoints,
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

describe('calculateMonthlyEarnedPoints', () => {
  it('같은 월에 여러 번 적립된 경우 합산', () => {
    const actions: PointAction[] = [
      {
        id: 1,
        type: 'EVERY_RECEIPT',
        created_at: '2024-04-10T10:00:00Z',
        point_amount: 500,
        status: 'done',
      },
      {
        id: 2,
        type: 'INVITE_REWARD',
        created_at: '2024-04-15T10:00:00Z',
        point_amount: 300,
        status: 'done',
      },
      {
        id: 3,
        type: 'ATTENDANCE',
        created_at: '2024-04-20T10:00:00Z',
        point_amount: 200,
        status: 'done',
      },
    ];

    expect(calculateMonthlyEarnedPoints(actions)).toEqual({ '2024-04': 1000 });
  });

  it('다른 월에 적립된 경우 각각 분리', () => {
    const actions: PointAction[] = [
      {
        id: 1,
        type: 'EVERY_RECEIPT',
        created_at: '2024-04-10T10:00:00Z',
        point_amount: 500,
        status: 'done',
      },
      {
        id: 2,
        type: 'INVITE_REWARD',
        created_at: '2024-05-15T10:00:00Z',
        point_amount: 300,
        status: 'done',
      },
      {
        id: 3,
        type: 'ATTENDANCE',
        created_at: '2024-06-20T10:00:00Z',
        point_amount: 200,
        status: 'done',
      },
    ];

    expect(calculateMonthlyEarnedPoints(actions)).toEqual({
      '2024-04': 500,
      '2024-05': 300,
      '2024-06': 200,
    });
  });

  it('status가 done이 아닌 경우 제외', () => {
    const actions: PointAction[] = [
      {
        id: 1,
        type: 'EVERY_RECEIPT',
        created_at: '2024-04-10T10:00:00Z',
        point_amount: 500,
        status: 'done',
      },
      {
        id: 2,
        type: 'INVITE_REWARD',
        created_at: '2024-04-15T10:00:00Z',
        point_amount: 300,
        status: 'pending',
      },
      {
        id: 3,
        type: 'ATTENDANCE',
        created_at: '2024-04-20T10:00:00Z',
        point_amount: 200,
        status: 'failed',
      },
    ];

    expect(calculateMonthlyEarnedPoints(actions)).toEqual({ '2024-04': 500 });
  });

  it('POINT_ADD_TYPES가 아닌 타입은 제외', () => {
    const actions: PointAction[] = [
      {
        id: 1,
        type: 'EVERY_RECEIPT',
        created_at: '2024-04-10T10:00:00Z',
        point_amount: 500,
        status: 'done',
      },
      {
        id: 2,
        type: 'EXCHANGE_POINT_TO_CASH',
        created_at: '2024-04-15T10:00:00Z',
        point_amount: -300,
        status: 'done',
      },
    ];

    expect(calculateMonthlyEarnedPoints(actions)).toEqual({ '2024-04': 500 });
  });

  it('빈 배열인 경우 빈 객체 반환', () => {
    expect(calculateMonthlyEarnedPoints([])).toEqual({});
  });
});

describe('calculateTotalWithdrawnPoints', () => {
  it('여러 번 출금한 경우 모두 합산', () => {
    const actions: PointAction[] = [
      {
        id: 1,
        type: 'EXCHANGE_POINT_TO_CASH',
        created_at: '2024-04-10T10:00:00Z',
        point_amount: -500,
        status: 'done',
      },
      {
        id: 2,
        type: 'EXCHANGE_POINT_TO_CASH',
        created_at: '2024-04-15T10:00:00Z',
        point_amount: -300,
        status: 'done',
      },
    ];

    expect(calculateTotalWithdrawnPoints(actions)).toBe(800);
  });

  it('EXCHANGE_POINT_TO_CASH는 done과 pending 모두 포함', () => {
    const actions: PointAction[] = [
      {
        id: 1,
        type: 'EXCHANGE_POINT_TO_CASH',
        created_at: '2024-04-10T10:00:00Z',
        point_amount: -500,
        status: 'done',
      },
      {
        id: 2,
        type: 'EXCHANGE_POINT_TO_CASH',
        created_at: '2024-04-15T10:00:00Z',
        point_amount: -300,
        status: 'pending',
      },
    ];

    expect(calculateTotalWithdrawnPoints(actions)).toBe(800);
  });

  it('POINT_EXPIRATION은 done만 포함, pending 제외', () => {
    const actions: PointAction[] = [
      {
        id: 1,
        type: 'POINT_EXPIRATION',
        created_at: '2024-04-10T10:00:00Z',
        point_amount: -500,
        status: 'done',
      },
      {
        id: 2,
        type: 'POINT_EXPIRATION',
        created_at: '2024-04-15T10:00:00Z',
        point_amount: -300,
        status: 'pending',
      },
    ];

    expect(calculateTotalWithdrawnPoints(actions)).toBe(500);
  });

  it('적립 타입은 제외', () => {
    const actions: PointAction[] = [
      {
        id: 1,
        type: 'EVERY_RECEIPT',
        created_at: '2024-04-10T10:00:00Z',
        point_amount: 500,
        status: 'done',
      },
      {
        id: 2,
        type: 'EXCHANGE_POINT_TO_CASH',
        created_at: '2024-04-15T10:00:00Z',
        point_amount: -300,
        status: 'done',
      },
    ];

    expect(calculateTotalWithdrawnPoints(actions)).toBe(300);
  });

  it('빈 배열인 경우 0 반환', () => {
    expect(calculateTotalWithdrawnPoints([])).toBe(0);
  });
});

describe('calculateMonthlyRemainingPoints', () => {
  it('차감액이 첫 달 적립액보다 적은 경우', () => {
    const result = calculateMonthlyRemainingPoints(
      { '2024-01': 1000, '2024-02': 500, '2024-03': 300 },
      600,
    );

    expect(result).toEqual({ '2024-01': 400, '2024-02': 500, '2024-03': 300 });
  });

  it('차감액이 여러 달에 걸쳐 차감되는 경우', () => {
    const result = calculateMonthlyRemainingPoints(
      { '2024-01': 1000, '2024-02': 500, '2024-03': 300 },
      1200,
    );

    expect(result).toEqual({ '2024-01': 0, '2024-02': 300, '2024-03': 300 });
  });

  it('차감액이 모든 적립액을 초과하는 경우', () => {
    const result = calculateMonthlyRemainingPoints(
      { '2024-01': 1000, '2024-02': 500 },
      2000,
    );

    expect(result).toEqual({ '2024-01': 0, '2024-02': 0 });
  });

  it('차감액이 0인 경우', () => {
    const result = calculateMonthlyRemainingPoints(
      { '2024-01': 1000, '2024-02': 500, '2024-03': 300 },
      0,
    );

    expect(result).toEqual({ '2024-01': 1000, '2024-02': 500, '2024-03': 300 });
  });

  it('적립액이 없는 경우', () => {
    expect(calculateMonthlyRemainingPoints({}, 1000)).toEqual({});
  });

  it('여러 달에 걸쳐 정확히 소진되는 경우', () => {
    const result = calculateMonthlyRemainingPoints(
      { '2024-01': 1000, '2024-02': 500, '2024-03': 300, '2024-04': 200 },
      1500,
    );

    expect(result).toEqual({
      '2024-01': 0,
      '2024-02': 0,
      '2024-03': 300,
      '2024-04': 200,
    });
  });
});
