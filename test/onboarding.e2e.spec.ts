import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getTestSupabaseAdminClient } from './supabase-client';
import { truncateAllTables } from './setup';
import { createTestUser } from './helpers/user.helper';
import { createDeviceEventParticipation } from './helpers/onboarding.helper';
import { generateTestToken } from './helpers/auth.helper';

describe('Onboarding API (e2e)', () => {
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

  describe('GET /onboarding/event-status', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .get('/onboarding/event-status')
        .expect(401);

      expect(response.body.message).toBe('No token provided');
    });

    it('참여 기록이 없으면 false를 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const response = await request(app.getHttpServer())
        .get('/onboarding/event-status')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.text).toBe('false');
    });

    it('오늘 참여한 기록이 있으면 true를 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createDeviceEventParticipation(supabase, {
        user_id: testUser.id,
        event_name: 'onboarding_event',
      });

      const response = await request(app.getHttpServer())
        .get('/onboarding/event-status')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.text).toBe('true');
    });

    it('어제 참여한 기록이 있으면 false를 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await createDeviceEventParticipation(supabase, {
        user_id: testUser.id,
        event_name: 'onboarding_event',
        created_at: yesterday.toISOString(),
      });

      const response = await request(app.getHttpServer())
        .get('/onboarding/event-status')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.text).toBe('false');
    });

    it('다른 이벤트 참여 기록은 영향을 주지 않는다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createDeviceEventParticipation(supabase, {
        user_id: testUser.id,
        event_name: 'other_event',
      });

      const response = await request(app.getHttpServer())
        .get('/onboarding/event-status')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.text).toBe('false');
    });
  });
});
