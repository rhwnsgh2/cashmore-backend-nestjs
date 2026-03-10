import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getTestSupabaseAdminClient } from './supabase-client';
import { truncateAllTables } from './setup';
import { createTestUser } from './helpers/user.helper';
import { createPointActions } from './helpers/point.helper';
import { createUserModal } from './helpers/modal.helper';
import { generateTestToken } from './helpers/auth.helper';

describe('NpsSurvey API (e2e)', () => {
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

  describe('GET /nps-survey/target', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .get('/nps-survey/target')
        .expect(401);

      expect(response.body.message).toBe('No token provided');
    });

    it('출금 이력이 없으면 not_target을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const response = await request(app.getHttpServer())
        .get('/nps-survey/target')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({ need: false, reason: 'not_target' });
    });

    it('이미 nps_survey 모달이 있으면 already_submitted을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createUserModal(supabase, {
        user_id: testUser.id,
        name: 'nps_survey',
        status: 'pending',
      });

      const response = await request(app.getHttpServer())
        .get('/nps-survey/target')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({
        need: false,
        reason: 'already_submitted',
      });
    });

    it('마지막 출금이 오늘이면 exchange_today를 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createPointActions(supabase, [
        {
          user_id: testUser.id,
          type: 'EXCHANGE_POINT_TO_CASH',
          point_amount: -5000,
          status: 'done',
          created_at: new Date().toISOString(),
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/nps-survey/target')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({
        need: false,
        reason: 'exchange_today',
      });
    });

    it('출금 합계가 1000원 초과이고 오늘이 아니면 target을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await createPointActions(supabase, [
        {
          user_id: testUser.id,
          type: 'EXCHANGE_POINT_TO_CASH',
          point_amount: -800,
          status: 'done',
          created_at: yesterday.toISOString(),
        },
        {
          user_id: testUser.id,
          type: 'EXCHANGE_POINT_TO_CASH',
          point_amount: -300,
          status: 'done',
          created_at: yesterday.toISOString(),
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/nps-survey/target')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({ need: true, reason: 'target' });

      // modal_shown에 nps_survey가 생성되었는지 확인
      const { data: modal } = await supabase
        .from('modal_shown')
        .select('*')
        .eq('user_id', testUser.id)
        .eq('name', 'nps_survey')
        .single();

      expect(modal).not.toBeNull();
      expect(modal!.status).toBe('pending');
    });

    it('출금 합계가 1000원 이하이면 not_target을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await createPointActions(supabase, [
        {
          user_id: testUser.id,
          type: 'EXCHANGE_POINT_TO_CASH',
          point_amount: -500,
          status: 'done',
          created_at: yesterday.toISOString(),
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/nps-survey/target')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({ need: false, reason: 'not_target' });
    });

    it('pending 상태의 출금은 포함하지 않는다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await createPointActions(supabase, [
        {
          user_id: testUser.id,
          type: 'EXCHANGE_POINT_TO_CASH',
          point_amount: -5000,
          status: 'pending',
          created_at: yesterday.toISOString(),
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/nps-survey/target')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({ need: false, reason: 'not_target' });
    });
  });
});
