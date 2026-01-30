import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { getTestSupabaseAdminClient } from '../supabase-client';
import { truncateAllTables } from '../setup';
import { createTestUser } from '../helpers/user.helper';
import { createPointActions } from '../helpers/point.helper';
import { PgPointBatchRepository } from '../../src/point-batch/repositories/pg-point-batch.repository';
import { POINT_ADD_TYPES } from '../../src/point/interfaces/point-repository.interface';

dotenv.config({ path: '.env.test' });

describe('PgPointBatchRepository.calculateMonthlyEarnedPoints + upsertMonthlyEarnedPoints', () => {
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

  /** calculateMonthlyEarnedPoints → upsertMonthlyEarnedPoints 순차 실행 헬퍼 */
  async function aggregateAndUpsert(yearMonth: string): Promise<number> {
    const targets = await repository.calculateMonthlyEarnedPoints(
      yearMonth,
      POINT_ADD_TYPES,
    );
    if (targets.length === 0) return 0;
    return repository.upsertMonthlyEarnedPoints(yearMonth, targets);
  }

  // =========================================
  // 1. 기본 집계
  // =========================================
  describe('기본 집계', () => {
    it('여러 유저의 적립 포인트를 각각 정확히 집계한다', async () => {
      const user1 = await createTestUser(supabase);
      const user2 = await createTestUser(supabase);

      await createPointActions(supabase, [
        {
          user_id: user1.id,
          type: 'EVERY_RECEIPT',
          point_amount: 500,
          created_at: '2025-12-10T12:00:00+09:00',
        },
        {
          user_id: user1.id,
          type: 'ATTENDANCE',
          point_amount: 300,
          created_at: '2025-12-15T12:00:00+09:00',
        },
        {
          user_id: user2.id,
          type: 'EVERY_RECEIPT',
          point_amount: 1000,
          created_at: '2025-12-20T12:00:00+09:00',
        },
      ]);

      const count = await aggregateAndUpsert('2025-12');

      expect(count).toBe(2);

      const { data } = await supabase
        .from('monthly_earned_points')
        .select('user_id, earned_points');

      const u1 = data!.find((d) => d.user_id === user1.id);
      const u2 = data!.find((d) => d.user_id === user2.id);
      expect(u1!.earned_points).toBe(800);
      expect(u2!.earned_points).toBe(1000);
    });

    it('대상 월에 적립이 없으면 0명 반환', async () => {
      const user = await createTestUser(supabase);

      await createPointActions(supabase, [
        {
          user_id: user.id,
          type: 'EVERY_RECEIPT',
          point_amount: 500,
          created_at: '2025-11-10T12:00:00+09:00',
        },
      ]);

      const count = await aggregateAndUpsert('2025-12');

      expect(count).toBe(0);
    });
  });

  // =========================================
  // 2. 날짜 경계 (KST 기준)
  // =========================================
  describe('날짜 경계 (KST 기준)', () => {
    it('KST 월초 자정에 생성된 포인트는 해당 월에 포함된다', async () => {
      const user = await createTestUser(supabase);

      await createPointActions(supabase, [
        {
          user_id: user.id,
          type: 'EVERY_RECEIPT',
          point_amount: 100,
          // KST 2025-12-01 00:00:00 = UTC 2025-11-30 15:00:00
          created_at: '2025-12-01T00:00:00+09:00',
        },
      ]);

      const count = await aggregateAndUpsert('2025-12');

      expect(count).toBe(1);

      const { data } = await supabase
        .from('monthly_earned_points')
        .select('earned_points')
        .eq('user_id', user.id)
        .single();

      expect(data!.earned_points).toBe(100);
    });

    it('KST 월말 마지막 시각에 생성된 포인트는 해당 월에 포함된다', async () => {
      const user = await createTestUser(supabase);

      await createPointActions(supabase, [
        {
          user_id: user.id,
          type: 'EVERY_RECEIPT',
          point_amount: 200,
          // KST 2025-12-31 23:59:59 = UTC 2025-12-31 14:59:59
          created_at: '2025-12-31T23:59:59+09:00',
        },
      ]);

      const count = await aggregateAndUpsert('2025-12');

      expect(count).toBe(1);

      const { data } = await supabase
        .from('monthly_earned_points')
        .select('earned_points')
        .eq('user_id', user.id)
        .single();

      expect(data!.earned_points).toBe(200);
    });

    it('KST 이전 달 마지막 시각은 해당 월에서 제외된다', async () => {
      const user = await createTestUser(supabase);

      await createPointActions(supabase, [
        {
          user_id: user.id,
          type: 'EVERY_RECEIPT',
          point_amount: 100,
          // KST 2025-11-30 23:59:59 = UTC 2025-11-30 14:59:59
          created_at: '2025-11-30T23:59:59+09:00',
        },
      ]);

      const count = await aggregateAndUpsert('2025-12');

      expect(count).toBe(0);
    });

    it('KST 다음 달 자정은 해당 월에서 제외된다', async () => {
      const user = await createTestUser(supabase);

      await createPointActions(supabase, [
        {
          user_id: user.id,
          type: 'EVERY_RECEIPT',
          point_amount: 100,
          // KST 2026-01-01 00:00:00 = UTC 2025-12-31 15:00:00
          created_at: '2026-01-01T00:00:00+09:00',
        },
      ]);

      const count = await aggregateAndUpsert('2025-12');

      expect(count).toBe(0);
    });

    it('UTC 자정 근처에서 KST 기준으로 정확히 분리된다', async () => {
      const user = await createTestUser(supabase);

      await createPointActions(supabase, [
        {
          user_id: user.id,
          type: 'EVERY_RECEIPT',
          point_amount: 100,
          // KST 2026-01-01 08:59:59 = UTC 2025-12-31 23:59:59
          // → KST 기준 1월이므로 12월 집계에서 제외
          created_at: '2026-01-01T08:59:59+09:00',
        },
        {
          user_id: user.id,
          type: 'EVERY_RECEIPT',
          point_amount: 200,
          // KST 2025-12-31 23:59:59 = UTC 2025-12-31 14:59:59
          // → KST 기준 12월이므로 포함
          created_at: '2025-12-31T23:59:59+09:00',
        },
      ]);

      const count = await aggregateAndUpsert('2025-12');

      expect(count).toBe(1);

      const { data } = await supabase
        .from('monthly_earned_points')
        .select('earned_points')
        .eq('user_id', user.id)
        .single();

      // KST 12월인 200만 포함, KST 1월인 100은 제외
      expect(data!.earned_points).toBe(200);
    });
  });

  // =========================================
  // 3. 타입 필터링
  // =========================================
  describe('타입 필터링', () => {
    it('모든 POINT_ADD_TYPES를 합산한다', async () => {
      const user = await createTestUser(supabase);

      // POINT_ADD_TYPES 중 대표적인 타입들로 테스트
      await createPointActions(supabase, [
        {
          user_id: user.id,
          type: 'EVERY_RECEIPT',
          point_amount: 100,
          created_at: '2025-12-10T12:00:00+09:00',
        },
        {
          user_id: user.id,
          type: 'ATTENDANCE',
          point_amount: 200,
          created_at: '2025-12-11T12:00:00+09:00',
        },
        {
          user_id: user.id,
          type: 'LOTTERY',
          point_amount: 300,
          created_at: '2025-12-12T12:00:00+09:00',
        },
      ]);

      await aggregateAndUpsert('2025-12');

      const { data } = await supabase
        .from('monthly_earned_points')
        .select('earned_points')
        .eq('user_id', user.id)
        .single();

      expect(data!.earned_points).toBe(600);
    });

    it('EXCHANGE_POINT_TO_CASH는 집계에서 제외한다', async () => {
      const user = await createTestUser(supabase);

      await createPointActions(supabase, [
        {
          user_id: user.id,
          type: 'EVERY_RECEIPT',
          point_amount: 1000,
          created_at: '2025-12-10T12:00:00+09:00',
        },
        {
          user_id: user.id,
          type: 'EXCHANGE_POINT_TO_CASH',
          point_amount: -500,
          created_at: '2025-12-15T12:00:00+09:00',
        },
      ]);

      await aggregateAndUpsert('2025-12');

      const { data } = await supabase
        .from('monthly_earned_points')
        .select('earned_points')
        .eq('user_id', user.id)
        .single();

      expect(data!.earned_points).toBe(1000);
    });

    it('POINT_EXPIRATION은 집계에서 제외한다', async () => {
      const user = await createTestUser(supabase);

      await createPointActions(supabase, [
        {
          user_id: user.id,
          type: 'EVERY_RECEIPT',
          point_amount: 1000,
          created_at: '2025-12-10T12:00:00+09:00',
        },
        {
          user_id: user.id,
          type: 'POINT_EXPIRATION' as any,
          point_amount: -300,
          created_at: '2025-12-15T12:00:00+09:00',
        },
      ]);

      await aggregateAndUpsert('2025-12');

      const { data } = await supabase
        .from('monthly_earned_points')
        .select('earned_points')
        .eq('user_id', user.id)
        .single();

      expect(data!.earned_points).toBe(1000);
    });
  });

  // =========================================
  // 4. Status 필터링
  // =========================================
  describe('Status 필터링', () => {
    it('status=done만 집계에 포함한다', async () => {
      const user = await createTestUser(supabase);

      await createPointActions(supabase, [
        {
          user_id: user.id,
          type: 'EVERY_RECEIPT',
          point_amount: 500,
          status: 'done',
          created_at: '2025-12-10T12:00:00+09:00',
        },
        {
          user_id: user.id,
          type: 'EVERY_RECEIPT',
          point_amount: 300,
          status: 'pending',
          created_at: '2025-12-11T12:00:00+09:00',
        },
        {
          user_id: user.id,
          type: 'EVERY_RECEIPT',
          point_amount: 200,
          status: 'cancelled',
          created_at: '2025-12-12T12:00:00+09:00',
        },
      ]);

      await aggregateAndUpsert('2025-12');

      const { data } = await supabase
        .from('monthly_earned_points')
        .select('earned_points')
        .eq('user_id', user.id)
        .single();

      expect(data!.earned_points).toBe(500);
    });

    it('모두 pending이면 집계 대상이 없다', async () => {
      const user = await createTestUser(supabase);

      await createPointActions(supabase, [
        {
          user_id: user.id,
          type: 'EVERY_RECEIPT',
          point_amount: 500,
          status: 'pending',
          created_at: '2025-12-10T12:00:00+09:00',
        },
      ]);

      const count = await aggregateAndUpsert('2025-12');

      expect(count).toBe(0);
    });
  });

  // =========================================
  // 5. Upsert 동작
  // =========================================
  describe('Upsert 동작', () => {
    it('기존 데이터가 있으면 갱신한다', async () => {
      const user = await createTestUser(supabase);

      await supabase.from('monthly_earned_points').insert({
        user_id: user.id,
        year_month: '2025-12-01',
        earned_points: 999,
      });

      await createPointActions(supabase, [
        {
          user_id: user.id,
          type: 'EVERY_RECEIPT',
          point_amount: 700,
          created_at: '2025-12-10T12:00:00+09:00',
        },
      ]);

      await aggregateAndUpsert('2025-12');

      const { data } = await supabase
        .from('monthly_earned_points')
        .select('earned_points')
        .eq('user_id', user.id)
        .single();

      expect(data!.earned_points).toBe(700);
    });

    it('두 번 실행해도 중복 레코드가 생기지 않는다', async () => {
      const user = await createTestUser(supabase);

      await createPointActions(supabase, [
        {
          user_id: user.id,
          type: 'EVERY_RECEIPT',
          point_amount: 500,
          created_at: '2025-12-10T12:00:00+09:00',
        },
      ]);

      await aggregateAndUpsert('2025-12');
      await aggregateAndUpsert('2025-12');

      const { data } = await supabase
        .from('monthly_earned_points')
        .select('earned_points')
        .eq('user_id', user.id);

      expect(data).toHaveLength(1);
      expect(data![0].earned_points).toBe(500);
    });
  });

  // =========================================
  // 6. 대량 유저 처리
  // =========================================
  describe('대량 유저 처리', () => {
    it('100명의 유저 포인트를 한번에 정확히 집계한다', async () => {
      const USER_COUNT = 100;
      const userIds: string[] = [];

      // pg로 직접 bulk insert (auth.users → user → point_actions)
      const client = await pool.connect();
      try {
        for (let i = 0; i < USER_COUNT; i++) {
          const authId = crypto.randomUUID();
          const userId = crypto.randomUUID();
          const email = `bulk-${i}-${Date.now()}@test.com`;

          await client.query(
            `INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, aud, role)
               VALUES ($1, '00000000-0000-0000-0000-000000000000', $2, '$2a$10$abcdefghijklmnopqrstuv', NOW(), 'authenticated', 'authenticated')`,
            [authId, email],
          );

          await client.query(
            `INSERT INTO "user" (id, auth_id, email, nickname, marketing_info, provider)
               VALUES ($1, $2, $3, $4, false, 'other')`,
            [userId, authId, email, `bulk-user-${i}`],
          );

          userIds.push(userId);
        }

        // 각 유저에게 2건씩 포인트 액션 생성
        const values: string[] = [];
        const params: (string | number)[] = [];
        let idx = 1;

        for (let i = 0; i < USER_COUNT; i++) {
          // EVERY_RECEIPT
          values.push(
            `($${idx}, 'EVERY_RECEIPT', $${idx + 1}, 'done', '2025-12-10T12:00:00+09:00', '{}')`,
          );
          params.push(userIds[i], 100 + i);
          idx += 2;

          // ATTENDANCE
          values.push(
            `($${idx}, 'ATTENDANCE', $${idx + 1}, 'done', '2025-12-15T12:00:00+09:00', '{}')`,
          );
          params.push(userIds[i], 50);
          idx += 2;
        }

        await client.query(
          `INSERT INTO point_actions (user_id, type, point_amount, status, created_at, additional_data)
             VALUES ${values.join(', ')}`,
          params,
        );
      } finally {
        client.release();
      }

      const count = await aggregateAndUpsert('2025-12');

      expect(count).toBe(USER_COUNT);

      // 모든 유저가 정확히 집계됐는지 확인
      const { data } = await supabase
        .from('monthly_earned_points')
        .select('user_id, earned_points');

      expect(data).toHaveLength(USER_COUNT);

      for (let i = 0; i < USER_COUNT; i++) {
        const record = data!.find((d) => d.user_id === userIds[i]);
        expect(record).toBeDefined();
        expect(record!.earned_points).toBe(150 + i);
      }
    }, 30000);
  });
});
