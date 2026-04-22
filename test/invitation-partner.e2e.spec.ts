import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getTestSupabaseAdminClient } from './supabase-client';
import { truncateAllTables } from './setup';
import { createTestUser } from './helpers/user.helper';
import { generateTestToken } from './helpers/auth.helper';
import { updateUserDeviceId } from './helpers/invite-code.helper';

type Supabase = ReturnType<typeof getTestSupabaseAdminClient>;

async function createPartnerProgram(
  supabase: Supabase,
  params: {
    userId: string;
    startsAt: string;
    endsAt: string;
  },
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
    throw new Error(`Failed to create partner program: ${error?.message}`);
  }
  return data.id;
}

async function insertInvitationUser(
  supabase: Supabase,
  params: {
    invitationId: number;
    userId: string;
    createdAt?: string;
  },
): Promise<void> {
  const row: {
    invitation_id: number;
    user_id: string;
    created_at?: string;
  } = {
    invitation_id: params.invitationId,
    user_id: params.userId,
  };
  if (params.createdAt) row.created_at = params.createdAt;

  const { error } = await supabase.from('invitation_user').insert(row);
  if (error) {
    throw new Error(`Failed to insert invitation_user: ${error.message}`);
  }
}

describe('Invitation Partner Program (e2e)', () => {
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

  // 기준 시각: 프로그램 기간 [-1d, +1d] (활성)
  const now = () => new Date();
  const isoHoursFromNow = (hours: number): string =>
    new Date(now().getTime() + hours * 60 * 60 * 1000).toISOString();

  describe('POST /invitation/lotto-process - 파트너 보상', () => {
    it('활성 파트너 프로그램 중이면 INVITE_REWARD 500P가 지급되고 partner_program_id가 기록된다', async () => {
      const inviter = await createTestUser(supabase);
      const invitee = await createTestUser(supabase);
      const deviceId = `device-${Date.now()}`;

      await updateUserDeviceId(supabase, invitee.id, deviceId);

      const programId = await createPartnerProgram(supabase, {
        userId: inviter.id,
        startsAt: isoHoursFromNow(-24),
        endsAt: isoHoursFromNow(24),
      });

      const inviterToken = generateTestToken(inviter.auth_id);
      const inviteeToken = generateTestToken(invitee.auth_id);

      const invitationRes = await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${inviterToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .post('/invitation/lotto-process')
        .set('Authorization', `Bearer ${inviteeToken}`)
        .send({ invitationCode: invitationRes.body.identifier, deviceId })
        .expect(201);

      const { data } = await supabase
        .from('point_actions')
        .select('point_amount, additional_data')
        .eq('user_id', inviter.id)
        .eq('type', 'INVITE_REWARD');

      expect(data).toHaveLength(1);
      expect(data![0].point_amount).toBe(500);
      expect(
        (data![0].additional_data as { partner_program_id?: number })
          .partner_program_id,
      ).toBe(programId);
    });

    it('활성 파트너 프로그램이 없으면 기존 300P로 지급된다', async () => {
      const inviter = await createTestUser(supabase);
      const invitee = await createTestUser(supabase);
      const deviceId = `device-${Date.now()}`;

      await updateUserDeviceId(supabase, invitee.id, deviceId);

      const inviterToken = generateTestToken(inviter.auth_id);
      const inviteeToken = generateTestToken(invitee.auth_id);

      const invitationRes = await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${inviterToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .post('/invitation/lotto-process')
        .set('Authorization', `Bearer ${inviteeToken}`)
        .send({ invitationCode: invitationRes.body.identifier, deviceId })
        .expect(201);

      const { data } = await supabase
        .from('point_actions')
        .select('point_amount, additional_data')
        .eq('user_id', inviter.id)
        .eq('type', 'INVITE_REWARD');

      expect(data).toHaveLength(1);
      expect(data![0].point_amount).toBe(300);
      expect(
        (data![0].additional_data as { partner_program_id?: number })
          .partner_program_id,
      ).toBeUndefined();
    });

    it('프로그램 종료 이후(ends_at 경과)에는 기본 300P로 지급된다', async () => {
      const inviter = await createTestUser(supabase);
      const invitee = await createTestUser(supabase);
      const deviceId = `device-${Date.now()}`;

      await updateUserDeviceId(supabase, invitee.id, deviceId);

      // 과거에 끝난 프로그램
      await createPartnerProgram(supabase, {
        userId: inviter.id,
        startsAt: isoHoursFromNow(-48),
        endsAt: isoHoursFromNow(-1),
      });

      const inviterToken = generateTestToken(inviter.auth_id);
      const inviteeToken = generateTestToken(invitee.auth_id);

      const invitationRes = await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${inviterToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .post('/invitation/lotto-process')
        .set('Authorization', `Bearer ${inviteeToken}`)
        .send({ invitationCode: invitationRes.body.identifier, deviceId })
        .expect(201);

      const { data } = await supabase
        .from('point_actions')
        .select('point_amount')
        .eq('user_id', inviter.id)
        .eq('type', 'INVITE_REWARD');

      expect(data).toHaveLength(1);
      expect(data![0].point_amount).toBe(300);
    });
  });
  describe('GET /invitation/partner/me', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      await request(app.getHttpServer())
        .get('/invitation/partner/me')
        .expect(401);
    });

    it('활성 파트너 프로그램이 있으면 isActive true와 기간을 반환한다', async () => {
      const user = await createTestUser(supabase);
      const token = generateTestToken(user.auth_id);
      const startsAt = isoHoursFromNow(-24);
      const endsAt = isoHoursFromNow(24);
      await createPartnerProgram(supabase, {
        userId: user.id,
        startsAt,
        endsAt,
      });

      const response = await request(app.getHttpServer())
        .get('/invitation/partner/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.isActive).toBe(true);
      expect(response.body.startsAt).toBeDefined();
      expect(response.body.endsAt).toBeDefined();
      expect(new Date(response.body.startsAt).getTime()).toBe(
        new Date(startsAt).getTime(),
      );
      expect(new Date(response.body.endsAt).getTime()).toBe(
        new Date(endsAt).getTime(),
      );
    });

    it('파트너 프로그램이 없으면 isActive false만 반환한다', async () => {
      const user = await createTestUser(supabase);
      const token = generateTestToken(user.auth_id);

      const response = await request(app.getHttpServer())
        .get('/invitation/partner/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({ isActive: false });
    });

    it('프로그램이 종료된 유저는 isActive false를 반환한다', async () => {
      const user = await createTestUser(supabase);
      const token = generateTestToken(user.auth_id);
      await createPartnerProgram(supabase, {
        userId: user.id,
        startsAt: isoHoursFromNow(-48),
        endsAt: isoHoursFromNow(-1),
      });

      const response = await request(app.getHttpServer())
        .get('/invitation/partner/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({ isActive: false });
    });

    it('초대장이 없는 유저도 정상 응답한다', async () => {
      // 파트너 프로그램 API는 초대장 유무와 무관해야 함
      const user = await createTestUser(supabase);
      const token = generateTestToken(user.auth_id);

      const response = await request(app.getHttpServer())
        .get('/invitation/partner/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({ isActive: false });
    });
  });

  describe('GET /invitation/partner/step-event', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      await request(app.getHttpServer())
        .get('/invitation/partner/step-event')
        .expect(401);
    });

    it('활성 파트너가 아니면 isActive false만 반환한다', async () => {
      const user = await createTestUser(supabase);
      const token = generateTestToken(user.auth_id);

      const response = await request(app.getHttpServer())
        .get('/invitation/partner/step-event')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({ isActive: false });
    });

    it('활성 파트너면 프로그램 정보 + 이벤트 통계 + 역대 누적을 반환한다', async () => {
      const user = await createTestUser(supabase);
      const token = generateTestToken(user.auth_id);

      const invitationRes = await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const invitationId = invitationRes.body.id as number;

      const startsAt = isoHoursFromNow(-24);
      const endsAt = isoHoursFromNow(24);
      const programId = await createPartnerProgram(supabase, {
        userId: user.id,
        startsAt,
        endsAt,
      });

      // 프로그램 기간 내 3명
      for (let i = 0; i < 3; i++) {
        const u = await createTestUser(supabase);
        await insertInvitationUser(supabase, {
          invitationId,
          userId: u.id,
          createdAt: isoHoursFromNow(-1),
        });
      }
      // 프로그램 밖 2명
      for (let i = 0; i < 2; i++) {
        const u = await createTestUser(supabase);
        await insertInvitationUser(supabase, {
          invitationId,
          userId: u.id,
          createdAt: isoHoursFromNow(-48),
        });
      }

      // 역대 초대 보상 300 × 5 = 1500
      for (let i = 0; i < 5; i++) {
        await supabase.from('point_actions').insert({
          user_id: user.id,
          type: 'INVITE_REWARD',
          status: 'done',
          point_amount: 300,
          additional_data: { invited_user_id: 'x' },
        });
      }

      const response = await request(app.getHttpServer())
        .get('/invitation/partner/step-event')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.isActive).toBe(true);
      expect(response.body.programId).toBe(programId);
      expect(response.body.invitationCount).toBe(3);
      expect(response.body.pointsPerInvitation).toBe(500);
      expect(response.body.receivedRewards).toEqual([]);
      expect(response.body.pointsEarned).toBe(1500);
      expect(response.body.steps).toHaveLength(4);
      expect(response.body.totalInvitationCount).toBe(5);
      expect(response.body.totalInvitationPoints).toBe(1500);
    });

    it('초대장이 없어도 활성 파트너면 invitationCount 0으로 응답한다', async () => {
      const user = await createTestUser(supabase);
      const token = generateTestToken(user.auth_id);

      await createPartnerProgram(supabase, {
        userId: user.id,
        startsAt: isoHoursFromNow(-24),
        endsAt: isoHoursFromNow(24),
      });

      const response = await request(app.getHttpServer())
        .get('/invitation/partner/step-event')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.isActive).toBe(true);
      expect(response.body.invitationCount).toBe(0);
      expect(response.body.totalInvitationCount).toBe(0);
      expect(response.body.pointsEarned).toBe(0);
      expect(response.body.totalInvitationPoints).toBe(0);
    });
  });

  describe('POST /invitation/partner/step-reward', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      await request(app.getHttpServer())
        .post('/invitation/partner/step-reward')
        .send({ stepCount: 3 })
        .expect(401);
    });

    it('활성 파트너가 아니면 success:false를 반환한다', async () => {
      const user = await createTestUser(supabase);
      const token = generateTestToken(user.auth_id);

      const response = await request(app.getHttpServer())
        .post('/invitation/partner/step-reward')
        .set('Authorization', `Bearer ${token}`)
        .send({ stepCount: 3 })
        .expect(201);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('No active partner program');
    });

    it('조건 충족 시 수령하고 partner_program_id가 기록된다', async () => {
      const user = await createTestUser(supabase);
      const token = generateTestToken(user.auth_id);

      const invitationRes = await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const invitationId = invitationRes.body.id as number;

      const programId = await createPartnerProgram(supabase, {
        userId: user.id,
        startsAt: isoHoursFromNow(-24),
        endsAt: isoHoursFromNow(24),
      });

      for (let i = 0; i < 3; i++) {
        const u = await createTestUser(supabase);
        await insertInvitationUser(supabase, {
          invitationId,
          userId: u.id,
          createdAt: isoHoursFromNow(-1),
        });
      }

      await request(app.getHttpServer())
        .post('/invitation/partner/step-reward')
        .set('Authorization', `Bearer ${token}`)
        .send({ stepCount: 3 })
        .expect(201);

      const { data } = await supabase
        .from('point_actions')
        .select('additional_data, point_amount')
        .eq('user_id', user.id)
        .eq('type', 'INVITE_STEP_REWARD');

      expect(data).toHaveLength(1);
      expect(
        (data![0].additional_data as { partner_program_id?: number })
          .partner_program_id,
      ).toBe(programId);
    });

    it('카운트 부족이면 400을 반환한다', async () => {
      const user = await createTestUser(supabase);
      const token = generateTestToken(user.auth_id);

      // 초대장 생성 (없으면 Invitation not found로 400 아닌 201+success:false로 떨어짐)
      await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      await createPartnerProgram(supabase, {
        userId: user.id,
        startsAt: isoHoursFromNow(-24),
        endsAt: isoHoursFromNow(24),
      });

      await request(app.getHttpServer())
        .post('/invitation/partner/step-reward')
        .set('Authorization', `Bearer ${token}`)
        .send({ stepCount: 3 })
        .expect(400);
    });

    it('이미 수령한 step은 409를 반환한다', async () => {
      const user = await createTestUser(supabase);
      const token = generateTestToken(user.auth_id);

      const invitationRes = await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const invitationId = invitationRes.body.id as number;

      await createPartnerProgram(supabase, {
        userId: user.id,
        startsAt: isoHoursFromNow(-24),
        endsAt: isoHoursFromNow(24),
      });

      for (let i = 0; i < 3; i++) {
        const u = await createTestUser(supabase);
        await insertInvitationUser(supabase, {
          invitationId,
          userId: u.id,
          createdAt: isoHoursFromNow(-1),
        });
      }

      await request(app.getHttpServer())
        .post('/invitation/partner/step-reward')
        .set('Authorization', `Bearer ${token}`)
        .send({ stepCount: 3 })
        .expect(201);

      await request(app.getHttpServer())
        .post('/invitation/partner/step-reward')
        .set('Authorization', `Bearer ${token}`)
        .send({ stepCount: 3 })
        .expect(409);
    });
  });
});
