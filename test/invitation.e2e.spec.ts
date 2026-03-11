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
});
