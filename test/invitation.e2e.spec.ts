import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getTestSupabaseAdminClient } from './supabase-client';
import { truncateAllTables } from './setup';
import { createTestUser } from './helpers/user.helper';
import { generateTestToken } from './helpers/auth.helper';

describe('Invitation API (e2e)', () => {
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

  describe('GET /invitation', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .get('/invitation')
        .expect(401);

      expect(response.body.message).toBe('No token provided');
    });

    it('초대장이 없으면 새로 생성하여 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const response = await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body.senderId).toBe(testUser.id);
      expect(response.body.type).toBe('normal');
      expect(response.body.status).toBe('pending');
      expect(response.body.identifier).toHaveLength(6);
      expect(response.body).toHaveProperty('createdAt');
    });

    it('이미 초대장이 있으면 동일한 초대장을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const first = await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const second = await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(first.body.id).toBe(second.body.id);
      expect(first.body.identifier).toBe(second.body.identifier);
    });

    it('다른 사용자는 다른 초대장을 받는다', async () => {
      const user1 = await createTestUser(supabase);
      const user2 = await createTestUser(supabase);
      const token1 = generateTestToken(user1.auth_id);
      const token2 = generateTestToken(user2.auth_id);

      const res1 = await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      const res2 = await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${token2}`)
        .expect(200);

      expect(res1.body.id).not.toBe(res2.body.id);
      expect(res1.body.identifier).not.toBe(res2.body.identifier);
      expect(res1.body.senderId).toBe(user1.id);
      expect(res2.body.senderId).toBe(user2.id);
    });

    it('초대 코드는 허용된 문자만 포함한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const response = await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const validChars = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
      expect(response.body.identifier).toMatch(validChars);
    });
  });

  describe('POST /invitation/verify', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .post('/invitation/verify')
        .send({ invitationCode: 'ABC234' })
        .expect(401);

      expect(response.body.message).toBe('No token provided');
    });

    it('유효한 초대 코드이면 success: true를 반환한다', async () => {
      const inviter = await createTestUser(supabase);
      const invitee = await createTestUser(supabase);
      const inviterToken = generateTestToken(inviter.auth_id);
      const inviteeToken = generateTestToken(invitee.auth_id);

      // 초대장 생성
      const invitationRes = await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${inviterToken}`)
        .expect(200);

      // 다른 사용자가 검증
      const response = await request(app.getHttpServer())
        .post('/invitation/verify')
        .set('Authorization', `Bearer ${inviteeToken}`)
        .send({ invitationCode: invitationRes.body.identifier })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.error).toBeUndefined();
    });

    it('본인의 초대 코드이면 success: false를 반환한다', async () => {
      const user = await createTestUser(supabase);
      const token = generateTestToken(user.auth_id);

      // 초대장 생성
      const invitationRes = await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // 본인이 검증
      const response = await request(app.getHttpServer())
        .post('/invitation/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({ invitationCode: invitationRes.body.identifier })
        .expect(201);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe(
        '본인의 초대 코드는 사용할 수 없습니다.',
      );
    });

    it('존재하지 않는 코드이면 success: false를 반환한다', async () => {
      const user = await createTestUser(supabase);
      const token = generateTestToken(user.auth_id);

      const response = await request(app.getHttpServer())
        .post('/invitation/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({ invitationCode: 'ZZZZZZ' })
        .expect(201);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('올바른 초대 코드를 입력해주세요');
    });
  });

  describe('GET /invitation_step_event', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .get('/invitation_step_event')
        .expect(401);

      expect(response.body.message).toBe('No token provided');
    });

    it('초대장이 없으면 404를 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await request(app.getHttpServer())
        .get('/invitation_step_event')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('초대장이 있으면 단계별 이벤트 현황을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      // 초대장 먼저 생성
      await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const response = await request(app.getHttpServer())
        .get('/invitation_step_event')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.invitationCount).toBe(0);
      expect(response.body.receivedRewards).toEqual([]);
      expect(response.body.totalPoints).toBe(0);
      expect(response.body.steps).toHaveLength(4);
      expect(response.body.steps[0]).toEqual({
        count: 3,
        reward: '천원 받기',
        amount: 1000,
      });
    });
  });
});
