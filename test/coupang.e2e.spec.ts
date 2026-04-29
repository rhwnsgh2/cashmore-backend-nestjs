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

describe('Coupang API (e2e)', () => {
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

  describe('POST /coupang/visit', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .post('/coupang/visit')
        .send({})
        .expect(401);

      expect(response.body.message).toBe('No token provided');
    });

    it('처음 방문 시 포인트를 지급하고 success: true를 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const response = await request(app.getHttpServer())
        .post('/coupang/visit')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(200);

      expect(response.body).toEqual({ success: true });
    });

    it('10P가 point_actions에 저장된다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await request(app.getHttpServer())
        .post('/coupang/visit')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(200);

      const { data } = await supabase
        .from('point_actions')
        .select('*')
        .eq('user_id', testUser.id)
        .eq('type', 'COUPANG_VISIT')
        .single();

      expect(data).not.toBeNull();
      expect(data!.point_amount).toBe(10);
    });

    it('body 없이 요청해도 10P가 지급된다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await request(app.getHttpServer())
        .post('/coupang/visit')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const { data } = await supabase
        .from('point_actions')
        .select('*')
        .eq('user_id', testUser.id)
        .eq('type', 'COUPANG_VISIT')
        .single();

      expect(data).not.toBeNull();
      expect(data!.point_amount).toBe(10);
    });

    it('오늘 이미 받았으면 success: false를 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const now = dayjs().tz('Asia/Seoul');
      await createPointAction(supabase, {
        user_id: testUser.id,
        type: 'COUPANG_VISIT',
        point_amount: 10,
        created_at: now.toISOString(),
      });

      const response = await request(app.getHttpServer())
        .post('/coupang/visit')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(200);

      expect(response.body).toEqual({
        success: false,
        message: 'Already received',
      });
    });

    it('오늘 이미 받았으면 추가 포인트가 생성되지 않는다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const now = dayjs().tz('Asia/Seoul');
      await createPointAction(supabase, {
        user_id: testUser.id,
        type: 'COUPANG_VISIT',
        point_amount: 10,
        created_at: now.toISOString(),
      });

      await request(app.getHttpServer())
        .post('/coupang/visit')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(200);

      const { data } = await supabase
        .from('point_actions')
        .select('*')
        .eq('user_id', testUser.id)
        .eq('type', 'COUPANG_VISIT');

      expect(data).toHaveLength(1);
    });

    it('어제 받은 기록이 있어도 오늘은 새로 받을 수 있다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const yesterday = dayjs()
        .tz('Asia/Seoul')
        .subtract(1, 'day')
        .hour(15)
        .minute(0)
        .second(0);
      await createPointAction(supabase, {
        user_id: testUser.id,
        type: 'COUPANG_VISIT',
        point_amount: 10,
        created_at: yesterday.toISOString(),
      });

      const response = await request(app.getHttpServer())
        .post('/coupang/visit')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(200);

      expect(response.body).toEqual({ success: true });

      const { data } = await supabase
        .from('point_actions')
        .select('*')
        .eq('user_id', testUser.id)
        .eq('type', 'COUPANG_VISIT');

      expect(data).toHaveLength(2);
    });

    it('다른 유저의 방문 기록에 영향을 받지 않는다', async () => {
      const userA = await createTestUser(supabase);
      const userB = await createTestUser(supabase);
      const tokenB = generateTestToken(userB.auth_id);

      const now = dayjs().tz('Asia/Seoul');
      await createPointAction(supabase, {
        user_id: userA.id,
        type: 'COUPANG_VISIT',
        point_amount: 10,
        created_at: now.toISOString(),
      });

      const response = await request(app.getHttpServer())
        .post('/coupang/visit')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({})
        .expect(200);

      expect(response.body).toEqual({ success: true });
    });

    it('다른 타입의 오늘 포인트가 있어도 방문 포인트를 받을 수 있다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const now = dayjs().tz('Asia/Seoul');
      await createPointAction(supabase, {
        user_id: testUser.id,
        type: 'ATTENDANCE',
        point_amount: 10,
        created_at: now.toISOString(),
      });

      const response = await request(app.getHttpServer())
        .post('/coupang/visit')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(200);

      expect(response.body).toEqual({ success: true });
    });

    it('연속 두 번 요청하면 첫 번째만 성공한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const first = await request(app.getHttpServer())
        .post('/coupang/visit')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(200);

      const second = await request(app.getHttpServer())
        .post('/coupang/visit')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(200);

      expect(first.body).toEqual({ success: true });
      expect(second.body).toEqual({
        success: false,
        message: 'Already received',
      });

      const { data } = await supabase
        .from('point_actions')
        .select('*')
        .eq('user_id', testUser.id)
        .eq('type', 'COUPANG_VISIT');

      expect(data).toHaveLength(1);
    });

    it('저장된 포인트 액션에 COUPANG_VISIT 타입과 10P가 올바르게 설정된다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await request(app.getHttpServer())
        .post('/coupang/visit')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(200);

      const { data } = await supabase
        .from('point_actions')
        .select('*')
        .eq('user_id', testUser.id)
        .single();

      expect(data!.type).toBe('COUPANG_VISIT');
      expect(data!.point_amount).toBe(10);
      expect(data!.user_id).toBe(testUser.id);
    });
  });

  describe('GET /coupang/visit/today', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .get('/coupang/visit/today')
        .expect(401);

      expect(response.body.message).toBe('No token provided');
    });

    it('오늘 방문 기록이 없으면 hasVisitedToday: false를 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const response = await request(app.getHttpServer())
        .get('/coupang/visit/today')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({ hasVisitedToday: false });
    });

    it('오늘 방문 기록이 있으면 hasVisitedToday: true를 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const now = dayjs().tz('Asia/Seoul');
      await createPointAction(supabase, {
        user_id: testUser.id,
        type: 'COUPANG_VISIT',
        point_amount: 10,
        created_at: now.toISOString(),
      });

      const response = await request(app.getHttpServer())
        .get('/coupang/visit/today')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({ hasVisitedToday: true });
    });

    it('어제 방문 기록만 있으면 hasVisitedToday: false를 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const yesterday = dayjs()
        .tz('Asia/Seoul')
        .subtract(1, 'day')
        .hour(15)
        .minute(0)
        .second(0);
      await createPointAction(supabase, {
        user_id: testUser.id,
        type: 'COUPANG_VISIT',
        point_amount: 10,
        created_at: yesterday.toISOString(),
      });

      const response = await request(app.getHttpServer())
        .get('/coupang/visit/today')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({ hasVisitedToday: false });
    });

    it('다른 유저의 오늘 방문 기록은 영향을 주지 않는다', async () => {
      const userA = await createTestUser(supabase);
      const userB = await createTestUser(supabase);
      const tokenB = generateTestToken(userB.auth_id);

      const now = dayjs().tz('Asia/Seoul');
      await createPointAction(supabase, {
        user_id: userA.id,
        type: 'COUPANG_VISIT',
        point_amount: 10,
        created_at: now.toISOString(),
      });

      const response = await request(app.getHttpServer())
        .get('/coupang/visit/today')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);

      expect(response.body).toEqual({ hasVisitedToday: false });
    });

    it('다른 타입의 오늘 포인트만 있으면 hasVisitedToday: false를 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const now = dayjs().tz('Asia/Seoul');
      await createPointAction(supabase, {
        user_id: testUser.id,
        type: 'ATTENDANCE',
        point_amount: 10,
        created_at: now.toISOString(),
      });

      const response = await request(app.getHttpServer())
        .get('/coupang/visit/today')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({ hasVisitedToday: false });
    });
  });
});
