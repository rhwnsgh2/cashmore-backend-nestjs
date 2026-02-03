import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getTestSupabaseAdminClient } from './supabase-client';
import { truncateAllTables } from './setup';
import { createTestUser } from './helpers/user.helper';
import { generateTestToken } from './helpers/auth.helper';
import {
  createDeviceEventParticipation,
  createInvitationUser,
  updateUserDeviceId,
} from './helpers/invite-code.helper';

describe('InviteCode API (e2e) - Real DB', () => {
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

  describe('GET /can-input-invite-code', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      await request(app.getHttpServer())
        .get('/can-input-invite-code')
        .expect(401);
    });

    it('24시간 이내 가입한 신규 사용자는 true를 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await updateUserDeviceId(supabase, testUser.id, 'device-123');

      const response = await request(app.getHttpServer())
        .get('/can-input-invite-code')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toBe(true);
    });

    it('이미 디바이스 이벤트에 참여했으면 false를 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);
      const deviceId = 'device-123';

      await updateUserDeviceId(supabase, testUser.id, deviceId);
      await createDeviceEventParticipation(supabase, {
        device_id: deviceId,
        event_name: 'invitation_reward',
      });

      const response = await request(app.getHttpServer())
        .get('/can-input-invite-code')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toBe(false);
    });

    it('이미 초대받은 사용자면 false를 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await updateUserDeviceId(supabase, testUser.id, 'device-123');
      await createInvitationUser(supabase, { user_id: testUser.id });

      const response = await request(app.getHttpServer())
        .get('/can-input-invite-code')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toBe(false);
    });
  });
});
