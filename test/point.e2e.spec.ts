import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getTestSupabaseAdminClient } from './supabase-client';
import { truncateAllTables } from './setup';
import { createTestUser, TestUser } from './helpers/user.helper';
import { createPointActions } from './helpers/point.helper';
import {
  generateTestToken,
  generateExpiredToken,
  generateInvalidToken,
} from './helpers/auth.helper';

describe('Point API (e2e) - Real DB', () => {
  let app: INestApplication;
  const supabase = getTestSupabaseAdminClient();

  beforeAll(async () => {
    // 실제 AppModule 사용 (SupabasePointRepository 사용)
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

  describe('GET /point/total', () => {
    describe('인증', () => {
      it('토큰 없이 요청하면 401을 반환한다', async () => {
        const response = await request(app.getHttpServer())
          .get('/point/total')
          .expect(401);

        expect(response.body.message).toBe('No token provided');
      });

      it('만료된 토큰으로 요청하면 401을 반환한다', async () => {
        const testUser = await createTestUser(supabase);
        const expiredToken = generateExpiredToken(testUser.auth_id);

        const response = await request(app.getHttpServer())
          .get('/point/total')
          .set('Authorization', `Bearer ${expiredToken}`)
          .expect(401);

        expect(response.body.message).toBe('Token expired');
      });

      it('잘못된 토큰으로 요청하면 401을 반환한다', async () => {
        const testUser = await createTestUser(supabase);
        const invalidToken = generateInvalidToken(testUser.auth_id);

        const response = await request(app.getHttpServer())
          .get('/point/total')
          .set('Authorization', `Bearer ${invalidToken}`)
          .expect(401);

        expect(response.body.message).toBe('Invalid token');
      });

      it('존재하지 않는 사용자의 토큰으로 요청하면 401을 반환한다', async () => {
        const nonExistentAuthId = 'non-existent-auth-id';
        const token = generateTestToken(nonExistentAuthId);

        const response = await request(app.getHttpServer())
          .get('/point/total')
          .set('Authorization', `Bearer ${token}`)
          .expect(401);

        expect(response.body.message).toBe('User not found');
      });
    });

    describe('포인트 조회', () => {
      let testUser: TestUser;
      let token: string;

      beforeEach(async () => {
        testUser = await createTestUser(supabase);
        token = generateTestToken(testUser.auth_id);
      });

      it('포인트 액션이 없는 사용자는 0 포인트를 반환한다', async () => {
        const response = await request(app.getHttpServer())
          .get('/point/total')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body).toHaveProperty('totalPoint', 0);
        expect(response.body).toHaveProperty('expiringPoints', 0);
        expect(response.body).toHaveProperty('expiringDate');
      });

      it('포인트 액션이 있으면 총 포인트를 계산한다', async () => {
        await createPointActions(supabase, [
          {
            user_id: testUser.id,
            type: 'EVERY_RECEIPT',
            point_amount: 1000,
          },
          {
            user_id: testUser.id,
            type: 'ATTENDANCE',
            point_amount: 50,
          },
        ]);

        const response = await request(app.getHttpServer())
          .get('/point/total')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.totalPoint).toBe(1050);
      });

      it('출금 pending 상태도 포인트에서 차감된다', async () => {
        await createPointActions(supabase, [
          {
            user_id: testUser.id,
            type: 'EVERY_RECEIPT',
            point_amount: 5000,
            status: 'done',
          },
          {
            user_id: testUser.id,
            type: 'EXCHANGE_POINT_TO_CASH',
            point_amount: -2000,
            status: 'pending',
          },
        ]);

        const response = await request(app.getHttpServer())
          .get('/point/total')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.totalPoint).toBe(3000);
      });
    });
  });
});
