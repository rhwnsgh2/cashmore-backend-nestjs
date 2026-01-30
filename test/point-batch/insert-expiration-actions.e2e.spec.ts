import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { getTestSupabaseAdminClient } from '../supabase-client';
import { truncateAllTables } from '../setup';
import { createTestUser } from '../helpers/user.helper';
import { PgPointBatchRepository } from '../../src/point-batch/repositories/pg-point-batch.repository';
import type { ExpirationTarget } from '../../src/point-batch/interfaces/point-batch-repository.interface';

dotenv.config({ path: '.env.test' });

describe('PgPointBatchRepository.insertExpirationActions', () => {
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

  // Helper: point_actions 조회
  async function getPointActions(userId: string) {
    const result = await pool.query(
      `SELECT user_id, type, point_amount, status, additional_data
       FROM point_actions WHERE user_id = $1 ORDER BY created_at`,
      [userId],
    );
    return result.rows;
  }

  // =========================================
  // 1. 기본 삽입
  // =========================================
  describe('기본 삽입', () => {
    it('빈 배열이면 0을 반환하고 아무것도 삽입하지 않는다', async () => {
      const result = await repository.insertExpirationActions(
        [],
        '2026-01-01',
        '2025-07',
      );
      expect(result).toBe(0);
    });

    it('단일 유저의 소멸 레코드를 삽입한다', async () => {
      const user = await createTestUser(supabase);
      const targets: ExpirationTarget[] = [
        { userId: user.id, expiringPoints: 500 },
      ];

      const count = await repository.insertExpirationActions(
        targets,
        '2026-01-01',
        '2025-07',
      );

      expect(count).toBe(1);

      const actions = await getPointActions(user.id);
      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe('POINT_EXPIRATION');
      expect(Number(actions[0].point_amount)).toBe(-500);
      expect(actions[0].status).toBe('done');
      expect(actions[0].additional_data).toEqual({
        base_date: '2026-01-01',
        expiration_month: '2025-07',
      });
    });

    it('여러 유저의 소멸 레코드를 한번에 삽입한다', async () => {
      const user1 = await createTestUser(supabase);
      const user2 = await createTestUser(supabase);
      const user3 = await createTestUser(supabase);

      const targets: ExpirationTarget[] = [
        { userId: user1.id, expiringPoints: 100 },
        { userId: user2.id, expiringPoints: 200 },
        { userId: user3.id, expiringPoints: 300 },
      ];

      const count = await repository.insertExpirationActions(
        targets,
        '2026-01-01',
        '2025-07',
      );

      expect(count).toBe(3);

      const actions1 = await getPointActions(user1.id);
      const actions2 = await getPointActions(user2.id);
      const actions3 = await getPointActions(user3.id);

      expect(Number(actions1[0].point_amount)).toBe(-100);
      expect(Number(actions2[0].point_amount)).toBe(-200);
      expect(Number(actions3[0].point_amount)).toBe(-300);
    });
  });

  // =========================================
  // 2. point_amount 음수 저장 검증
  // =========================================
  describe('point_amount 음수 저장', () => {
    it('expiringPoints가 양수여도 point_amount는 음수로 저장된다', async () => {
      const user = await createTestUser(supabase);

      await repository.insertExpirationActions(
        [{ userId: user.id, expiringPoints: 9999 }],
        '2026-01-01',
        '2025-07',
      );

      const actions = await getPointActions(user.id);
      expect(Number(actions[0].point_amount)).toBe(-9999);
    });
  });

  // =========================================
  // 3. additional_data 검증
  // =========================================
  describe('additional_data', () => {
    it('base_date와 expiration_month가 jsonb로 저장된다', async () => {
      const user = await createTestUser(supabase);

      await repository.insertExpirationActions(
        [{ userId: user.id, expiringPoints: 100 }],
        '2026-02-15',
        '2025-08',
      );

      const actions = await getPointActions(user.id);
      expect(actions[0].additional_data).toEqual({
        base_date: '2026-02-15',
        expiration_month: '2025-08',
      });
    });
  });

  // =========================================
  // 4. 청크 처리 (CHUNK_SIZE = 1000)
  // =========================================
  describe('청크 처리', () => {
    it('1000건 초과 시 여러 청크로 나누어 삽입한다', async () => {
      const USER_COUNT = 1050;
      const userIds: string[] = [];

      // pg로 직접 bulk insert (auth.users → user)
      const client = await pool.connect();
      try {
        for (let i = 0; i < USER_COUNT; i++) {
          const authId = crypto.randomUUID();
          const userId = crypto.randomUUID();
          const email = `chunk-${i}-${Date.now()}@test.com`;

          await client.query(
            `INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, aud, role)
             VALUES ($1, '00000000-0000-0000-0000-000000000000', $2, '$2a$10$abcdefghijklmnopqrstuv', NOW(), 'authenticated', 'authenticated')`,
            [authId, email],
          );

          await client.query(
            `INSERT INTO "user" (id, auth_id, email, nickname, marketing_info, provider)
             VALUES ($1, $2, $3, $4, false, 'other')`,
            [userId, authId, email, `chunk-user-${i}`],
          );

          userIds.push(userId);
        }
      } finally {
        client.release();
      }

      const targets: ExpirationTarget[] = userIds.map((id, i) => ({
        userId: id,
        expiringPoints: (i + 1) * 10,
      }));

      const count = await repository.insertExpirationActions(
        targets,
        '2026-01-01',
        '2025-07',
      );

      expect(count).toBe(USER_COUNT);

      // 전체 삽입 건수 확인
      const result = await pool.query(
        `SELECT COUNT(*) FROM point_actions WHERE type = 'POINT_EXPIRATION'`,
      );
      expect(Number(result.rows[0].count)).toBe(USER_COUNT);
    }, 30000);
  });
});
