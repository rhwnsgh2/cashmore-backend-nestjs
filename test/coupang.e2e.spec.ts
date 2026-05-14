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

      const today = dayjs().tz('Asia/Seoul').format('YYYY-MM-DD');
      await supabase.from('coupang_visits').insert({
        user_id: testUser.id,
        created_at_date: today,
        point_amount: 10,
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

    it('오늘 이미 받았으면 coupang_visits에 추가 행이 생기지 않는다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const today = dayjs().tz('Asia/Seoul').format('YYYY-MM-DD');
      await supabase.from('coupang_visits').insert({
        user_id: testUser.id,
        created_at_date: today,
        point_amount: 10,
      });

      await request(app.getHttpServer())
        .post('/coupang/visit')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(200);

      const { data } = await supabase
        .from('coupang_visits')
        .select('*')
        .eq('user_id', testUser.id);

      expect(data).toHaveLength(1);
    });

    it('어제 받은 기록이 있어도 오늘은 새로 받을 수 있다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const yesterday = dayjs()
        .tz('Asia/Seoul')
        .subtract(1, 'day')
        .format('YYYY-MM-DD');
      await supabase.from('coupang_visits').insert({
        user_id: testUser.id,
        created_at_date: yesterday,
        point_amount: 10,
      });

      const response = await request(app.getHttpServer())
        .post('/coupang/visit')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(200);

      expect(response.body).toEqual({ success: true });

      const { data } = await supabase
        .from('coupang_visits')
        .select('*')
        .eq('user_id', testUser.id);

      expect(data).toHaveLength(2);
    });

    it('다른 유저의 방문 기록에 영향을 받지 않는다', async () => {
      const userA = await createTestUser(supabase);
      const userB = await createTestUser(supabase);
      const tokenB = generateTestToken(userB.auth_id);

      const today = dayjs().tz('Asia/Seoul').format('YYYY-MM-DD');
      await supabase.from('coupang_visits').insert({
        user_id: userA.id,
        created_at_date: today,
        point_amount: 10,
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

    it('성공 시 coupang_visits 테이블에도 행이 생성된다 (dual-write)', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await request(app.getHttpServer())
        .post('/coupang/visit')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(200);

      const { data } = await supabase
        .from('coupang_visits')
        .select('*')
        .eq('user_id', testUser.id);

      expect(data).toHaveLength(1);
      expect(data![0].point_amount).toBe(10);
      expect(data![0].created_at_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('point_actions의 additional_data에 coupang_visit_id가 들어간다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await request(app.getHttpServer())
        .post('/coupang/visit')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(200);

      const { data: visits } = await supabase
        .from('coupang_visits')
        .select('id')
        .eq('user_id', testUser.id)
        .single();

      const { data: action } = await supabase
        .from('point_actions')
        .select('additional_data')
        .eq('user_id', testUser.id)
        .eq('type', 'COUPANG_VISIT')
        .single();

      expect(action!.additional_data).toEqual({ coupang_visit_id: visits!.id });
    });

    it('순차 호출 시 첫 번째만 성공한다 (서비스 레벨 중복 체크)', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const responses: { body: { success: boolean; message?: string } }[] = [];
      for (let i = 0; i < 5; i++) {
        const r = await request(app.getHttpServer())
          .post('/coupang/visit')
          .set('Authorization', `Bearer ${token}`)
          .send({});
        responses.push(r);
      }

      const successCount = responses.filter(
        (r) => r.body.success === true,
      ).length;
      const alreadyCount = responses.filter(
        (r) => r.body.success === false,
      ).length;

      expect(successCount).toBe(1);
      expect(alreadyCount).toBe(4);

      const { data: visits } = await supabase
        .from('coupang_visits')
        .select('*')
        .eq('user_id', testUser.id);
      expect(visits).toHaveLength(1);

      const { data: actions } = await supabase
        .from('point_actions')
        .select('*')
        .eq('user_id', testUser.id)
        .eq('type', 'COUPANG_VISIT');
      expect(actions).toHaveLength(1);
    });

    it('coupang_visits.created_at_date가 KST 오늘 날짜와 일치한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await request(app.getHttpServer())
        .post('/coupang/visit')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(200);

      const { data } = await supabase
        .from('coupang_visits')
        .select('created_at_date')
        .eq('user_id', testUser.id)
        .single();

      const todayKst = dayjs().tz('Asia/Seoul').format('YYYY-MM-DD');
      expect(data!.created_at_date).toBe(todayKst);
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

      const today = dayjs().tz('Asia/Seoul').format('YYYY-MM-DD');
      await supabase.from('coupang_visits').insert({
        user_id: testUser.id,
        created_at_date: today,
        point_amount: 10,
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
        .format('YYYY-MM-DD');
      await supabase.from('coupang_visits').insert({
        user_id: testUser.id,
        created_at_date: yesterday,
        point_amount: 10,
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

      const today = dayjs().tz('Asia/Seoul').format('YYYY-MM-DD');
      await supabase.from('coupang_visits').insert({
        user_id: userA.id,
        created_at_date: today,
        point_amount: 10,
      });

      const response = await request(app.getHttpServer())
        .get('/coupang/visit/today')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);

      expect(response.body).toEqual({ hasVisitedToday: false });
    });

    it('point_actions만 있고 coupang_visits에 없으면 hasVisitedToday: false', async () => {
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

      expect(response.body).toEqual({ hasVisitedToday: false });
    });
  });

  describe('POST /coupang/v2/visit (10시간 쿨다운)', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      await request(app.getHttpServer()).post('/coupang/v2/visit').expect(401);
    });

    it('첫 방문 시 7P를 지급하고 success: true를 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const response = await request(app.getHttpServer())
        .post('/coupang/v2/visit')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({ success: true });

      const { data: action } = await supabase
        .from('point_actions')
        .select('point_amount, type')
        .eq('user_id', testUser.id)
        .eq('type', 'COUPANG_VISIT')
        .single();
      expect(action!.point_amount).toBe(7);
    });

    it('마지막 방문이 10시간 이내면 거부한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const sixHoursAgo = dayjs().subtract(6, 'hour');
      await supabase.from('coupang_visits').insert({
        user_id: testUser.id,
        created_at_date: sixHoursAgo.tz('Asia/Seoul').format('YYYY-MM-DD'),
        point_amount: 7,
        created_at: sixHoursAgo.toISOString(),
      });

      const response = await request(app.getHttpServer())
        .post('/coupang/v2/visit')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({
        success: false,
        message: 'Cooldown not passed',
      });

      const { data: visits } = await supabase
        .from('coupang_visits')
        .select('id')
        .eq('user_id', testUser.id);
      expect(visits).toHaveLength(1);
    });

    it('마지막 방문이 10시간 이상 지났으면 다시 받을 수 있다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const elevenHoursAgo = dayjs().subtract(11, 'hour');
      await supabase.from('coupang_visits').insert({
        user_id: testUser.id,
        created_at_date: elevenHoursAgo.tz('Asia/Seoul').format('YYYY-MM-DD'),
        point_amount: 7,
        created_at: elevenHoursAgo.toISOString(),
      });

      const response = await request(app.getHttpServer())
        .post('/coupang/v2/visit')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({ success: true });

      const { data: visits } = await supabase
        .from('coupang_visits')
        .select('id')
        .eq('user_id', testUser.id);
      expect(visits).toHaveLength(2);
    });

    it('같은 KST 날짜에 두 번 받을 수 있다 (UNIQUE 제약 제거 확인)', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const elevenHoursAgo = dayjs().subtract(11, 'hour');
      const sameDate = dayjs().tz('Asia/Seoul').format('YYYY-MM-DD');
      await supabase.from('coupang_visits').insert({
        user_id: testUser.id,
        created_at_date: sameDate,
        point_amount: 7,
        created_at: elevenHoursAgo.toISOString(),
      });

      await request(app.getHttpServer())
        .post('/coupang/v2/visit')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const { data: visits } = await supabase
        .from('coupang_visits')
        .select('created_at_date')
        .eq('user_id', testUser.id);
      expect(visits).toHaveLength(2);
      expect(visits!.every((v) => v.created_at_date === sameDate)).toBe(true);
    });

    it('다른 유저의 방문은 영향을 주지 않는다', async () => {
      const userA = await createTestUser(supabase);
      const userB = await createTestUser(supabase);
      const tokenB = generateTestToken(userB.auth_id);

      const oneHourAgo = dayjs().subtract(1, 'hour');
      await supabase.from('coupang_visits').insert({
        user_id: userA.id,
        created_at_date: oneHourAgo.tz('Asia/Seoul').format('YYYY-MM-DD'),
        point_amount: 7,
        created_at: oneHourAgo.toISOString(),
      });

      const response = await request(app.getHttpServer())
        .post('/coupang/v2/visit')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);

      expect(response.body).toEqual({ success: true });
    });

    it('point_actions에 additional_data.coupang_visit_id가 들어간다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await request(app.getHttpServer())
        .post('/coupang/v2/visit')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const { data: visit } = await supabase
        .from('coupang_visits')
        .select('id')
        .eq('user_id', testUser.id)
        .single();

      const { data: action } = await supabase
        .from('point_actions')
        .select('additional_data')
        .eq('user_id', testUser.id)
        .eq('type', 'COUPANG_VISIT')
        .single();

      expect(action!.additional_data).toEqual({ coupang_visit_id: visit!.id });
    });
  });

  describe('GET /coupang/v2/visit/status', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      await request(app.getHttpServer())
        .get('/coupang/v2/visit/status')
        .expect(401);
    });

    it('방문 이력이 없으면 canVisit: true, 모든 시각이 null', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const response = await request(app.getHttpServer())
        .get('/coupang/v2/visit/status')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({
        canVisit: true,
        lastVisitedAt: null,
        nextAvailableAt: null,
        remainingSeconds: 0,
      });
    });

    it('쿨다운 중이면 canVisit: false와 남은 시간을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const threeHoursAgo = dayjs().subtract(3, 'hour');
      await supabase.from('coupang_visits').insert({
        user_id: testUser.id,
        created_at_date: threeHoursAgo.tz('Asia/Seoul').format('YYYY-MM-DD'),
        point_amount: 7,
        created_at: threeHoursAgo.toISOString(),
      });

      const response = await request(app.getHttpServer())
        .get('/coupang/v2/visit/status')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.canVisit).toBe(false);
      expect(response.body.lastVisitedAt).not.toBeNull();
      expect(response.body.nextAvailableAt).not.toBeNull();
      // 약 7시간 남음 (오차 60초 허용)
      expect(response.body.remainingSeconds).toBeGreaterThan(7 * 3600 - 60);
      expect(response.body.remainingSeconds).toBeLessThanOrEqual(7 * 3600);
    });

    it('쿨다운 경과 후면 canVisit: true, remainingSeconds 0', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const twelveHoursAgo = dayjs().subtract(12, 'hour');
      await supabase.from('coupang_visits').insert({
        user_id: testUser.id,
        created_at_date: twelveHoursAgo.tz('Asia/Seoul').format('YYYY-MM-DD'),
        point_amount: 7,
        created_at: twelveHoursAgo.toISOString(),
      });

      const response = await request(app.getHttpServer())
        .get('/coupang/v2/visit/status')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.canVisit).toBe(true);
      expect(response.body.remainingSeconds).toBe(0);
    });

    it('여러 방문 중 가장 최근 방문이 기준이 된다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const twentyHoursAgo = dayjs().subtract(20, 'hour');
      const twoHoursAgo = dayjs().subtract(2, 'hour');

      await supabase.from('coupang_visits').insert([
        {
          user_id: testUser.id,
          created_at_date: twentyHoursAgo.tz('Asia/Seoul').format('YYYY-MM-DD'),
          point_amount: 7,
          created_at: twentyHoursAgo.toISOString(),
        },
        {
          user_id: testUser.id,
          created_at_date: twoHoursAgo.tz('Asia/Seoul').format('YYYY-MM-DD'),
          point_amount: 7,
          created_at: twoHoursAgo.toISOString(),
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/coupang/v2/visit/status')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.canVisit).toBe(false);
      // lastVisitedAt 은 twoHoursAgo와 일치해야 함
      const lastVisitedAt = new Date(response.body.lastVisitedAt as string);
      expect(
        Math.abs(lastVisitedAt.getTime() - twoHoursAgo.toDate().getTime()),
      ).toBeLessThan(1000);
    });
  });
});
