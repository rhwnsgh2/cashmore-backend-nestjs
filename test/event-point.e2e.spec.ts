import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getTestSupabaseAdminClient } from './supabase-client';
import { truncateAllTables } from './setup';
import { createTestUser } from './helpers/user.helper';
import { createPointAction } from './helpers/point.helper';
import { generateTestToken } from './helpers/auth.helper';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

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

    it('최근 24시간 내 coupang_visits 행을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const recentAt = new Date(Date.now() - 60 * 60 * 1000);
      await supabase.from('coupang_visits').insert({
        user_id: testUser.id,
        created_at_date: dayjs(recentAt).tz('Asia/Seoul').format('YYYY-MM-DD'),
        point_amount: 10,
        created_at: recentAt.toISOString(),
      });

      const response = await request(app.getHttpServer())
        .get('/event-points')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].type).toBe('COUPANG_VISIT');
      expect(response.body[0].point).toBe(10);
    });

    it('24시간보다 오래된 행은 포함하지 않는다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const now = Date.now();
      await supabase.from('coupang_visits').insert([
        {
          user_id: testUser.id,
          created_at_date: dayjs(now - 25 * 60 * 60 * 1000)
            .tz('Asia/Seoul')
            .format('YYYY-MM-DD'),
          point_amount: 10,
          created_at: new Date(now - 25 * 60 * 60 * 1000).toISOString(),
        },
        {
          user_id: testUser.id,
          created_at_date: dayjs(now - 60 * 60 * 1000)
            .tz('Asia/Seoul')
            .format('YYYY-MM-DD'),
          point_amount: 10,
          created_at: new Date(now - 60 * 60 * 1000).toISOString(),
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/event-points')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
    });

    it('point_actions의 COUPANG_VISIT은 더 이상 포함하지 않는다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createPointAction(supabase, {
        user_id: testUser.id,
        type: 'COUPANG_VISIT',
        point_amount: 10,
        created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      });

      const response = await request(app.getHttpServer())
        .get('/event-points')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('다른 사용자의 행은 포함하지 않는다', async () => {
      const testUser = await createTestUser(supabase);
      const otherUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const today = dayjs().tz('Asia/Seoul').format('YYYY-MM-DD');
      await supabase.from('coupang_visits').insert([
        {
          user_id: testUser.id,
          created_at_date: today,
          point_amount: 10,
        },
        {
          user_id: otherUser.id,
          created_at_date: today,
          point_amount: 10,
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/event-points')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].point).toBe(10);
    });

    it('응답에 모든 필드가 포함된다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const today = dayjs().tz('Asia/Seoul').format('YYYY-MM-DD');
      await supabase.from('coupang_visits').insert({
        user_id: testUser.id,
        created_at_date: today,
        point_amount: 10,
      });

      const response = await request(app.getHttpServer())
        .get('/event-points')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const eventPoint = response.body[0];
      expect(eventPoint).toHaveProperty('id');
      expect(eventPoint).toHaveProperty('type', 'COUPANG_VISIT');
      expect(eventPoint).toHaveProperty('createdAt');
      expect(eventPoint).toHaveProperty('point', 10);
    });
  });
});
