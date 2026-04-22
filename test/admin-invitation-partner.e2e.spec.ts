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

async function insertPartnerProgram(
  supabase: Supabase,
  params: { userId: string; startsAt: string; endsAt: string },
): Promise<number> {
  const { data, error } = await supabase
    .from('invitation_partner_program')
    .insert({
      user_id: params.userId,
      starts_at: params.startsAt,
      ends_at: params.endsAt,
    })
    .select('id')
    .single();
  if (error || !data) {
    throw new Error(`failed to seed partner: ${error?.message}`);
  }
  return data.id;
}

describe('Admin Invitation Partner API (e2e)', () => {
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

  const isoHoursFromNow = (hours: number): string =>
    new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

  describe('POST /admin/invitation-partner', () => {
    it('admin 키 없이 요청하면 401을 반환한다', async () => {
      const u = await createTestUser(supabase);
      await request(app.getHttpServer())
        .post('/admin/invitation-partner')
        .send({
          userIds: [u.id],
          startsAt: isoHoursFromNow(0),
          endsAt: isoHoursFromNow(24),
        })
        .expect(401);
    });

    it('잘못된 admin 키로 요청하면 401을 반환한다', async () => {
      const u = await createTestUser(supabase);
      await request(app.getHttpServer())
        .post('/admin/invitation-partner')
        .set('x-admin-api-key', 'wrong-key')
        .send({
          userIds: [u.id],
          startsAt: isoHoursFromNow(0),
          endsAt: isoHoursFromNow(24),
        })
        .expect(401);
    });

    it('정상 요청 시 여러 유저를 한번에 등록하고 201을 반환한다', async () => {
      const u1 = await createTestUser(supabase);
      const u2 = await createTestUser(supabase);
      const u3 = await createTestUser(supabase);

      const response = await request(app.getHttpServer())
        .post('/admin/invitation-partner')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .send({
          userIds: [u1.id, u2.id, u3.id],
          startsAt: isoHoursFromNow(0),
          endsAt: isoHoursFromNow(24 * 7),
        })
        .expect(201);

      expect(response.body.createdCount).toBe(3);

      const { data } = await supabase
        .from('invitation_partner_program')
        .select('user_id');
      expect(data).toHaveLength(3);
      const userIds = data!.map((r) => r.user_id).sort();
      expect(userIds).toEqual([u1.id, u2.id, u3.id].sort());
    });

    it('등록 성공 시 대상 유저들에게 partner_selected 모달을 생성한다', async () => {
      const u1 = await createTestUser(supabase);
      const u2 = await createTestUser(supabase);

      await request(app.getHttpServer())
        .post('/admin/invitation-partner')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .send({
          userIds: [u1.id, u2.id],
          startsAt: isoHoursFromNow(0),
          endsAt: isoHoursFromNow(24 * 7),
        })
        .expect(201);

      const { data } = await supabase
        .from('modal_shown')
        .select('user_id, name, status')
        .eq('name', 'partner_selected');

      expect(data).toHaveLength(2);
      const users = data!.map((r) => r.user_id).sort();
      expect(users).toEqual([u1.id, u2.id].sort());
      expect(data!.every((r) => r.status === 'pending')).toBe(true);
    });

    it('409 응답 시 모달도 생성되지 않는다 (전체 롤백)', async () => {
      const u1 = await createTestUser(supabase);
      const u2 = await createTestUser(supabase);

      // u2는 이미 기존 프로그램 있음
      await supabase.from('invitation_partner_program').insert({
        user_id: u2.id,
        starts_at: isoHoursFromNow(-24),
        ends_at: isoHoursFromNow(48),
      });

      await request(app.getHttpServer())
        .post('/admin/invitation-partner')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .send({
          userIds: [u1.id, u2.id],
          startsAt: isoHoursFromNow(0),
          endsAt: isoHoursFromNow(24 * 7),
        })
        .expect(409);

      const { data } = await supabase
        .from('modal_shown')
        .select('id')
        .eq('name', 'partner_selected');

      expect(data).toHaveLength(0);
    });

    it('동일 유저가 기간 겹치는 기존 프로그램을 가지면 409를 반환하고 전체 롤백한다', async () => {
      const u1 = await createTestUser(supabase);
      const u2 = await createTestUser(supabase);
      const u3 = await createTestUser(supabase);

      // u2는 이미 기존 프로그램 있음 (신규 기간과 겹침)
      await insertPartnerProgram(supabase, {
        userId: u2.id,
        startsAt: isoHoursFromNow(-24),
        endsAt: isoHoursFromNow(48),
      });

      const response = await request(app.getHttpServer())
        .post('/admin/invitation-partner')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .send({
          userIds: [u1.id, u2.id, u3.id],
          startsAt: isoHoursFromNow(0),
          endsAt: isoHoursFromNow(24 * 7),
        })
        .expect(409);

      expect(response.body.duplicateUserIds).toEqual([u2.id]);

      // 전체 롤백 — u2 기존 1개 빼고 u1, u3 추가 안 됨
      const { data } = await supabase
        .from('invitation_partner_program')
        .select('user_id');
      expect(data).toHaveLength(1);
      expect(data![0].user_id).toBe(u2.id);
    });

    it('겹치지 않는 과거 프로그램이 있는 유저는 재등록 허용한다', async () => {
      const u1 = await createTestUser(supabase);

      // 완전히 과거에 끝난 프로그램
      await insertPartnerProgram(supabase, {
        userId: u1.id,
        startsAt: isoHoursFromNow(-48 * 7),
        endsAt: isoHoursFromNow(-24 * 7),
      });

      const response = await request(app.getHttpServer())
        .post('/admin/invitation-partner')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .send({
          userIds: [u1.id],
          startsAt: isoHoursFromNow(0),
          endsAt: isoHoursFromNow(24 * 7),
        })
        .expect(201);

      expect(response.body.createdCount).toBe(1);

      const { data } = await supabase
        .from('invitation_partner_program')
        .select('user_id')
        .eq('user_id', u1.id);
      expect(data).toHaveLength(2);
    });

    it('userIds 배열에 중복이 여러 명 있으면 모두 duplicateUserIds에 포함된다', async () => {
      const u1 = await createTestUser(supabase);
      const u2 = await createTestUser(supabase);

      await insertPartnerProgram(supabase, {
        userId: u1.id,
        startsAt: isoHoursFromNow(-24),
        endsAt: isoHoursFromNow(48),
      });
      await insertPartnerProgram(supabase, {
        userId: u2.id,
        startsAt: isoHoursFromNow(-24),
        endsAt: isoHoursFromNow(48),
      });

      const response = await request(app.getHttpServer())
        .post('/admin/invitation-partner')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .send({
          userIds: [u1.id, u2.id],
          startsAt: isoHoursFromNow(0),
          endsAt: isoHoursFromNow(24 * 7),
        })
        .expect(409);

      expect(response.body.duplicateUserIds.sort()).toEqual(
        [u1.id, u2.id].sort(),
      );
    });

    it('userIds가 빈 배열이면 400을 반환한다', async () => {
      await request(app.getHttpServer())
        .post('/admin/invitation-partner')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .send({
          userIds: [],
          startsAt: isoHoursFromNow(0),
          endsAt: isoHoursFromNow(24),
        })
        .expect(400);
    });

    it('endsAt이 startsAt보다 이전이면 400을 반환한다', async () => {
      const u = await createTestUser(supabase);
      await request(app.getHttpServer())
        .post('/admin/invitation-partner')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .send({
          userIds: [u.id],
          startsAt: isoHoursFromNow(24),
          endsAt: isoHoursFromNow(0),
        })
        .expect(400);
    });
  });
});
