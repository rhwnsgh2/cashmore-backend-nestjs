import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import dayjs from 'dayjs';
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

  describe('findStreaks', () => {
    it('영수증 제출 기록이 없으면 빈 배열을 반환한다', async () => {
      const streaks = await repository.findStreaks(testUser.id);
      expect(streaks).toEqual([]);
    });

    it('다른 유저의 영수증은 포함하지 않는다', async () => {
      const otherUser = await createTestUser(supabase);

      await createReceiptSubmissions(supabase, [
        { user_id: testUser.id, created_at: '2026-01-15T12:00:00+09:00' },
        { user_id: testUser.id, created_at: '2026-01-16T12:00:00+09:00' },
        { user_id: otherUser.id, created_at: '2026-01-15T12:00:00+09:00' },
      ]);

      const streaks = await repository.findStreaks(testUser.id);

      expect(streaks).toHaveLength(1);
      expect(streaks[0]).toEqual({
        start_date: '2026-01-15',
        end_date: '2026-01-16',
        continuous_count: 2,
      });
    });

    it('status가 completed인 것만 스트릭에 포함한다', async () => {
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

      const streaks = await repository.findStreaks(testUser.id);

      // 1/15, 1/18만 completed → 연속이 아니므로 스트릭 2개
      expect(streaks).toHaveLength(2);
      expect(streaks.every((s) => s.continuous_count === 1)).toBe(true);
    });

    it('연속 3일 제출하면 3일짜리 스트릭을 반환한다', async () => {
      await createReceiptSubmissions(supabase, [
        { user_id: testUser.id, created_at: '2026-01-15T12:00:00+09:00' },
        { user_id: testUser.id, created_at: '2026-01-16T12:00:00+09:00' },
        { user_id: testUser.id, created_at: '2026-01-17T12:00:00+09:00' },
      ]);

      const streaks = await repository.findStreaks(testUser.id);

      expect(streaks).toHaveLength(1);
      expect(streaks[0]).toEqual({
        start_date: '2026-01-15',
        end_date: '2026-01-17',
        continuous_count: 3,
      });
    });

    it('하루에 여러 번 제출해도 1일로 계산한다', async () => {
      await createReceiptSubmissions(supabase, [
        { user_id: testUser.id, created_at: '2026-01-15T09:00:00+09:00' },
        { user_id: testUser.id, created_at: '2026-01-15T12:00:00+09:00' },
        { user_id: testUser.id, created_at: '2026-01-15T18:00:00+09:00' },
      ]);

      const streaks = await repository.findStreaks(testUser.id);

      expect(streaks).toHaveLength(1);
      expect(streaks[0].continuous_count).toBe(1);
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

    it('90일 경계를 넘는 연속 스트릭이 있으면 범위를 확장하여 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      // 오늘부터 120일 전까지 매일 영수증 제출
      const submissions = Array.from({ length: 120 }, (_, i) => ({
        user_id: testUser.id,
        created_at: dayjs()
          .subtract(i, 'day')
          .hour(12)
          .format('YYYY-MM-DDTHH:mm:ssZ'),
      }));

      await createReceiptSubmissions(supabase, submissions);

      const response = await request(app.getHttpServer())
        .get('/streak/all')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.streaks).toHaveLength(1);
      expect(response.body.streaks[0].continuous_count).toBe(120);
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
