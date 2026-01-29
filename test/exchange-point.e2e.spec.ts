import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getTestSupabaseAdminClient } from './supabase-client';
import { truncateAllTables } from './setup';
import { createTestUser, TestUser } from './helpers/user.helper';
import { createPointAction, createPointActions } from './helpers/point.helper';
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

    it('출금 내역을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createPointAction(supabase, {
        user_id: testUser.id,
        type: 'EXCHANGE_POINT_TO_CASH',
        point_amount: -5000,
        status: 'pending',
      });

      const response = await request(app.getHttpServer())
        .get('/exchange-point-to-cash')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        amount: -5000,
        status: 'pending',
      });
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('createdAt');
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

      const pointAction = await createPointAction(supabase, {
        user_id: testUser.id,
        type: 'EXCHANGE_POINT_TO_CASH',
        point_amount: -5000,
        status: 'pending',
      });

      const response = await request(app.getHttpServer())
        .delete('/exchange-point-to-cash')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: (pointAction as any).id })
        .expect(200);

      expect(response.body).toEqual({ success: true });
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

      const pointAction = await createPointAction(supabase, {
        user_id: testUser.id,
        type: 'EXCHANGE_POINT_TO_CASH',
        point_amount: -5000,
        status: 'done',
      });

      await request(app.getHttpServer())
        .delete('/exchange-point-to-cash')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: (pointAction as any).id })
        .expect(400);
    });
  });
});
