import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getTestSupabaseAdminClient } from './supabase-client';
import { truncateAllTables } from './setup';
import { createTestUser } from './helpers/user.helper';

const ADMIN_API_KEY = process.env.BATCH_API_KEY ?? 'test-batch-api-key';

type Supabase = ReturnType<typeof getTestSupabaseAdminClient>;

async function createInvitationForUser(
  supabase: Supabase,
  userId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from('invitation')
    .insert({
      sender_id: userId,
      identifier: `I${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      type: 'normal',
      status: 'pending',
    })
    .select('id')
    .single();
  if (error || !data) {
    throw new Error(`failed to create invitation: ${error?.message}`);
  }
  return data.id;
}

async function seedInvitedUsers(
  supabase: Supabase,
  invitationId: number,
  count: number,
): Promise<void> {
  for (let i = 0; i < count; i++) {
    const u = await createTestUser(supabase);
    const { error } = await supabase
      .from('invitation_user')
      .insert({ invitation_id: invitationId, user_id: u.id });
    if (error) {
      throw new Error(`failed to insert invitation_user: ${error.message}`);
    }
  }
}

describe('Admin User API (e2e)', () => {
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

  describe('GET /admin/users/top-inviters', () => {
    it('admin 키 없이 요청하면 401을 반환한다', async () => {
      await request(app.getHttpServer())
        .get('/admin/users/top-inviters?minInviteCount=1')
        .expect(401);
    });

    it('잘못된 admin 키로 요청하면 401을 반환한다', async () => {
      await request(app.getHttpServer())
        .get('/admin/users/top-inviters?minInviteCount=1')
        .set('x-admin-api-key', 'wrong-key')
        .expect(401);
    });

    it('minInviteCount 이상 초대한 유저들을 inviteCount 내림차순으로 반환한다', async () => {
      const top = await createTestUser(supabase);
      const mid = await createTestUser(supabase);
      const low = await createTestUser(supabase);

      const topInvId = await createInvitationForUser(supabase, top.id);
      const midInvId = await createInvitationForUser(supabase, mid.id);
      const lowInvId = await createInvitationForUser(supabase, low.id);

      await seedInvitedUsers(supabase, topInvId, 5);
      await seedInvitedUsers(supabase, midInvId, 3);
      await seedInvitedUsers(supabase, lowInvId, 1);

      const response = await request(app.getHttpServer())
        .get('/admin/users/top-inviters?minInviteCount=3')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(200);

      expect(response.body.users).toHaveLength(2);
      expect(response.body.users[0]).toEqual({
        userId: top.id,
        email: top.email,
        inviteCount: 5,
      });
      expect(response.body.users[1]).toEqual({
        userId: mid.id,
        email: mid.email,
        inviteCount: 3,
      });
    });

    it('minInviteCount를 충족하는 유저가 없으면 빈 배열을 반환한다', async () => {
      const u = await createTestUser(supabase);
      const invId = await createInvitationForUser(supabase, u.id);
      await seedInvitedUsers(supabase, invId, 2);

      const response = await request(app.getHttpServer())
        .get('/admin/users/top-inviters?minInviteCount=100')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(200);

      expect(response.body.users).toEqual([]);
    });

    it('minInviteCount 없으면 400을 반환한다', async () => {
      await request(app.getHttpServer())
        .get('/admin/users/top-inviters')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(400);
    });

    it('minInviteCount가 음수면 400을 반환한다', async () => {
      await request(app.getHttpServer())
        .get('/admin/users/top-inviters?minInviteCount=-1')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(400);
    });
  });
});
