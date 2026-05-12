import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getTestSupabaseAdminClient } from './supabase-client';
import { truncateAllTables } from './setup';
import { createTestUser, TestUser } from './helpers/user.helper';
import { createPointActions } from './helpers/point.helper';

const ADMIN_API_KEY = process.env.BATCH_API_KEY ?? 'test-batch-api-key';

describe('Admin Point API (e2e) - Real DB', () => {
  let app: INestApplication;
  const supabase = getTestSupabaseAdminClient();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await truncateAllTables();
    await app.close();
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  describe('GET /admin/point/total', () => {
    it('잘못된 API 키 → 401', async () => {
      await request(app.getHttpServer())
        .get('/admin/point/total')
        .set('x-admin-api-key', 'wrong')
        .query({ userId: '00000000-0000-4000-8000-000000000001' })
        .expect(401);
    });

    it('API 키 없음 → 401', async () => {
      await request(app.getHttpServer())
        .get('/admin/point/total')
        .query({ userId: '00000000-0000-4000-8000-000000000001' })
        .expect(401);
    });

    it('userId 미전송 → 400', async () => {
      await request(app.getHttpServer())
        .get('/admin/point/total')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(400);
    });

    it('userId가 UUID 형식이 아님 → 400', async () => {
      await request(app.getHttpServer())
        .get('/admin/point/total')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .query({ userId: 'not-a-uuid' })
        .expect(400);
    });

    it('정상: 해당 유저의 보유 포인트 반환', async () => {
      const testUser: TestUser = await createTestUser(supabase);
      await createPointActions(supabase, [
        { user_id: testUser.id, point_amount: 5000, type: 'EVENT' },
        { user_id: testUser.id, point_amount: -1500, type: 'GIFTICON_PURCHASE' },
      ]);

      const res = await request(app.getHttpServer())
        .get('/admin/point/total')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .query({ userId: testUser.id })
        .expect(200);

      expect(res.body.totalPoint).toBe(3500);
      expect(res.body).toHaveProperty('expiringPoints');
      expect(res.body).toHaveProperty('expiringDate');
    });

    it('포인트 적립 이력 없는 유저 → totalPoint=0', async () => {
      const testUser: TestUser = await createTestUser(supabase);

      const res = await request(app.getHttpServer())
        .get('/admin/point/total')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .query({ userId: testUser.id })
        .expect(200);

      expect(res.body.totalPoint).toBe(0);
    });

    it('다른 유저의 차감/적립은 합산에 포함되지 않음', async () => {
      const targetUser = await createTestUser(supabase);
      const otherUser = await createTestUser(supabase);

      await createPointActions(supabase, [
        { user_id: targetUser.id, point_amount: 2000, type: 'EVENT' },
        { user_id: otherUser.id, point_amount: 9999, type: 'EVENT' },
      ]);

      const res = await request(app.getHttpServer())
        .get('/admin/point/total')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .query({ userId: targetUser.id })
        .expect(200);

      expect(res.body.totalPoint).toBe(2000);
    });
  });
});
