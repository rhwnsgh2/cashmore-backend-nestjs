import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getTestSupabaseAdminClient } from './supabase-client';
import { truncateAllTables } from './setup';
import { createTestUser } from './helpers/user.helper';
import { createPointAction } from './helpers/point.helper';
import {
  createExchangeRequest,
  findCashExchangeByPointActionId,
  findPointActionsForExchange,
} from './helpers/cash-exchange.helper';
import { generateTestToken } from './helpers/auth.helper';

describe('ExchangePoint API (e2e) - Real DB', () => {
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

  describe('GET /exchange-point-to-cash', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      await request(app.getHttpServer())
        .get('/exchange-point-to-cash')
        .expect(401);
    });

    it('출금 내역이 없으면 빈 배열을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const response = await request(app.getHttpServer())
        .get('/exchange-point-to-cash')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('출금 내역을 반환한다 (cash_exchanges 기반)', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const { pointActionId } = await createExchangeRequest(supabase, {
        user_id: testUser.id,
        amount: 5000,
        cashExchangeStatus: 'pending',
      });

      const response = await request(app.getHttpServer())
        .get('/exchange-point-to-cash')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        id: pointActionId, // point_action_id로 노출됨 (호환성)
        amount: -5000, // 음수로 변환됨
        status: 'pending',
      });
      expect(response.body[0]).toHaveProperty('createdAt');
    });

    it('여러 건의 출금 내역을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createExchangeRequest(supabase, {
        user_id: testUser.id,
        amount: 5000,
        cashExchangeStatus: 'pending',
      });
      await createExchangeRequest(supabase, {
        user_id: testUser.id,
        amount: 3000,
        cashExchangeStatus: 'done',
        confirmed_at: new Date().toISOString(),
      });

      const response = await request(app.getHttpServer())
        .get('/exchange-point-to-cash')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
    });

    it('다른 유저의 내역은 포함되지 않는다', async () => {
      const userA = await createTestUser(supabase);
      const userB = await createTestUser(supabase);
      const tokenA = generateTestToken(userA.auth_id);

      await createExchangeRequest(supabase, {
        user_id: userA.id,
        amount: 5000,
      });
      await createExchangeRequest(supabase, {
        user_id: userB.id,
        amount: 3000,
      });

      const response = await request(app.getHttpServer())
        .get('/exchange-point-to-cash')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].amount).toBe(-5000);
    });
  });

  describe('POST /exchange-point-to-cash', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      await request(app.getHttpServer())
        .post('/exchange-point-to-cash')
        .send({ amount: 5000 })
        .expect(401);
    });

    it('출금 신청에 성공한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      // 포인트 적립
      await createPointAction(supabase, {
        user_id: testUser.id,
        type: 'ATTENDANCE',
        point_amount: 10000,
        status: 'done',
      });

      const response = await request(app.getHttpServer())
        .post('/exchange-point-to-cash')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 5000 })
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
      });
      expect(response.body).toHaveProperty('id');
    });

    it('Phase 3: 신청 시 point_actions에 status="done"으로 INSERT된다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createPointAction(supabase, {
        user_id: testUser.id,
        type: 'ATTENDANCE',
        point_amount: 10000,
        status: 'done',
      });

      await request(app.getHttpServer())
        .post('/exchange-point-to-cash')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 5000 })
        .expect(201);

      // point_actions에는 -5000, status='done'으로 들어가야 함
      const exchanges = await findPointActionsForExchange(
        supabase,
        testUser.id,
      );
      expect(exchanges).toHaveLength(1);
      expect(exchanges[0].point_amount).toBe(-5000);
      expect(exchanges[0].status).toBe('done'); // ⚠️ Phase 3 핵심
    });

    it('Phase 3: 신청 시 cash_exchanges에 status="pending"으로 INSERT된다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createPointAction(supabase, {
        user_id: testUser.id,
        type: 'ATTENDANCE',
        point_amount: 10000,
        status: 'done',
      });

      const response = await request(app.getHttpServer())
        .post('/exchange-point-to-cash')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 5000 })
        .expect(201);

      const pointActionId = response.body.id;
      const cashExchange = await findCashExchangeByPointActionId(
        supabase,
        pointActionId,
      );
      expect(cashExchange).not.toBeNull();
      expect(cashExchange!.status).toBe('pending');
      expect(cashExchange!.amount).toBe(5000);
    });

    it('최소 금액 미만이면 400을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await request(app.getHttpServer())
        .post('/exchange-point-to-cash')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 500 })
        .expect(400);
    });

    it('잔액 부족이면 400을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createPointAction(supabase, {
        user_id: testUser.id,
        type: 'ATTENDANCE',
        point_amount: 3000,
        status: 'done',
      });

      await request(app.getHttpServer())
        .post('/exchange-point-to-cash')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 5000 })
        .expect(400);
    });
  });

  describe('DELETE /exchange-point-to-cash', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      await request(app.getHttpServer())
        .delete('/exchange-point-to-cash')
        .send({ id: 1 })
        .expect(401);
    });

    it('pending 상태 출금을 취소한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const { pointActionId } = await createExchangeRequest(supabase, {
        user_id: testUser.id,
        amount: 5000,
        cashExchangeStatus: 'pending',
      });

      const response = await request(app.getHttpServer())
        .delete('/exchange-point-to-cash')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: pointActionId })
        .expect(200);

      expect(response.body).toEqual({ success: true });
    });

    it('Phase 3: 취소 시 point_actions에 복원 행 +amount가 INSERT된다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const { pointActionId } = await createExchangeRequest(supabase, {
        user_id: testUser.id,
        amount: 5000,
        cashExchangeStatus: 'pending',
      });

      await request(app.getHttpServer())
        .delete('/exchange-point-to-cash')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: pointActionId })
        .expect(200);

      const exchanges = await findPointActionsForExchange(
        supabase,
        testUser.id,
      );
      // 원본 deduct + 복원 행 = 2개
      expect(exchanges).toHaveLength(2);

      // 원본은 그대로 (status='done', -5000)
      const original = exchanges.find((e) => e.id === pointActionId)!;
      expect(original.point_amount).toBe(-5000);
      expect(original.status).toBe('done');

      // 복원 행 (status='done', +5000, original_point_action_id 마커)
      const restore = exchanges.find((e) => e.id !== pointActionId)!;
      expect(restore.point_amount).toBe(5000);
      expect(restore.status).toBe('done');
      expect(restore.additional_data).toMatchObject({
        original_point_action_id: pointActionId,
        reason: 'cancelled',
      });
    });

    it('Phase 3: 취소 시 cash_exchanges status가 cancelled로 변경된다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const { pointActionId } = await createExchangeRequest(supabase, {
        user_id: testUser.id,
        amount: 5000,
        cashExchangeStatus: 'pending',
      });

      await request(app.getHttpServer())
        .delete('/exchange-point-to-cash')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: pointActionId })
        .expect(200);

      const cashExchange = await findCashExchangeByPointActionId(
        supabase,
        pointActionId,
      );
      expect(cashExchange).not.toBeNull();
      expect(cashExchange!.status).toBe('cancelled');
      expect(cashExchange!.cancelled_at).toBeTruthy();
    });

    it('Phase 3: 취소 후 잔액 net = 0', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      // 잔액 10000
      await createPointAction(supabase, {
        user_id: testUser.id,
        type: 'ATTENDANCE',
        point_amount: 10000,
        status: 'done',
      });

      // 5000 신청
      const requestResponse = await request(app.getHttpServer())
        .post('/exchange-point-to-cash')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 5000 })
        .expect(201);

      const pointActionId = requestResponse.body.id;

      // 5000 취소
      await request(app.getHttpServer())
        .delete('/exchange-point-to-cash')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: pointActionId })
        .expect(200);

      // 모든 EXCHANGE_POINT_TO_CASH 행의 합 = 0
      const exchanges = await findPointActionsForExchange(
        supabase,
        testUser.id,
      );
      const sum = exchanges.reduce((acc, e) => acc + Number(e.point_amount), 0);
      expect(sum).toBe(0);
    });

    it('존재하지 않는 출금이면 404를 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await request(app.getHttpServer())
        .delete('/exchange-point-to-cash')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: 999999 })
        .expect(404);
    });

    it('done 상태 출금은 취소 불가하다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const { pointActionId } = await createExchangeRequest(supabase, {
        user_id: testUser.id,
        amount: 5000,
        cashExchangeStatus: 'done',
        confirmed_at: new Date().toISOString(),
      });

      await request(app.getHttpServer())
        .delete('/exchange-point-to-cash')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: pointActionId })
        .expect(400);
    });

    it('다른 유저의 출금은 취소할 수 없다', async () => {
      const userA = await createTestUser(supabase);
      const userB = await createTestUser(supabase);
      const tokenB = generateTestToken(userB.auth_id);

      const { pointActionId } = await createExchangeRequest(supabase, {
        user_id: userA.id,
        amount: 5000,
        cashExchangeStatus: 'pending',
      });

      await request(app.getHttpServer())
        .delete('/exchange-point-to-cash')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ id: pointActionId })
        .expect(404);
    });
  });
});
