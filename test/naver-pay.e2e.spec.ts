import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getTestSupabaseAdminClient } from './supabase-client';
import { truncateAllTables } from './setup';
import { createTestUser } from './helpers/user.helper';
import { createPointAction } from './helpers/point.helper';
import { createNaverPayAccount } from './helpers/naver-pay.helper';
import { generateTestToken } from './helpers/auth.helper';

describe('NaverPay API (e2e) - Real DB', () => {
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

  // --- 계정 연결 상태 조회 ---

  describe('GET /naverpay/account', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      await request(app.getHttpServer())
        .get('/naverpay/account')
        .expect(401);
    });

    it('연결된 계정이 없으면 connected: false를 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const response = await request(app.getHttpServer())
        .get('/naverpay/account')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({ connected: false });
    });

    it('연결된 계정이 있으면 connected: true와 정보를 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createNaverPayAccount(supabase, {
        user_id: testUser.id,
        dau_masking_id: 'nav***',
        status: 'connected',
      });

      const response = await request(app.getHttpServer())
        .get('/naverpay/account')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.connected).toBe(true);
      expect(response.body.maskingId).toBe('nav***');
      expect(response.body).toHaveProperty('connectedAt');
    });

    it('disconnected 계정만 있으면 connected: false를 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createNaverPayAccount(supabase, {
        user_id: testUser.id,
        status: 'disconnected',
      });

      const response = await request(app.getHttpServer())
        .get('/naverpay/account')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({ connected: false });
    });
  });

  // --- 계정 연결 ---

  describe('POST /naverpay/connect', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      await request(app.getHttpServer())
        .post('/naverpay/connect')
        .send({ uniqueId: 'test' })
        .expect(401);
    });

    it('Stub으로 계정 연결에 성공한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const response = await request(app.getHttpServer())
        .post('/naverpay/connect')
        .set('Authorization', `Bearer ${token}`)
        .send({ uniqueId: 'naver-unique-123' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('maskingId');
      expect(response.body.data).toHaveProperty('naverPayPoint');
    });

    it('이미 연결된 계정이 있으면 400을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createNaverPayAccount(supabase, {
        user_id: testUser.id,
        status: 'connected',
      });

      const response = await request(app.getHttpServer())
        .post('/naverpay/connect')
        .set('Authorization', `Bearer ${token}`)
        .send({ uniqueId: 'naver-unique-123' })
        .expect(400);

      expect(response.body.message).toContain('이미 연결된');
    });
  });

  // --- 계정 해제 ---

  describe('DELETE /naverpay/account', () => {
    it('연결된 계정을 해제한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createNaverPayAccount(supabase, {
        user_id: testUser.id,
        status: 'connected',
      });

      await request(app.getHttpServer())
        .delete('/naverpay/account')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // 해제 확인
      const response = await request(app.getHttpServer())
        .get('/naverpay/account')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({ connected: false });
    });

    it('연결된 계정이 없으면 404를 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await request(app.getHttpServer())
        .delete('/naverpay/account')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  // --- 전환 요청 ---

  describe('POST /naverpay/exchange', () => {
    it('정상 전환 요청 시 pending 상태로 생성된다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      // 계정 연결
      await createNaverPayAccount(supabase, {
        user_id: testUser.id,
        status: 'connected',
      });

      // 포인트 적립 (10000P)
      await createPointAction(supabase, {
        user_id: testUser.id,
        type: 'EVERY_RECEIPT',
        point_amount: 10000,
        status: 'done',
      });

      const response = await request(app.getHttpServer())
        .post('/naverpay/exchange')
        .set('Authorization', `Bearer ${token}`)
        .send({ point: 5000 })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.cashmorePoint).toBe(5000);
      expect(response.body.data.naverpayPoint).toBe(5050);
      expect(response.body.data.status).toBe('pending');
    });

    it('네이버페이 미연결 시 400을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await request(app.getHttpServer())
        .post('/naverpay/exchange')
        .set('Authorization', `Bearer ${token}`)
        .send({ point: 5000 })
        .expect(400);
    });

    it('최소 금액 미만이면 400을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createNaverPayAccount(supabase, {
        user_id: testUser.id,
        status: 'connected',
      });

      await createPointAction(supabase, {
        user_id: testUser.id,
        type: 'EVERY_RECEIPT',
        point_amount: 10000,
        status: 'done',
      });

      await request(app.getHttpServer())
        .post('/naverpay/exchange')
        .set('Authorization', `Bearer ${token}`)
        .send({ point: 999 })
        .expect(400);
    });

    it('포인트 부족 시 400을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createNaverPayAccount(supabase, {
        user_id: testUser.id,
        status: 'connected',
      });

      await createPointAction(supabase, {
        user_id: testUser.id,
        type: 'EVERY_RECEIPT',
        point_amount: 500,
        status: 'done',
      });

      await request(app.getHttpServer())
        .post('/naverpay/exchange')
        .set('Authorization', `Bearer ${token}`)
        .send({ point: 1000 })
        .expect(400);
    });

    it('일일 요청 제한 초과 시 400을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createNaverPayAccount(supabase, {
        user_id: testUser.id,
        status: 'connected',
      });

      await createPointAction(supabase, {
        user_id: testUser.id,
        type: 'EVERY_RECEIPT',
        point_amount: 20000,
        status: 'done',
      });

      // 첫 번째 요청 성공
      await request(app.getHttpServer())
        .post('/naverpay/exchange')
        .set('Authorization', `Bearer ${token}`)
        .send({ point: 1000 })
        .expect(201);

      // 두 번째 요청 실패
      await request(app.getHttpServer())
        .post('/naverpay/exchange')
        .set('Authorization', `Bearer ${token}`)
        .send({ point: 1000 })
        .expect(400);
    });
  });

  // --- 전환 취소 ---

  describe('DELETE /naverpay/exchange/:id', () => {
    it('pending 요청을 취소하고 포인트가 복원된다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createNaverPayAccount(supabase, {
        user_id: testUser.id,
        status: 'connected',
      });

      await createPointAction(supabase, {
        user_id: testUser.id,
        type: 'EVERY_RECEIPT',
        point_amount: 10000,
        status: 'done',
      });

      // 전환 요청
      const exchangeRes = await request(app.getHttpServer())
        .post('/naverpay/exchange')
        .set('Authorization', `Bearer ${token}`)
        .send({ point: 5000 })
        .expect(201);

      const exchangeId = exchangeRes.body.data.exchangeId;

      // 취소
      await request(app.getHttpServer())
        .delete(`/naverpay/exchange/${exchangeId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // 전환 내역 확인
      const listRes = await request(app.getHttpServer())
        .get('/naverpay/exchanges')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(listRes.body.exchanges[0].status).toBe('cancelled');
    });

    it('다른 유저의 요청은 취소할 수 없다', async () => {
      const user1 = await createTestUser(supabase);
      const user2 = await createTestUser(supabase);
      const token1 = generateTestToken(user1.auth_id);
      const token2 = generateTestToken(user2.auth_id);

      await createNaverPayAccount(supabase, {
        user_id: user1.id,
        status: 'connected',
      });

      await createPointAction(supabase, {
        user_id: user1.id,
        type: 'EVERY_RECEIPT',
        point_amount: 10000,
        status: 'done',
      });

      const exchangeRes = await request(app.getHttpServer())
        .post('/naverpay/exchange')
        .set('Authorization', `Bearer ${token1}`)
        .send({ point: 5000 })
        .expect(201);

      // 다른 유저가 취소 시도
      await request(app.getHttpServer())
        .delete(`/naverpay/exchange/${exchangeRes.body.data.exchangeId}`)
        .set('Authorization', `Bearer ${token2}`)
        .expect(400);
    });
  });

  // --- 전환 내역 조회 ---

  describe('GET /naverpay/exchanges', () => {
    it('전환 내역이 없으면 빈 배열을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const response = await request(app.getHttpServer())
        .get('/naverpay/exchanges')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.exchanges).toEqual([]);
    });
  });

  // --- 전환 정책 조회 ---

  describe('GET /naverpay/config', () => {
    it('전환 정책과 오늘 사용 횟수를 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const response = await request(app.getHttpServer())
        .get('/naverpay/config')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({
        exchangeRate: 1.01,
        minPoint: 1000,
        dailyLimit: 1,
        todayUsed: 0,
      });
    });
  });

  // --- pending 요청 있을 때 계정 해제 거부 ---

  describe('계정 해제와 전환 요청 상호작용', () => {
    it('pending 전환 요청이 있으면 계정 해제를 거부한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createNaverPayAccount(supabase, {
        user_id: testUser.id,
        status: 'connected',
      });

      await createPointAction(supabase, {
        user_id: testUser.id,
        type: 'EVERY_RECEIPT',
        point_amount: 10000,
        status: 'done',
      });

      // 전환 요청
      await request(app.getHttpServer())
        .post('/naverpay/exchange')
        .set('Authorization', `Bearer ${token}`)
        .send({ point: 5000 })
        .expect(201);

      // 계정 해제 시도 → 거부
      const response = await request(app.getHttpServer())
        .delete('/naverpay/account')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(response.body.message).toContain('진행 중인 전환 요청');
    });

    it('전환 취소 후에는 계정 해제가 가능하다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createNaverPayAccount(supabase, {
        user_id: testUser.id,
        status: 'connected',
      });

      await createPointAction(supabase, {
        user_id: testUser.id,
        type: 'EVERY_RECEIPT',
        point_amount: 10000,
        status: 'done',
      });

      // 전환 요청
      const exchangeRes = await request(app.getHttpServer())
        .post('/naverpay/exchange')
        .set('Authorization', `Bearer ${token}`)
        .send({ point: 5000 })
        .expect(201);

      // 전환 취소
      await request(app.getHttpServer())
        .delete(`/naverpay/exchange/${exchangeRes.body.data.exchangeId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // 계정 해제 성공
      await request(app.getHttpServer())
        .delete('/naverpay/account')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('취소 후 재요청이 가능하다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createNaverPayAccount(supabase, {
        user_id: testUser.id,
        status: 'connected',
      });

      await createPointAction(supabase, {
        user_id: testUser.id,
        type: 'EVERY_RECEIPT',
        point_amount: 20000,
        status: 'done',
      });

      // 첫 번째 요청
      const first = await request(app.getHttpServer())
        .post('/naverpay/exchange')
        .set('Authorization', `Bearer ${token}`)
        .send({ point: 5000 })
        .expect(201);

      // 취소
      await request(app.getHttpServer())
        .delete(`/naverpay/exchange/${first.body.data.exchangeId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // 재요청 성공
      const second = await request(app.getHttpServer())
        .post('/naverpay/exchange')
        .set('Authorization', `Bearer ${token}`)
        .send({ point: 3000 })
        .expect(201);

      expect(second.body.success).toBe(true);
    });
  });
});
