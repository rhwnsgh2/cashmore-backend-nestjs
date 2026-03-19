import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { AppModule } from '../src/app.module';
import { getTestSupabaseAdminClient } from './supabase-client';
import { truncateAllTables } from './setup';
import { createTestUser } from './helpers/user.helper';
import { generateTestToken } from './helpers/auth.helper';

dayjs.extend(utc);
dayjs.extend(timezone);

describe('Event API (e2e)', () => {
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

  async function updateUserCreatedAt(userId: string, createdAt: string) {
    const { error } = await supabase
      .from('user')
      .update({ created_at: createdAt })
      .eq('id', userId);

    if (error) {
      throw new Error(`Failed to update created_at: ${error.message}`);
    }
  }

  describe('GET /event/double-point', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .get('/event/double-point')
        .expect(401);

      expect(response.body.message).toBe('No token provided');
    });

    it('가입 다음날이면 true를 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const yesterday = dayjs()
        .tz('Asia/Seoul')
        .subtract(1, 'day')
        .hour(12)
        .toISOString();
      await updateUserCreatedAt(testUser.id, yesterday);

      const response = await request(app.getHttpServer())
        .get('/event/double-point')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.text).toBe('true');
    });

    it('가입 당일이면 false를 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const today = dayjs().tz('Asia/Seoul').hour(12).toISOString();
      await updateUserCreatedAt(testUser.id, today);

      const response = await request(app.getHttpServer())
        .get('/event/double-point')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.text).toBe('false');
    });

    it('가입 2일 이후면 false를 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const twoDaysAgo = dayjs()
        .tz('Asia/Seoul')
        .subtract(2, 'day')
        .hour(12)
        .toISOString();
      await updateUserCreatedAt(testUser.id, twoDaysAgo);

      const response = await request(app.getHttpServer())
        .get('/event/double-point')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.text).toBe('false');
    });
  });

  describe('GET /double-point-event', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .get('/double-point-event')
        .expect(401);

      expect(response.body.message).toBe('No token provided');
    });

    it('가입 다음날이면 true를 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const yesterday = dayjs()
        .tz('Asia/Seoul')
        .subtract(1, 'day')
        .hour(12)
        .toISOString();
      await updateUserCreatedAt(testUser.id, yesterday);

      const response = await request(app.getHttpServer())
        .get('/double-point-event')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.text).toBe('true');
    });
  });
});
