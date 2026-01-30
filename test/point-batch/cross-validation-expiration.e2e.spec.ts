import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { getTestSupabaseAdminClient } from '../supabase-client';
import { truncateAllTables } from '../setup';
import { createTestUser } from '../helpers/user.helper';
import {
  createPointActions,
  createMonthlyEarnedPoint,
} from '../helpers/point.helper';
import { PgPointBatchRepository } from '../../src/point-batch/repositories/pg-point-batch.repository';
import { WITHDRAW_RULES } from '../../src/point-batch/point-batch.service';
import { calculateExpiringPoints } from '../../src/point/utils/calculate-point.util';
import type { WithdrawalAction } from '../../src/point/interfaces/point-repository.interface';

dotenv.config({ path: '.env.test' });

/**
 * Cross-validation: findExpirationTargets (배치 SQL) vs calculateExpiringPoints (기존 유틸)
 *
 * 동일한 테스트 데이터에 대해 두 로직의 결과가 일치하는지 검증한다.
 *
 * - 기존 로직: 유저별로 monthly_earned_points SUM + withdrawal actions 조회 → calculateExpiringPoints 유틸
 * - 배치 로직: findExpirationTargets SQL 한방
 */
describe('Cross-validation: findExpirationTargets vs calculateExpiringPoints', () => {
  let pool: Pool;
  let repository: PgPointBatchRepository;
  const supabase = getTestSupabaseAdminClient();
  const EXPIRATION_MONTH = '2025-06';

  beforeAll(() => {
    pool = new Pool({
      connectionString: process.env.SUPABASE_DB_URL,
    });
    repository = new PgPointBatchRepository(pool);
  });

  afterAll(async () => {
    await truncateAllTables();
    await pool.end();
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  /**
   * 기존 로직을 재현: DB에서 유저별로 데이터를 꺼내 calculateExpiringPoints로 계산
   */
  async function calculateExpiringPointsPerUser(
    userId: string,
    expirationMonth: string,
  ): Promise<number> {
    // 1) monthly_earned_points에서 expirationMonth 이하 합산
    const earnedResult = await pool.query<{ earned_points: number }>(
      `SELECT earned_points FROM monthly_earned_points
       WHERE user_id = $1 AND year_month <= $2::date`,
      [userId, `${expirationMonth}-01`],
    );
    const totalEarned = earnedResult.rows.reduce(
      (sum, r) => sum + Number(r.earned_points),
      0,
    );

    // 2) withdrawal actions 조회 (기존 로직과 동일: type IN (...) 전체 조회)
    const withdrawResult = await pool.query<WithdrawalAction>(
      `SELECT point_amount, status, type FROM point_actions
       WHERE user_id = $1 AND type IN ('EXCHANGE_POINT_TO_CASH', 'POINT_EXPIRATION')`,
      [userId],
    );

    // 3) 기존 유틸 함수로 계산
    return calculateExpiringPoints(totalEarned, withdrawResult.rows);
  }

  it('적립만 있는 유저: 두 로직이 동일한 결과를 반환한다', async () => {
    const user = await createTestUser(supabase);

    await createMonthlyEarnedPoint(supabase, {
      user_id: user.id,
      year_month: '2025-03-01',
      earned_points: 500,
    });
    await createMonthlyEarnedPoint(supabase, {
      user_id: user.id,
      year_month: '2025-06-01',
      earned_points: 300,
    });

    const legacyResult = await calculateExpiringPointsPerUser(
      user.id,
      EXPIRATION_MONTH,
    );
    const batchTargets = await repository.findExpirationTargets(
      EXPIRATION_MONTH,
      WITHDRAW_RULES,
    );
    const batchResult = batchTargets.find((t) => t.userId === user.id);

    expect(batchResult).toBeDefined();
    expect(batchResult!.expiringPoints).toBe(legacyResult);
    expect(legacyResult).toBe(800);
  });

  it('출금이 있는 유저: 두 로직이 동일한 결과를 반환한다', async () => {
    const user = await createTestUser(supabase);

    await createMonthlyEarnedPoint(supabase, {
      user_id: user.id,
      year_month: '2025-04-01',
      earned_points: 1000,
    });

    await createPointActions(supabase, [
      {
        user_id: user.id,
        type: 'EXCHANGE_POINT_TO_CASH',
        point_amount: -300,
        status: 'done',
      },
      {
        user_id: user.id,
        type: 'EXCHANGE_POINT_TO_CASH',
        point_amount: -200,
        status: 'pending',
      },
    ]);

    const legacyResult = await calculateExpiringPointsPerUser(
      user.id,
      EXPIRATION_MONTH,
    );
    const batchTargets = await repository.findExpirationTargets(
      EXPIRATION_MONTH,
      WITHDRAW_RULES,
    );
    const batchResult = batchTargets.find((t) => t.userId === user.id);

    expect(batchResult).toBeDefined();
    expect(batchResult!.expiringPoints).toBe(legacyResult);
    expect(legacyResult).toBe(500);
  });

  it('소멸 이력이 있는 유저: 두 로직이 동일한 결과를 반환한다', async () => {
    const user = await createTestUser(supabase);

    await createMonthlyEarnedPoint(supabase, {
      user_id: user.id,
      year_month: '2025-02-01',
      earned_points: 800,
    });
    await createMonthlyEarnedPoint(supabase, {
      user_id: user.id,
      year_month: '2025-05-01',
      earned_points: 400,
    });

    await createPointActions(supabase, [
      {
        user_id: user.id,
        type: 'POINT_EXPIRATION',
        point_amount: -300,
        status: 'done',
      },
      {
        user_id: user.id,
        type: 'EXCHANGE_POINT_TO_CASH',
        point_amount: -100,
        status: 'done',
      },
    ]);

    const legacyResult = await calculateExpiringPointsPerUser(
      user.id,
      EXPIRATION_MONTH,
    );
    const batchTargets = await repository.findExpirationTargets(
      EXPIRATION_MONTH,
      WITHDRAW_RULES,
    );
    const batchResult = batchTargets.find((t) => t.userId === user.id);

    expect(batchResult).toBeDefined();
    expect(batchResult!.expiringPoints).toBe(legacyResult);
    // 1200 - 300 - 100 = 800
    expect(legacyResult).toBe(800);
  });

  it('전액 출금한 유저: 두 로직 모두 0을 반환한다', async () => {
    const user = await createTestUser(supabase);

    await createMonthlyEarnedPoint(supabase, {
      user_id: user.id,
      year_month: '2025-06-01',
      earned_points: 500,
    });

    await createPointActions(supabase, [
      {
        user_id: user.id,
        type: 'EXCHANGE_POINT_TO_CASH',
        point_amount: -500,
        status: 'done',
      },
    ]);

    const legacyResult = await calculateExpiringPointsPerUser(
      user.id,
      EXPIRATION_MONTH,
    );
    const batchTargets = await repository.findExpirationTargets(
      EXPIRATION_MONTH,
      WITHDRAW_RULES,
    );
    const batchResult = batchTargets.find((t) => t.userId === user.id);

    // 둘 다 0 → 배치에서는 대상에서 제외
    expect(legacyResult).toBe(0);
    expect(batchResult).toBeUndefined();
  });

  it('cancelled 출금은 두 로직 모두 무시한다', async () => {
    const user = await createTestUser(supabase);

    await createMonthlyEarnedPoint(supabase, {
      user_id: user.id,
      year_month: '2025-06-01',
      earned_points: 1000,
    });

    await createPointActions(supabase, [
      {
        user_id: user.id,
        type: 'EXCHANGE_POINT_TO_CASH',
        point_amount: -1000,
        status: 'cancelled',
      },
    ]);

    const legacyResult = await calculateExpiringPointsPerUser(
      user.id,
      EXPIRATION_MONTH,
    );
    const batchTargets = await repository.findExpirationTargets(
      EXPIRATION_MONTH,
      WITHDRAW_RULES,
    );
    const batchResult = batchTargets.find((t) => t.userId === user.id);

    expect(batchResult).toBeDefined();
    expect(batchResult!.expiringPoints).toBe(legacyResult);
    expect(legacyResult).toBe(1000);
  });

  it('POINT_EXPIRATION pending은 두 로직 모두 무시한다', async () => {
    const user = await createTestUser(supabase);

    await createMonthlyEarnedPoint(supabase, {
      user_id: user.id,
      year_month: '2025-06-01',
      earned_points: 1000,
    });

    await createPointActions(supabase, [
      {
        user_id: user.id,
        type: 'POINT_EXPIRATION',
        point_amount: -500,
        status: 'pending',
      },
    ]);

    const legacyResult = await calculateExpiringPointsPerUser(
      user.id,
      EXPIRATION_MONTH,
    );
    const batchTargets = await repository.findExpirationTargets(
      EXPIRATION_MONTH,
      WITHDRAW_RULES,
    );
    const batchResult = batchTargets.find((t) => t.userId === user.id);

    expect(batchResult).toBeDefined();
    expect(batchResult!.expiringPoints).toBe(legacyResult);
    expect(legacyResult).toBe(1000);
  });

  it('여러 유저 복합 시나리오: 모든 유저에 대해 두 로직이 일치한다', async () => {
    const userA = await createTestUser(supabase);
    const userB = await createTestUser(supabase);
    const userC = await createTestUser(supabase);

    // userA: 적립 1500, 출금 400 → 1100
    await createMonthlyEarnedPoint(supabase, {
      user_id: userA.id,
      year_month: '2025-03-01',
      earned_points: 1000,
    });
    await createMonthlyEarnedPoint(supabase, {
      user_id: userA.id,
      year_month: '2025-06-01',
      earned_points: 500,
    });
    await createPointActions(supabase, [
      {
        user_id: userA.id,
        type: 'EXCHANGE_POINT_TO_CASH',
        point_amount: -400,
        status: 'done',
      },
    ]);

    // userB: 적립 800, 출금 800 → 0 (대상 제외)
    await createMonthlyEarnedPoint(supabase, {
      user_id: userB.id,
      year_month: '2025-04-01',
      earned_points: 800,
    });
    await createPointActions(supabase, [
      {
        user_id: userB.id,
        type: 'EXCHANGE_POINT_TO_CASH',
        point_amount: -500,
        status: 'done',
      },
      {
        user_id: userB.id,
        type: 'POINT_EXPIRATION',
        point_amount: -300,
        status: 'done',
      },
    ]);

    // userC: 적립 2000, 소멸 500 + 출금 pending 200 → 1300
    await createMonthlyEarnedPoint(supabase, {
      user_id: userC.id,
      year_month: '2025-01-01',
      earned_points: 1200,
    });
    await createMonthlyEarnedPoint(supabase, {
      user_id: userC.id,
      year_month: '2025-05-01',
      earned_points: 800,
    });
    await createPointActions(supabase, [
      {
        user_id: userC.id,
        type: 'POINT_EXPIRATION',
        point_amount: -500,
        status: 'done',
      },
      {
        user_id: userC.id,
        type: 'EXCHANGE_POINT_TO_CASH',
        point_amount: -200,
        status: 'pending',
      },
    ]);

    // 배치 결과
    const batchTargets = await repository.findExpirationTargets(
      EXPIRATION_MONTH,
      WITHDRAW_RULES,
    );

    // 각 유저별 기존 로직 결과와 비교
    for (const user of [userA, userB, userC]) {
      const legacyResult = await calculateExpiringPointsPerUser(
        user.id,
        EXPIRATION_MONTH,
      );
      const batchTarget = batchTargets.find((t) => t.userId === user.id);

      if (legacyResult === 0) {
        expect(batchTarget).toBeUndefined();
      } else {
        expect(batchTarget).toBeDefined();
        expect(batchTarget!.expiringPoints).toBe(legacyResult);
      }
    }

    // 구체적 값 검증
    expect(
      await calculateExpiringPointsPerUser(userA.id, EXPIRATION_MONTH),
    ).toBe(1100);
    expect(
      await calculateExpiringPointsPerUser(userB.id, EXPIRATION_MONTH),
    ).toBe(0);
    expect(
      await calculateExpiringPointsPerUser(userC.id, EXPIRATION_MONTH),
    ).toBe(1300);
  });

  it('혼합 상태의 출금이 여러 건: 두 로직이 동일하게 필터한다', async () => {
    const user = await createTestUser(supabase);

    await createMonthlyEarnedPoint(supabase, {
      user_id: user.id,
      year_month: '2025-06-01',
      earned_points: 2000,
    });

    await createPointActions(supabase, [
      // 차감됨: EXCHANGE done 300
      {
        user_id: user.id,
        type: 'EXCHANGE_POINT_TO_CASH',
        point_amount: -300,
        status: 'done',
      },
      // 차감됨: EXCHANGE pending 200
      {
        user_id: user.id,
        type: 'EXCHANGE_POINT_TO_CASH',
        point_amount: -200,
        status: 'pending',
      },
      // 무시: EXCHANGE cancelled
      {
        user_id: user.id,
        type: 'EXCHANGE_POINT_TO_CASH',
        point_amount: -500,
        status: 'cancelled',
      },
      // 차감됨: POINT_EXPIRATION done 100
      {
        user_id: user.id,
        type: 'POINT_EXPIRATION',
        point_amount: -100,
        status: 'done',
      },
      // 무시: POINT_EXPIRATION pending
      {
        user_id: user.id,
        type: 'POINT_EXPIRATION',
        point_amount: -400,
        status: 'pending',
      },
    ]);

    const legacyResult = await calculateExpiringPointsPerUser(
      user.id,
      EXPIRATION_MONTH,
    );
    const batchTargets = await repository.findExpirationTargets(
      EXPIRATION_MONTH,
      WITHDRAW_RULES,
    );
    const batchResult = batchTargets.find((t) => t.userId === user.id);

    expect(batchResult).toBeDefined();
    expect(batchResult!.expiringPoints).toBe(legacyResult);
    // 2000 - (300 + 200 + 100) = 1400
    expect(legacyResult).toBe(1400);
  });
});
