import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getTestSupabaseAdminClient } from './supabase-client';
import { truncateAllTables } from './setup';
import { createTestUser } from './helpers/user.helper';
import { generateTestToken } from './helpers/auth.helper';
import {
  createStepLevelClaim,
  getStepLevelClaims,
} from './helpers/step-rewards.helper';
import { REWARD_CONFIG } from '../src/step-rewards/constants/reward-config';

describe('StepRewards API (e2e) - Real DB', () => {
  let app: INestApplication;
  const supabase = getTestSupabaseAdminClient();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await truncateAllTables();
    await app.close();
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  describe('GET /step_rewards/status', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      await request(app.getHttpServer())
        .get('/step_rewards/status')
        .expect(401);
    });

    it('오늘 수령한 레벨 목록과 보상 설정을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);
      const today = new Date().toISOString().split('T')[0];

      await createStepLevelClaim(supabase, {
        user_id: testUser.id,
        claim_date: today,
        level: 1,
        current_step_count: 0,
      });
      await createStepLevelClaim(supabase, {
        user_id: testUser.id,
        claim_date: today,
        level: 2,
        current_step_count: 2500,
      });

      const response = await request(app.getHttpServer())
        .get('/step_rewards/status')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.claimed_levels).toContain(1);
      expect(response.body.claimed_levels).toContain(2);
      expect(response.body.reward_config).toEqual(REWARD_CONFIG);
    });

    it('수령 기록이 없으면 빈 배열을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const response = await request(app.getHttpServer())
        .get('/step_rewards/status')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.claimed_levels).toEqual([]);
      expect(response.body.reward_config).toEqual(REWARD_CONFIG);
    });
  });

  describe('POST /step_rewards/claim', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      await request(app.getHttpServer())
        .post('/step_rewards/claim')
        .send({ step_count: 5000, claim_level: 3, type: 'long' })
        .expect(401);
    });

    it('보상을 정상적으로 수령하면 복권 ID를 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const response = await request(app.getHttpServer())
        .post('/step_rewards/claim')
        .set('Authorization', `Bearer ${token}`)
        .send({ step_count: 5000, claim_level: 3, type: 'long' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.lottery_id).toBeDefined();

      const today = new Date().toISOString().split('T')[0];
      const claims = await getStepLevelClaims(supabase, testUser.id, today);
      expect(claims.length).toBe(1);
      expect(claims[0].level).toBe(3);
    });

    it('레벨 1(첫걸음)은 걸음 수 0으로도 수령 가능하다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const response = await request(app.getHttpServer())
        .post('/step_rewards/claim')
        .set('Authorization', `Bearer ${token}`)
        .send({ step_count: 0, claim_level: 1, type: 'short' })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('걸음 수가 부족하면 400 에러를 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const response = await request(app.getHttpServer())
        .post('/step_rewards/claim')
        .set('Authorization', `Bearer ${token}`)
        .send({ step_count: 1000, claim_level: 2, type: 'long' })
        .expect(400);

      expect(response.body.message).toBe('STEP_NOT_ENOUGH');
    });

    it('존재하지 않는 레벨이면 400 에러를 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const response = await request(app.getHttpServer())
        .post('/step_rewards/claim')
        .set('Authorization', `Bearer ${token}`)
        .send({ step_count: 5000, claim_level: 99, type: 'long' })
        .expect(400);

      expect(response.body.message).toBe('INVALID_LEVEL');
    });

    it('이미 수령한 레벨이면 409 에러를 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);
      const today = new Date().toISOString().split('T')[0];

      await createStepLevelClaim(supabase, {
        user_id: testUser.id,
        claim_date: today,
        level: 3,
        current_step_count: 5000,
      });

      const response = await request(app.getHttpServer())
        .post('/step_rewards/claim')
        .set('Authorization', `Bearer ${token}`)
        .send({ step_count: 5000, claim_level: 3, type: 'long' })
        .expect(409);

      expect(response.body.message).toBe('ALREADY_CLAIMED');
    });

    it('잘못된 type 값이면 400 에러를 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await request(app.getHttpServer())
        .post('/step_rewards/claim')
        .set('Authorization', `Bearer ${token}`)
        .send({ step_count: 5000, claim_level: 3, type: 'invalid' })
        .expect(400);
    });
  });
});
