import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getTestSupabaseAdminClient } from './supabase-client';
import { truncateAllTables } from './setup';
import { createTestUser, TestUser } from './helpers/user.helper';
import { createReceiptSubmissions } from './helpers/streak.helper';
import { generateTestToken } from './helpers/auth.helper';
import { SupabaseStreakRepository } from '../src/streak/repositories/supabase-streak.repository';
import { SupabaseService } from '../src/supabase/supabase.service';

describe('SupabaseStreakRepository (integration)', () => {
  const supabase = getTestSupabaseAdminClient();
  let repository: SupabaseStreakRepository;
  let testUser: TestUser;

  beforeAll(() => {
    const supabaseService = {
      getClient: () => supabase,
    } as unknown as SupabaseService;

    repository = new SupabaseStreakRepository(supabaseService);
  });

  afterAll(async () => {
    await truncateAllTables();
  });

  beforeEach(async () => {
    await truncateAllTables();
    testUser = await createTestUser(supabase);
  });

  describe('findReceiptSubmissions', () => {
    it('영수증 제출 기록이 없으면 빈 배열을 반환한다', async () => {
      const submissions = await repository.findReceiptSubmissions(testUser.id);
      expect(submissions).toEqual([]);
    });

    it('해당 유저의 영수증 제출 기록만 반환한다', async () => {
      const otherUser = await createTestUser(supabase);

      await createReceiptSubmissions(supabase, [
        { user_id: testUser.id, created_at: '2026-01-15T12:00:00+09:00' },
        { user_id: testUser.id, created_at: '2026-01-16T12:00:00+09:00' },
        { user_id: otherUser.id, created_at: '2026-01-15T12:00:00+09:00' },
      ]);

      const submissions = await repository.findReceiptSubmissions(testUser.id);

      expect(submissions).toHaveLength(2);
      expect(submissions.every((s) => s.user_id === testUser.id)).toBe(true);
    });

    it('id, user_id, created_at 필드를 반환한다', async () => {
      await createReceiptSubmissions(supabase, [
        { user_id: testUser.id, created_at: '2026-01-15T12:00:00+09:00' },
      ]);

      const submissions = await repository.findReceiptSubmissions(testUser.id);

      expect(submissions).toHaveLength(1);
      expect(submissions[0]).toHaveProperty('id');
      expect(submissions[0]).toHaveProperty('user_id', testUser.id);
      expect(submissions[0]).toHaveProperty('created_at');
    });

    it('대량의 영수증 제출 기록(1500개)을 정상적으로 조회한다', async () => {
      // 2025-01-01부터 약 2년간, 하루에 1~2개씩 제출 (총 1500개)
      const startDate = new Date('2025-01-01T12:00:00+09:00');
      const submissions = Array.from({ length: 1500 }, (_, i) => {
        const date = new Date(startDate);
        const dayOffset = Math.floor(i / 2); // 하루에 2개씩
        const hour = i % 2 === 0 ? 10 : 18; // 오전/오후
        date.setDate(date.getDate() + dayOffset);
        date.setHours(hour);
        return {
          user_id: testUser.id,
          created_at: date.toISOString(),
        };
      });

      await createReceiptSubmissions(supabase, submissions);

      // DB에 실제로 들어간 개수 확인
      const { count } = await supabase
        .from('every_receipt')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', testUser.id)
        .eq('status', 'completed');

      expect(count).toBe(1500);

      const result = await repository.findReceiptSubmissions(testUser.id);

      expect(result).toHaveLength(1500);
      expect(result.every((s) => s.user_id === testUser.id)).toBe(true);
    });

    it('status가 completed인 것만 반환한다', async () => {
      await createReceiptSubmissions(supabase, [
        {
          user_id: testUser.id,
          created_at: '2026-01-15T12:00:00+09:00',
          status: 'completed',
        },
        {
          user_id: testUser.id,
          created_at: '2026-01-16T12:00:00+09:00',
          status: 'pending',
        },
        {
          user_id: testUser.id,
          created_at: '2026-01-17T12:00:00+09:00',
          status: 'rejected',
        },
        {
          user_id: testUser.id,
          created_at: '2026-01-18T12:00:00+09:00',
          status: 'completed',
        },
      ]);

      const submissions = await repository.findReceiptSubmissions(testUser.id);

      expect(submissions).toHaveLength(2);
    });
  });
});

describe('Streak API (e2e)', () => {
  let app: INestApplication;
  const supabase = getTestSupabaseAdminClient();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await truncateAllTables();
    await app.close();
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  describe('GET /streak/all', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .get('/streak/all')
        .expect(401);

      expect(response.body.message).toBe('No token provided');
    });

    it('영수증 제출 기록이 없으면 빈 배열을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const response = await request(app.getHttpServer())
        .get('/streak/all')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.streaks).toEqual([]);
    });

    it('연속 3일 제출하면 3일짜리 스트릭 1개를 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createReceiptSubmissions(supabase, [
        { user_id: testUser.id, created_at: '2026-01-17T12:00:00+09:00' },
        { user_id: testUser.id, created_at: '2026-01-16T12:00:00+09:00' },
        { user_id: testUser.id, created_at: '2026-01-15T12:00:00+09:00' },
      ]);

      const response = await request(app.getHttpServer())
        .get('/streak/all')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.streaks).toEqual([
        {
          start_date: '2026-01-15',
          end_date: '2026-01-17',
          continuous_count: 3,
        },
      ]);
    });

    it('중간에 끊긴 경우 스트릭 2개를 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createReceiptSubmissions(supabase, [
        { user_id: testUser.id, created_at: '2026-01-20T12:00:00+09:00' },
        { user_id: testUser.id, created_at: '2026-01-19T12:00:00+09:00' },
        // 1월 18일 빠짐
        { user_id: testUser.id, created_at: '2026-01-17T12:00:00+09:00' },
        { user_id: testUser.id, created_at: '2026-01-16T12:00:00+09:00' },
      ]);

      const response = await request(app.getHttpServer())
        .get('/streak/all')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.streaks).toHaveLength(2);
      expect(response.body.streaks[0].continuous_count).toBe(2);
      expect(response.body.streaks[1].continuous_count).toBe(2);
    });
  });
});
