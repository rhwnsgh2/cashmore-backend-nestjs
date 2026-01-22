import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getTestSupabaseAdminClient } from './supabase-client';
import { truncateAllTables } from './setup';
import { createTestUser } from './helpers/user.helper';
import { createPointAction, createPointActions } from './helpers/point.helper';
import { generateTestToken } from './helpers/auth.helper';

describe('EventPoint API (e2e)', () => {
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

  describe('GET /event-points', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .get('/event-points')
        .expect(401);

      expect(response.body.message).toBe('No token provided');
    });

    it('이벤트 포인트가 없으면 빈 배열을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const response = await request(app.getHttpServer())
        .get('/event-points')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('이벤트 포인트 목록을 최신순으로 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createPointActions(supabase, [
        {
          user_id: testUser.id,
          type: 'COUPANG_VISIT',
          point_amount: 100,
          created_at: '2026-01-10T10:00:00+09:00',
        },
        {
          user_id: testUser.id,
          type: 'LOTTERY',
          point_amount: 500,
          created_at: '2026-01-15T10:00:00+09:00',
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/event-points')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].point).toBe(500);
      expect(response.body[1].point).toBe(100);
    });

    it('모든 이벤트 타입을 포함한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createPointActions(supabase, [
        {
          user_id: testUser.id,
          type: 'COUPANG_VISIT',
          point_amount: 100,
          created_at: '2026-01-15T10:00:00+09:00',
        },
        {
          user_id: testUser.id,
          type: 'ONBOARDING_EVENT',
          point_amount: 200,
          created_at: '2026-01-15T11:00:00+09:00',
        },
        {
          user_id: testUser.id,
          type: 'AFFILIATE',
          point_amount: 150,
          created_at: '2026-01-15T12:00:00+09:00',
        },
        {
          user_id: testUser.id,
          type: 'LOTTERY',
          point_amount: 500,
          created_at: '2026-01-15T13:00:00+09:00',
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/event-points')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveLength(4);

      const types = response.body.map((p: { type: string }) => p.type);
      expect(types).toContain('COUPANG_VISIT');
      expect(types).toContain('ONBOARDING_EVENT');
      expect(types).toContain('AFFILIATE');
      expect(types).toContain('LOTTERY');
    });

    it('다른 타입의 포인트 액션은 포함하지 않는다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createPointActions(supabase, [
        {
          user_id: testUser.id,
          type: 'COUPANG_VISIT',
          point_amount: 100,
          created_at: '2026-01-15T10:00:00+09:00',
        },
        {
          user_id: testUser.id,
          type: 'EVERY_RECEIPT',
          point_amount: 250,
          created_at: '2026-01-15T11:00:00+09:00',
        },
        {
          user_id: testUser.id,
          type: 'ATTENDANCE',
          point_amount: 50,
          created_at: '2026-01-15T12:00:00+09:00',
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/event-points')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].type).toBe('COUPANG_VISIT');
    });

    it('다른 사용자의 이벤트 포인트는 포함하지 않는다', async () => {
      const testUser = await createTestUser(supabase);
      const otherUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createPointActions(supabase, [
        {
          user_id: testUser.id,
          type: 'COUPANG_VISIT',
          point_amount: 100,
          created_at: '2026-01-15T10:00:00+09:00',
        },
        {
          user_id: otherUser.id,
          type: 'LOTTERY',
          point_amount: 500,
          created_at: '2026-01-15T10:00:00+09:00',
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/event-points')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].point).toBe(100);
    });

    it('응답에 모든 필드가 포함된다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createPointAction(supabase, {
        user_id: testUser.id,
        type: 'COUPANG_VISIT',
        point_amount: 100,
        created_at: '2026-01-15T10:30:00+09:00',
      });

      const response = await request(app.getHttpServer())
        .get('/event-points')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const eventPoint = response.body[0];
      expect(eventPoint).toHaveProperty('id');
      expect(eventPoint).toHaveProperty('type', 'COUPANG_VISIT');
      expect(eventPoint).toHaveProperty('createdAt');
      expect(eventPoint).toHaveProperty('point', 100);
    });
  });
});
