import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getTestSupabaseAdminClient } from './supabase-client';
import { truncateAllTables } from './setup';
import { createTestUser, TestUser } from './helpers/user.helper';
import { createReceiptSubmissions } from './helpers/streak.helper';
import { createPointActions } from './helpers/point.helper';
import { generateTestToken } from './helpers/auth.helper';

describe('Calendar API (e2e)', () => {
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

  describe('GET /calendar', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .get('/calendar?month=2026-01')
        .expect(401);

      expect(response.body.message).toBe('No token provided');
    });

    it('활동이 없으면 빈 days 배열을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const response = await request(app.getHttpServer())
        .get('/calendar?month=2026-01')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({
        year_month: '2026-01',
        total_points: 0,
        days: [],
      });
    });

    it('영수증 제출과 포인트 획득 정보를 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      // 영수증 제출
      await createReceiptSubmissions(supabase, [
        { user_id: testUser.id, created_at: '2026-01-15T10:00:00+09:00' },
        { user_id: testUser.id, created_at: '2026-01-15T14:00:00+09:00' },
        { user_id: testUser.id, created_at: '2026-01-17T10:00:00+09:00' },
      ]);

      // 포인트 획득
      await createPointActions(supabase, [
        {
          user_id: testUser.id,
          type: 'EVERY_RECEIPT',
          point_amount: 250,
          status: 'done',
          created_at: '2026-01-15T10:00:00+09:00',
        },
        {
          user_id: testUser.id,
          type: 'EVERY_RECEIPT',
          point_amount: 250,
          status: 'done',
          created_at: '2026-01-15T14:00:00+09:00',
        },
        {
          user_id: testUser.id,
          type: 'ATTENDANCE',
          point_amount: 50,
          status: 'done',
          created_at: '2026-01-17T09:00:00+09:00',
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/calendar?month=2026-01')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.year_month).toBe('2026-01');
      expect(response.body.total_points).toBe(550);
      expect(response.body.days).toHaveLength(2);

      const day15 = response.body.days.find(
        (d: { date: string }) => d.date === '2026-01-15',
      );
      expect(day15.receipt_count).toBe(2);
      expect(day15.points).toBe(500);

      const day17 = response.body.days.find(
        (d: { date: string }) => d.date === '2026-01-17',
      );
      expect(day17.receipt_count).toBe(1);
      expect(day17.points).toBe(50);
    });

    it('다른 월의 데이터는 포함하지 않는다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createReceiptSubmissions(supabase, [
        { user_id: testUser.id, created_at: '2026-01-15T10:00:00+09:00' },
        { user_id: testUser.id, created_at: '2026-02-15T10:00:00+09:00' },
      ]);

      const response = await request(app.getHttpServer())
        .get('/calendar?month=2026-01')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.days).toHaveLength(1);
      expect(response.body.days[0].date).toBe('2026-01-15');
    });

    it('출금/소멸 포인트는 포함하지 않는다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createPointActions(supabase, [
        {
          user_id: testUser.id,
          type: 'EVERY_RECEIPT',
          point_amount: 500,
          status: 'done',
          created_at: '2026-01-15T10:00:00+09:00',
        },
        {
          user_id: testUser.id,
          type: 'EXCHANGE_POINT_TO_CASH',
          point_amount: -200,
          status: 'done',
          created_at: '2026-01-15T14:00:00+09:00',
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/calendar?month=2026-01')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.total_points).toBe(500);
      expect(response.body.days[0].points).toBe(500);
    });
  });
});
