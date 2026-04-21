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

  describe('GET /invitation_step_event - 파트너 분기', () => {
    it('파트너이면 프로그램 기간 내 초대만 카운트한다', async () => {
      const inviter = await createTestUser(supabase);
      const inviterToken = generateTestToken(inviter.auth_id);

      await createPartnerProgram(supabase, {
        userId: inviter.id,
        startsAt: isoHoursFromNow(-24),
        endsAt: isoHoursFromNow(24),
      });

      const invitationRes = await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${inviterToken}`)
        .expect(200);
      const invitationId = invitationRes.body.id as number;

      // 프로그램 이전 초대 3명 (카운트되면 안 됨)
      for (let i = 0; i < 3; i++) {
        const u = await createTestUser(supabase);
        await insertInvitationUser(supabase, {
          invitationId,
          userId: u.id,
          createdAt: isoHoursFromNow(-48),
        });
      }
      // 프로그램 기간 내 초대 5명 (카운트돼야 함)
      for (let i = 0; i < 5; i++) {
        const u = await createTestUser(supabase);
        await insertInvitationUser(supabase, {
          invitationId,
          userId: u.id,
          createdAt: isoHoursFromNow(-1),
        });
      }

      const response = await request(app.getHttpServer())
        .get('/invitation_step_event')
        .set('Authorization', `Bearer ${inviterToken}`)
        .expect(200);

      expect(response.body.invitationCount).toBe(5);
    });

    it('응답에 totalInvitationCount(전체 누적)와 activeProgram(파트너 정보)이 포함된다', async () => {
      const inviter = await createTestUser(supabase);
      const inviterToken = generateTestToken(inviter.auth_id);

      const programId = await createPartnerProgram(supabase, {
        userId: inviter.id,
        startsAt: isoHoursFromNow(-24),
        endsAt: isoHoursFromNow(24),
      });

      const invitationRes = await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${inviterToken}`)
        .expect(200);

      // 프로그램 시작 전 10명
      for (let i = 0; i < 10; i++) {
        const u = await createTestUser(supabase);
        await insertInvitationUser(supabase, {
          invitationId: invitationRes.body.id,
          userId: u.id,
          createdAt: isoHoursFromNow(-48),
        });
      }
      // 프로그램 기간 내 3명
      for (let i = 0; i < 3; i++) {
        const u = await createTestUser(supabase);
        await insertInvitationUser(supabase, {
          invitationId: invitationRes.body.id,
          userId: u.id,
          createdAt: isoHoursFromNow(-1),
        });
      }

      const response = await request(app.getHttpServer())
        .get('/invitation_step_event')
        .set('Authorization', `Bearer ${inviterToken}`)
        .expect(200);

      // 이벤트 기준 (프로그램 기간 내만)
      expect(response.body.invitationCount).toBe(3);
      // 전체 누적 (프로그램 전 10명 + 내 3명)
      expect(response.body.totalInvitationCount).toBe(13);
      // 파트너 프로그램 정보
      expect(response.body.activeProgram).toEqual({
        id: programId,
        startsAt: expect.any(String),
        endsAt: expect.any(String),
      });
    });

    it('비파트너면 activeProgram은 null이고 totalInvitationCount는 전체 누적이다', async () => {
      const inviter = await createTestUser(supabase);
      const inviterToken = generateTestToken(inviter.auth_id);

      const invitationRes = await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${inviterToken}`)
        .expect(200);

      for (let i = 0; i < 7; i++) {
        const u = await createTestUser(supabase);
        await insertInvitationUser(supabase, {
          invitationId: invitationRes.body.id,
          userId: u.id,
        });
      }

      const response = await request(app.getHttpServer())
        .get('/invitation_step_event')
        .set('Authorization', `Bearer ${inviterToken}`)
        .expect(200);

      expect(response.body.activeProgram).toBeNull();
      expect(response.body.totalInvitationCount).toBe(7);
      expect(response.body.invitationCount).toBe(7);
    });

    it('파트너면 totalPoints가 count × 500으로 계산된다', async () => {
      const inviter = await createTestUser(supabase);
      const inviterToken = generateTestToken(inviter.auth_id);

      await createPartnerProgram(supabase, {
        userId: inviter.id,
        startsAt: isoHoursFromNow(-24),
        endsAt: isoHoursFromNow(24),
      });

      const invitationRes = await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${inviterToken}`)
        .expect(200);

      for (let i = 0; i < 5; i++) {
        const u = await createTestUser(supabase);
        await insertInvitationUser(supabase, {
          invitationId: invitationRes.body.id,
          userId: u.id,
          createdAt: isoHoursFromNow(-1),
        });
      }

      const response = await request(app.getHttpServer())
        .get('/invitation_step_event')
        .set('Authorization', `Bearer ${inviterToken}`)
        .expect(200);

      expect(response.body.invitationCount).toBe(5);
      expect(response.body.totalPoints).toBe(2500);
    });

    it('프로그램 종료 후(ends_at 경과)에는 기존 카운트 규칙으로 돌아간다', async () => {
      const inviter = await createTestUser(supabase);
      const inviterToken = generateTestToken(inviter.auth_id);

      // 이미 끝난 파트너 프로그램
      await createPartnerProgram(supabase, {
        userId: inviter.id,
        startsAt: isoHoursFromNow(-48),
        endsAt: isoHoursFromNow(-1),
      });

      const invitationRes = await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${inviterToken}`)
        .expect(200);

      for (let i = 0; i < 3; i++) {
        const u = await createTestUser(supabase);
        await insertInvitationUser(supabase, {
          invitationId: invitationRes.body.id,
          userId: u.id,
        });
      }

      const response = await request(app.getHttpServer())
        .get('/invitation_step_event')
        .set('Authorization', `Bearer ${inviterToken}`)
        .expect(200);

      // 기존 규칙(300P × 3) 적용
      expect(response.body.invitationCount).toBe(3);
      expect(response.body.totalPoints).toBe(900);
    });

    it('파트너가 아니면 기존 카운트 규칙을 유지한다', async () => {
      const inviter = await createTestUser(supabase);
      const inviterToken = generateTestToken(inviter.auth_id);

      const invitationRes = await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${inviterToken}`)
        .expect(200);
      const invitationId = invitationRes.body.id as number;

      // 일반 이벤트 시작 이후 초대 3명
      for (let i = 0; i < 3; i++) {
        const u = await createTestUser(supabase);
        await insertInvitationUser(supabase, {
          invitationId,
          userId: u.id,
        });
      }

      const response = await request(app.getHttpServer())
        .get('/invitation_step_event')
        .set('Authorization', `Bearer ${inviterToken}`)
        .expect(200);

      expect(response.body.invitationCount).toBe(3);
    });
  });

  describe('POST /invitation-step-reward - 파트너 분기', () => {
    it('파트너는 프로그램 내 카운트로 수령 가능하고 partner_program_id가 기록된다', async () => {
      const inviter = await createTestUser(supabase);
      const inviterToken = generateTestToken(inviter.auth_id);

      const programId = await createPartnerProgram(supabase, {
        userId: inviter.id,
        startsAt: isoHoursFromNow(-24),
        endsAt: isoHoursFromNow(24),
      });

      const invitationRes = await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${inviterToken}`)
        .expect(200);

      // 프로그램 내 3명 초대
      for (let i = 0; i < 3; i++) {
        const u = await createTestUser(supabase);
        await insertInvitationUser(supabase, {
          invitationId: invitationRes.body.id,
          userId: u.id,
          createdAt: isoHoursFromNow(-1),
        });
      }

      const response = await request(app.getHttpServer())
        .post('/invitation-step-reward')
        .set('Authorization', `Bearer ${inviterToken}`)
        .send({ stepCount: 3 })
        .expect(201);

      expect(response.body.success).toBe(true);

      const { data } = await supabase
        .from('point_actions')
        .select('additional_data')
        .eq('user_id', inviter.id)
        .eq('type', 'INVITE_STEP_REWARD');

      expect(data).toHaveLength(1);
      expect(
        (
          data![0].additional_data as {
            partner_program_id?: number;
            step_count?: number;
          }
        ).partner_program_id,
      ).toBe(programId);
    });

    it('프로그램 기간 밖의 초대는 파트너 카운트에 포함되지 않아 수령할 수 없다', async () => {
      const inviter = await createTestUser(supabase);
      const inviterToken = generateTestToken(inviter.auth_id);

      await createPartnerProgram(supabase, {
        userId: inviter.id,
        startsAt: isoHoursFromNow(-24),
        endsAt: isoHoursFromNow(24),
      });

      const invitationRes = await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${inviterToken}`)
        .expect(200);

      // 프로그램 이전 초대 10명 (파트너 카운트에서는 제외)
      for (let i = 0; i < 10; i++) {
        const u = await createTestUser(supabase);
        await insertInvitationUser(supabase, {
          invitationId: invitationRes.body.id,
          userId: u.id,
          createdAt: isoHoursFromNow(-48),
        });
      }

      // 파트너 카운트 0명 상태에서 3단계 수령 시도 → 400
      await request(app.getHttpServer())
        .post('/invitation-step-reward')
        .set('Authorization', `Bearer ${inviterToken}`)
        .send({ stepCount: 3 })
        .expect(400);
    });

    it('일반 수령 이력이 있어도 파트너 수령은 독립적으로 가능하다', async () => {
      const inviter = await createTestUser(supabase);
      const inviterToken = generateTestToken(inviter.auth_id);

      // 이미 일반으로 3단계 수령한 이력을 point_actions에 직접 삽입
      await supabase.from('point_actions').insert({
        user_id: inviter.id,
        type: 'INVITE_STEP_REWARD',
        status: 'done',
        point_amount: 1000,
        additional_data: { step_count: 3, step_name: '천원 받기' },
      });

      await createPartnerProgram(supabase, {
        userId: inviter.id,
        startsAt: isoHoursFromNow(-24),
        endsAt: isoHoursFromNow(24),
      });

      const invitationRes = await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${inviterToken}`)
        .expect(200);

      // 프로그램 내 3명 초대
      for (let i = 0; i < 3; i++) {
        const u = await createTestUser(supabase);
        await insertInvitationUser(supabase, {
          invitationId: invitationRes.body.id,
          userId: u.id,
          createdAt: isoHoursFromNow(-1),
        });
      }

      const response = await request(app.getHttpServer())
        .post('/invitation-step-reward')
        .set('Authorization', `Bearer ${inviterToken}`)
        .send({ stepCount: 3 })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('프로그램 시작 전 10명 + 프로그램 내 3명이면 파트너 3단계 수령 성공', async () => {
      const inviter = await createTestUser(supabase);
      const inviterToken = generateTestToken(inviter.auth_id);

      await createPartnerProgram(supabase, {
        userId: inviter.id,
        startsAt: isoHoursFromNow(-24),
        endsAt: isoHoursFromNow(24),
      });

      const invitationRes = await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${inviterToken}`)
        .expect(200);

      // 프로그램 시작 전 10명 (파트너 카운트에 안 들어감)
      for (let i = 0; i < 10; i++) {
        const u = await createTestUser(supabase);
        await insertInvitationUser(supabase, {
          invitationId: invitationRes.body.id,
          userId: u.id,
          createdAt: isoHoursFromNow(-48),
        });
      }
      // 프로그램 내 3명 (파트너 카운트 기준)
      for (let i = 0; i < 3; i++) {
        const u = await createTestUser(supabase);
        await insertInvitationUser(supabase, {
          invitationId: invitationRes.body.id,
          userId: u.id,
          createdAt: isoHoursFromNow(-1),
        });
      }

      const response = await request(app.getHttpServer())
        .post('/invitation-step-reward')
        .set('Authorization', `Bearer ${inviterToken}`)
        .send({ stepCount: 3 })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('만료된 프로그램 이력이 있어도 일반 유저로서 기존 규칙으로 수령 가능하다', async () => {
      const inviter = await createTestUser(supabase);
      const inviterToken = generateTestToken(inviter.auth_id);

      // 이미 끝난 프로그램
      const programId = await createPartnerProgram(supabase, {
        userId: inviter.id,
        startsAt: isoHoursFromNow(-48),
        endsAt: isoHoursFromNow(-1),
      });

      // 과거 파트너 프로그램에서 3단계 수령한 이력이 있어도
      await supabase.from('point_actions').insert({
        user_id: inviter.id,
        type: 'INVITE_STEP_REWARD',
        status: 'done',
        point_amount: 1000,
        additional_data: {
          step_count: 3,
          step_name: '천원 받기',
          partner_program_id: programId,
        },
      });

      const invitationRes = await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${inviterToken}`)
        .expect(200);

      for (let i = 0; i < 3; i++) {
        const u = await createTestUser(supabase);
        await insertInvitationUser(supabase, {
          invitationId: invitationRes.body.id,
          userId: u.id,
        });
      }

      // 현재는 파트너 아님 → 일반 규칙으로 3단계 수령 가능
      const response = await request(app.getHttpServer())
        .post('/invitation-step-reward')
        .set('Authorization', `Bearer ${inviterToken}`)
        .send({ stepCount: 3 })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('같은 프로그램 내에서 동일 step 중복 수령은 409', async () => {
      const inviter = await createTestUser(supabase);
      const inviterToken = generateTestToken(inviter.auth_id);

      await createPartnerProgram(supabase, {
        userId: inviter.id,
        startsAt: isoHoursFromNow(-24),
        endsAt: isoHoursFromNow(24),
      });

      const invitationRes = await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${inviterToken}`)
        .expect(200);

      for (let i = 0; i < 3; i++) {
        const u = await createTestUser(supabase);
        await insertInvitationUser(supabase, {
          invitationId: invitationRes.body.id,
          userId: u.id,
          createdAt: isoHoursFromNow(-1),
        });
      }

      await request(app.getHttpServer())
        .post('/invitation-step-reward')
        .set('Authorization', `Bearer ${inviterToken}`)
        .send({ stepCount: 3 })
        .expect(201);

      await request(app.getHttpServer())
        .post('/invitation-step-reward')
        .set('Authorization', `Bearer ${inviterToken}`)
        .send({ stepCount: 3 })
        .expect(409);
    });
  });
});
