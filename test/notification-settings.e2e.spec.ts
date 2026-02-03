import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getTestSupabaseAdminClient } from './supabase-client';
import { truncateAllTables } from './setup';
import { createTestUser } from './helpers/user.helper';
import { generateTestToken } from './helpers/auth.helper';

describe('NotificationSettings API (e2e) - Real DB', () => {
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

  describe('POST /notification-settings/enable-all', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      await request(app.getHttpServer())
        .post('/notification-settings/enable-all')
        .expect(401);
    });

    it('모든 알림 설정을 활성화하고 성공을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const response = await request(app.getHttpServer())
        .post('/notification-settings/enable-all')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      expect(response.body).toEqual({ success: true });
    });

    it('notification_settings 테이블에 AD_LOTTERY 설정이 생성된다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await request(app.getHttpServer())
        .post('/notification-settings/enable-all')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      const { data } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', testUser.id)
        .eq('type', 'AD_LOTTERY')
        .single();

      expect(data).toBeDefined();
      expect(data?.is_enabled).toBe(true);
    });

    it('user 테이블의 marketing_info가 true로 업데이트된다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await request(app.getHttpServer())
        .post('/notification-settings/enable-all')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      const { data } = await supabase
        .from('user')
        .select('marketing_info, marketing_info_updated_at')
        .eq('id', testUser.id)
        .single();

      expect(data?.marketing_info).toBe(true);
      expect(data?.marketing_info_updated_at).toBeDefined();
    });

    it('이미 설정이 있어도 다시 호출하면 업데이트된다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      // 먼저 AD_LOTTERY 설정을 false로 생성
      await supabase.from('notification_settings').insert({
        user_id: testUser.id,
        type: 'AD_LOTTERY',
        is_enabled: false,
      });

      await request(app.getHttpServer())
        .post('/notification-settings/enable-all')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      const { data } = await supabase
        .from('notification_settings')
        .select('is_enabled')
        .eq('user_id', testUser.id)
        .eq('type', 'AD_LOTTERY')
        .single();

      expect(data?.is_enabled).toBe(true);
    });
  });
});
