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

dotenv.config({ path: '.env.test' });

describe('PgPointBatchRepository.findExpirationTargets', () => {
  let pool: Pool;
  let repository: PgPointBatchRepository;
  const supabase = getTestSupabaseAdminClient();

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

  // =========================================
  // 1. 기본 조회
  // =========================================
  describe('기본 조회', () => {
    it('적립만 있고 출금이 없으면 전액이 소멸 대상이다', async () => {
      const user = await createTestUser(supabase);

      await createMonthlyEarnedPoint(supabase, {
        user_id: user.id,
        year_month: '2025-06-01',
        earned_points: 1000,
      });

      const targets = await repository.findExpirationTargets(
        '2025-06',
        WITHDRAW_RULES,
      );

      expect(targets).toHaveLength(1);
      expect(targets[0].userId).toBe(user.id);
      expect(targets[0].expiringPoints).toBe(1000);
    });

    it('monthly_earned_points에 데이터가 없으면 빈 배열을 반환한다', async () => {
      const targets = await repository.findExpirationTargets(
        '2025-06',
        WITHDRAW_RULES,
      );

      expect(targets).toHaveLength(0);
    });

    it('여러 월의 적립을 합산한다', async () => {
      const user = await createTestUser(supabase);

      await createMonthlyEarnedPoint(supabase, {
        user_id: user.id,
        year_month: '2025-04-01',
        earned_points: 300,
      });
      await createMonthlyEarnedPoint(supabase, {
        user_id: user.id,
        year_month: '2025-05-01',
        earned_points: 500,
      });
      await createMonthlyEarnedPoint(supabase, {
        user_id: user.id,
        year_month: '2025-06-01',
        earned_points: 200,
      });

      const targets = await repository.findExpirationTargets(
        '2025-06',
        WITHDRAW_RULES,
      );

      expect(targets).toHaveLength(1);
      expect(targets[0].expiringPoints).toBe(1000);
    });
  });

  // =========================================
  // 2. 출금 차감
  // =========================================
  describe('출금 차감', () => {
    it('부분 출금이 있으면 차감된 금액만 소멸 대상이다', async () => {
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
          point_amount: -300,
          status: 'done',
        },
      ]);

      const targets = await repository.findExpirationTargets(
        '2025-06',
        WITHDRAW_RULES,
      );

      expect(targets).toHaveLength(1);
      expect(targets[0].expiringPoints).toBe(700);
    });

    it('전액 출금하면 소멸 대상이 아니다', async () => {
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
          status: 'done',
        },
      ]);

      const targets = await repository.findExpirationTargets(
        '2025-06',
        WITHDRAW_RULES,
      );

      expect(targets).toHaveLength(0);
    });

    it('출금이 적립보다 많아도 음수가 되지 않는다', async () => {
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
          point_amount: -800,
          status: 'done',
        },
      ]);

      const targets = await repository.findExpirationTargets(
        '2025-06',
        WITHDRAW_RULES,
      );

      expect(targets).toHaveLength(0);
    });

    it('이전 소멸 처리(POINT_EXPIRATION)도 출금으로 차감된다', async () => {
      const user = await createTestUser(supabase);

      await createMonthlyEarnedPoint(supabase, {
        user_id: user.id,
        year_month: '2025-05-01',
        earned_points: 800,
      });
      await createMonthlyEarnedPoint(supabase, {
        user_id: user.id,
        year_month: '2025-06-01',
        earned_points: 200,
      });

      // 이전에 500 소멸 처리됨
      await createPointActions(supabase, [
        {
          user_id: user.id,
          type: 'POINT_EXPIRATION',
          point_amount: -500,
          status: 'done',
        },
      ]);

      const targets = await repository.findExpirationTargets(
        '2025-06',
        WITHDRAW_RULES,
      );

      expect(targets).toHaveLength(1);
      // 800 + 200 - 500 = 500
      expect(targets[0].expiringPoints).toBe(500);
    });
  });

  // =========================================
  // 3. 소멸대상월 경계
  // =========================================
  describe('소멸대상월 경계', () => {
    it('소멸대상월 이후의 적립은 포함하지 않는다', async () => {
      const user = await createTestUser(supabase);

      await createMonthlyEarnedPoint(supabase, {
        user_id: user.id,
        year_month: '2025-06-01',
        earned_points: 1000,
      });
      // 7월 적립 → 소멸대상월(6월) 이후이므로 제외
      await createMonthlyEarnedPoint(supabase, {
        user_id: user.id,
        year_month: '2025-07-01',
        earned_points: 5000,
      });

      const targets = await repository.findExpirationTargets(
        '2025-06',
        WITHDRAW_RULES,
      );

      expect(targets).toHaveLength(1);
      expect(targets[0].expiringPoints).toBe(1000);
    });

    it('소멸대상월 당월의 적립은 포함한다', async () => {
      const user = await createTestUser(supabase);

      await createMonthlyEarnedPoint(supabase, {
        user_id: user.id,
        year_month: '2025-06-01',
        earned_points: 700,
      });

      const targets = await repository.findExpirationTargets(
        '2025-06',
        WITHDRAW_RULES,
      );

      expect(targets).toHaveLength(1);
      expect(targets[0].expiringPoints).toBe(700);
    });

    it('소멸대상월보다 훨씬 이전의 적립도 포함한다', async () => {
      const user = await createTestUser(supabase);

      await createMonthlyEarnedPoint(supabase, {
        user_id: user.id,
        year_month: '2024-01-01',
        earned_points: 300,
      });
      await createMonthlyEarnedPoint(supabase, {
        user_id: user.id,
        year_month: '2025-06-01',
        earned_points: 200,
      });

      const targets = await repository.findExpirationTargets(
        '2025-06',
        WITHDRAW_RULES,
      );

      expect(targets).toHaveLength(1);
      expect(targets[0].expiringPoints).toBe(500);
    });
  });

  // =========================================
  // 4. 출금 타입/상태 필터
  // =========================================
  describe('출금 타입/상태 필터', () => {
    it('EXCHANGE_POINT_TO_CASH pending도 출금으로 차감한다', async () => {
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
          point_amount: -400,
          status: 'pending',
        },
      ]);

      const targets = await repository.findExpirationTargets(
        '2025-06',
        WITHDRAW_RULES,
      );

      expect(targets).toHaveLength(1);
      expect(targets[0].expiringPoints).toBe(600);
    });

    it('POINT_EXPIRATION pending은 출금으로 차감하지 않는다', async () => {
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
          point_amount: -1000,
          status: 'pending',
        },
      ]);

      const targets = await repository.findExpirationTargets(
        '2025-06',
        WITHDRAW_RULES,
      );

      // pending 소멸은 무시 → 전액 소멸 대상
      expect(targets).toHaveLength(1);
      expect(targets[0].expiringPoints).toBe(1000);
    });

    it('EXCHANGE_POINT_TO_CASH cancelled는 출금으로 차감하지 않는다', async () => {
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

      const targets = await repository.findExpirationTargets(
        '2025-06',
        WITHDRAW_RULES,
      );

      expect(targets).toHaveLength(1);
      expect(targets[0].expiringPoints).toBe(1000);
    });

    it('여러 출금 타입과 상태가 혼합된 경우 정확히 계산한다', async () => {
      const user = await createTestUser(supabase);

      await createMonthlyEarnedPoint(supabase, {
        user_id: user.id,
        year_month: '2025-06-01',
        earned_points: 2000,
      });

      await createPointActions(supabase, [
        // 차감됨: done 환전
        {
          user_id: user.id,
          type: 'EXCHANGE_POINT_TO_CASH',
          point_amount: -300,
          status: 'done',
        },
        // 차감됨: pending 환전
        {
          user_id: user.id,
          type: 'EXCHANGE_POINT_TO_CASH',
          point_amount: -200,
          status: 'pending',
        },
        // 차감 안됨: cancelled 환전
        {
          user_id: user.id,
          type: 'EXCHANGE_POINT_TO_CASH',
          point_amount: -500,
          status: 'cancelled',
        },
        // 차감됨: done 소멸
        {
          user_id: user.id,
          type: 'POINT_EXPIRATION',
          point_amount: -100,
          status: 'done',
        },
        // 차감 안됨: pending 소멸
        {
          user_id: user.id,
          type: 'POINT_EXPIRATION',
          point_amount: -400,
          status: 'pending',
        },
      ]);

      const targets = await repository.findExpirationTargets(
        '2025-06',
        WITHDRAW_RULES,
      );

      expect(targets).toHaveLength(1);
      // 2000 - (300 + 200 + 100) = 1400
      expect(targets[0].expiringPoints).toBe(1400);
    });
  });

  // =========================================
  // 5. 복합 시나리오
  // =========================================
  describe('복합 시나리오', () => {
    it('여러 유저 중 소멸 대상만 반환한다', async () => {
      const userA = await createTestUser(supabase);
      const userB = await createTestUser(supabase);
      const userC = await createTestUser(supabase);

      // A: 적립 1000, 출금 300 → 소멸 700
      await createMonthlyEarnedPoint(supabase, {
        user_id: userA.id,
        year_month: '2025-06-01',
        earned_points: 1000,
      });
      await createPointActions(supabase, [
        {
          user_id: userA.id,
          type: 'EXCHANGE_POINT_TO_CASH',
          point_amount: -300,
          status: 'done',
        },
      ]);

      // B: 적립 500, 출금 500 → 소멸 0 (대상 아님)
      await createMonthlyEarnedPoint(supabase, {
        user_id: userB.id,
        year_month: '2025-06-01',
        earned_points: 500,
      });
      await createPointActions(supabase, [
        {
          user_id: userB.id,
          type: 'EXCHANGE_POINT_TO_CASH',
          point_amount: -500,
          status: 'done',
        },
      ]);

      // C: 적립 200, 출금 없음 → 소멸 200
      await createMonthlyEarnedPoint(supabase, {
        user_id: userC.id,
        year_month: '2025-05-01',
        earned_points: 200,
      });

      const targets = await repository.findExpirationTargets(
        '2025-06',
        WITHDRAW_RULES,
      );

      expect(targets).toHaveLength(2);

      const targetA = targets.find((t) => t.userId === userA.id);
      const targetC = targets.find((t) => t.userId === userC.id);

      expect(targetA).toBeDefined();
      expect(targetA!.expiringPoints).toBe(700);

      expect(targetC).toBeDefined();
      expect(targetC!.expiringPoints).toBe(200);

      // B는 대상 아님
      const targetB = targets.find((t) => t.userId === userB.id);
      expect(targetB).toBeUndefined();
    });

    it('적립 타입이 아닌 포인트 액션은 적립에 포함되지 않는다', async () => {
      const user = await createTestUser(supabase);

      // monthly_earned_points에만 적립이 있어야 소멸 대상
      // (findExpirationTargets는 monthly_earned_points를 읽으므로
      //  point_actions의 적립 타입은 직접 참조하지 않음)
      await createMonthlyEarnedPoint(supabase, {
        user_id: user.id,
        year_month: '2025-06-01',
        earned_points: 500,
      });

      const targets = await repository.findExpirationTargets(
        '2025-06',
        WITHDRAW_RULES,
      );

      expect(targets).toHaveLength(1);
      expect(targets[0].expiringPoints).toBe(500);
    });
  });

  // =========================================
  // 6. WithdrawRule 동적 주입
  // =========================================
  describe('WithdrawRule 동적 주입', () => {
    it('빈 규칙을 넘기면 출금이 없는 것으로 처리한다', async () => {
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
          point_amount: -500,
          status: 'done',
        },
      ]);

      // 빈 규칙 → 출금 무시 → 전액 소멸
      const targets = await repository.findExpirationTargets('2025-06', []);

      expect(targets).toHaveLength(1);
      expect(targets[0].expiringPoints).toBe(1000);
    });

    it('EXCHANGE_POINT_TO_CASH 규칙만 넘기면 POINT_EXPIRATION은 무시한다', async () => {
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
          point_amount: -200,
          status: 'done',
        },
        {
          user_id: user.id,
          type: 'POINT_EXPIRATION',
          point_amount: -300,
          status: 'done',
        },
      ]);

      const targets = await repository.findExpirationTargets('2025-06', [
        { type: 'EXCHANGE_POINT_TO_CASH', statuses: ['done', 'pending'] },
      ]);

      // EXCHANGE만 차감 → 1000 - 200 = 800
      expect(targets).toHaveLength(1);
      expect(targets[0].expiringPoints).toBe(800);
    });

    it('POINT_EXPIRATION에 pending을 포함시키면 결과가 달라진다', async () => {
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
          point_amount: -800,
          status: 'pending',
        },
      ]);

      // 기본 WITHDRAW_RULES: POINT_EXPIRATION은 done만 → pending 무시 → 1000
      const targetsDefault = await repository.findExpirationTargets(
        '2025-06',
        WITHDRAW_RULES,
      );
      expect(targetsDefault).toHaveLength(1);
      expect(targetsDefault[0].expiringPoints).toBe(1000);

      // pending도 포함하는 규칙 → 1000 - 800 = 200
      const targetsWithPending = await repository.findExpirationTargets(
        '2025-06',
        [
          {
            type: 'EXCHANGE_POINT_TO_CASH',
            statuses: ['done', 'pending'],
          },
          {
            type: 'POINT_EXPIRATION',
            statuses: ['done', 'pending'],
          },
        ],
      );
      expect(targetsWithPending).toHaveLength(1);
      expect(targetsWithPending[0].expiringPoints).toBe(200);
    });
  });
});
