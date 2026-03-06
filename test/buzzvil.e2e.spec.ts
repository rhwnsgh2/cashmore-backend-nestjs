import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { IpWhitelistGuard } from '../src/buzzvil/guards/ip-whitelist.guard';
import { getTestSupabaseAdminClient } from './supabase-client';
import { truncateAllTables } from './setup';
import { createTestUser, TestUser } from './helpers/user.helper';
import { generateTestToken } from './helpers/auth.helper';
import { buildPostbackBody, findBuzzvilReward } from './helpers/buzzvil.helper';

describe('Buzzvil API (e2e) - Real DB', () => {
  let app: INestApplication;
  const supabase = getTestSupabaseAdminClient();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(IpWhitelistGuard)
      .useValue({ canActivate: () => true })
      .compile();

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

  describe('POST /buzzvil/postback', () => {
    it('유효한 포스트백 → 200 + DB 저장 확인', async () => {
      const testUser = await createTestUser(supabase);
      const body = buildPostbackBody({
        user_id: testUser.auth_id,
        campaign_id: '10075328',
        point: '100',
      });

      const response = await request(app.getHttpServer())
        .post('/buzzvil/postback')
        .send(body)
        .expect(200);

      expect(response.body.message).toBe('OK');

      // DB에 저장 확인
      const reward = await findBuzzvilReward(supabase, testUser.id, 10075328);
      expect(reward).not.toBeNull();
      expect(reward.point_amount).toBe(100);
      expect(reward.type).toBe('BUZZVIL_REWARD');
      expect(reward.status).toBe('done');
      expect(reward.additional_data.transaction_id).toBe(body.transaction_id);
    });

    it('중복 transaction_id → 409', async () => {
      const testUser = await createTestUser(supabase);
      const body = buildPostbackBody({
        user_id: testUser.auth_id,
        transaction_id: 'dup-txn-001',
      });

      await request(app.getHttpServer())
        .post('/buzzvil/postback')
        .send(body)
        .expect(200);

      await request(app.getHttpServer())
        .post('/buzzvil/postback')
        .send(body)
        .expect(409);
    });

    it('탈퇴 유저 (auth_id 매핑 실패) → 200, DB 저장 안 됨', async () => {
      const body = buildPostbackBody({
        user_id: 'non-existent-auth-id',
        campaign_id: '99999',
      });

      const response = await request(app.getHttpServer())
        .post('/buzzvil/postback')
        .send(body)
        .expect(200);

      expect(response.body.message).toBe('OK');
    });
  });

  describe('GET /buzzvil/reward-status', () => {
    let testUser: TestUser;
    let token: string;
    let sinceTimestamp: string;

    beforeEach(async () => {
      await truncateAllTables();
      testUser = await createTestUser(supabase);
      token = generateTestToken(testUser.auth_id);
      sinceTimestamp = new Date().toISOString();
    });

    it('미적립 → 빈 배열 + total_point 0', async () => {
      const response = await request(app.getHttpServer())
        .get('/buzzvil/reward-status')
        .query({ since: sinceTimestamp })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({ rewards: [], total_point: 0 });
    });

    it('적립 완료 → rewards 배열 + total_point', async () => {
      const body = buildPostbackBody({
        user_id: testUser.auth_id,
        campaign_id: '10075328',
        point: '200',
      });

      await request(app.getHttpServer())
        .post('/buzzvil/postback')
        .send(body)
        .expect(200);

      const response = await request(app.getHttpServer())
        .get('/buzzvil/reward-status')
        .query({ since: sinceTimestamp })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.rewards).toHaveLength(1);
      expect(response.body.rewards[0].campaign_id).toBe(10075328);
      expect(response.body.rewards[0].point).toBe(200);
      expect(response.body.total_point).toBe(200);
    });

    it('여러 건 적립 → 모두 반환 + total_point 합산', async () => {
      await request(app.getHttpServer())
        .post('/buzzvil/postback')
        .send(
          buildPostbackBody({
            user_id: testUser.auth_id,
            campaign_id: '10075328',
            point: '100',
          }),
        )
        .expect(200);

      await request(app.getHttpServer())
        .post('/buzzvil/postback')
        .send(
          buildPostbackBody({
            user_id: testUser.auth_id,
            campaign_id: '99999',
            point: '50',
            title: '보너스',
          }),
        )
        .expect(200);

      const response = await request(app.getHttpServer())
        .get('/buzzvil/reward-status')
        .query({ since: sinceTimestamp })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.rewards).toHaveLength(2);
      expect(response.body.total_point).toBe(150);
    });

    it('다른 유저의 적립은 조회 불가', async () => {
      const otherUser = await createTestUser(supabase);

      await request(app.getHttpServer())
        .post('/buzzvil/postback')
        .send(
          buildPostbackBody({
            user_id: otherUser.auth_id,
            campaign_id: '10075328',
            point: '100',
          }),
        )
        .expect(200);

      const response = await request(app.getHttpServer())
        .get('/buzzvil/reward-status')
        .query({ since: sinceTimestamp })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({ rewards: [], total_point: 0 });
    });
  });

  describe('GET /buzzvil/ads', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      await request(app.getHttpServer())
        .get('/buzzvil/ads')
        .query({ platform: 'A' })
        .expect(401);
    });
  });
});
