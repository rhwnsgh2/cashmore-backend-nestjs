import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getTestSupabaseAdminClient } from './supabase-client';
import { truncateAllTables } from './setup';
import { createTestUser } from './helpers/user.helper';
import { createUserModal, createUserModals } from './helpers/modal.helper';
import { generateTestToken } from './helpers/auth.helper';

describe('UserModal API (e2e)', () => {
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

  describe('GET /user/modals', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .get('/user/modals')
        .expect(401);

      expect(response.body.message).toBe('No token provided');
    });

    it('대기 중인 모달이 없으면 빈 배열을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const response = await request(app.getHttpServer())
        .get('/user/modals')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.modals).toEqual([]);
    });

    it('대기 중인 모달 목록을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createUserModals(supabase, [
        {
          user_id: testUser.id,
          name: 'onboarding',
          status: 'pending',
        },
        {
          user_id: testUser.id,
          name: 'interview',
          status: 'pending',
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/user/modals')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.modals).toHaveLength(2);

      const names = response.body.modals.map(
        (m: { name: string }) => m.name,
      );
      expect(names).toContain('onboarding');
      expect(names).toContain('interview');
    });

    it('completed 상태의 모달은 포함하지 않는다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createUserModals(supabase, [
        {
          user_id: testUser.id,
          name: 'onboarding',
          status: 'pending',
        },
        {
          user_id: testUser.id,
          name: 'interview',
          status: 'completed',
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/user/modals')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.modals).toHaveLength(1);
      expect(response.body.modals[0].name).toBe('onboarding');
    });

    it('다른 사용자의 모달은 포함하지 않는다', async () => {
      const testUser = await createTestUser(supabase);
      const otherUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createUserModals(supabase, [
        {
          user_id: testUser.id,
          name: 'onboarding',
          status: 'pending',
        },
        {
          user_id: otherUser.id,
          name: 'interview',
          status: 'pending',
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/user/modals')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.modals).toHaveLength(1);
      expect(response.body.modals[0].name).toBe('onboarding');
    });

    it('응답에 모든 필드가 포함된다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createUserModal(supabase, {
        user_id: testUser.id,
        name: 'exchange_point_to_cash',
        status: 'pending',
        additional_data: { amount: 5000 },
      });

      const response = await request(app.getHttpServer())
        .get('/user/modals')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.modals).toHaveLength(1);

      const modal = response.body.modals[0];
      expect(modal).toHaveProperty('id');
      expect(modal).toHaveProperty('name', 'exchange_point_to_cash');
      expect(modal).toHaveProperty('status', 'pending');
      expect(modal).toHaveProperty('additionalData');
      expect(modal.additionalData).toEqual({ amount: 5000 });
    });
  });
});
