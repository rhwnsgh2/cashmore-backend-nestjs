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
  updateUserDeviceId,
} from './helpers/invite-code.helper';

describe('Invitation API (e2e)', () => {
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

  describe('GET /invitation', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .get('/invitation')
        .expect(401);

      expect(response.body.message).toBe('No token provided');
    });

    it('초대장이 없으면 새로 생성하여 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const response = await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body.senderId).toBe(testUser.id);
      expect(response.body.type).toBe('normal');
      expect(response.body.status).toBe('pending');
      expect(response.body.identifier).toHaveLength(6);
      expect(response.body).toHaveProperty('createdAt');
    });

    it('이미 초대장이 있으면 동일한 초대장을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const first = await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const second = await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(first.body.id).toBe(second.body.id);
      expect(first.body.identifier).toBe(second.body.identifier);
    });

    it('다른 사용자는 다른 초대장을 받는다', async () => {
      const user1 = await createTestUser(supabase);
      const user2 = await createTestUser(supabase);
      const token1 = generateTestToken(user1.auth_id);
      const token2 = generateTestToken(user2.auth_id);

      const res1 = await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      const res2 = await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${token2}`)
        .expect(200);

      expect(res1.body.id).not.toBe(res2.body.id);
      expect(res1.body.identifier).not.toBe(res2.body.identifier);
      expect(res1.body.senderId).toBe(user1.id);
      expect(res2.body.senderId).toBe(user2.id);
    });

    it('초대 코드는 허용된 문자만 포함한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const response = await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const validChars = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
      expect(response.body.identifier).toMatch(validChars);
    });
  });

  describe('POST /invitation/verify', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .post('/invitation/verify')
        .send({ invitationCode: 'ABC234' })
        .expect(401);

      expect(response.body.message).toBe('No token provided');
    });

    it('유효한 초대 코드이면 success: true를 반환한다', async () => {
      const inviter = await createTestUser(supabase);
      const invitee = await createTestUser(supabase);
      const inviterToken = generateTestToken(inviter.auth_id);
      const inviteeToken = generateTestToken(invitee.auth_id);

      // 초대장 생성
      const invitationRes = await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${inviterToken}`)
        .expect(200);

      // 다른 사용자가 검증
      const response = await request(app.getHttpServer())
        .post('/invitation/verify')
        .set('Authorization', `Bearer ${inviteeToken}`)
        .send({ invitationCode: invitationRes.body.identifier })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.error).toBeUndefined();
    });

    it('본인의 초대 코드이면 success: false를 반환한다', async () => {
      const user = await createTestUser(supabase);
      const token = generateTestToken(user.auth_id);

      // 초대장 생성
      const invitationRes = await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // 본인이 검증
      const response = await request(app.getHttpServer())
        .post('/invitation/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({ invitationCode: invitationRes.body.identifier })
        .expect(201);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe(
        '본인의 초대 코드는 사용할 수 없습니다.',
      );
    });

    it('존재하지 않는 코드이면 success: false를 반환한다', async () => {
      const user = await createTestUser(supabase);
      const token = generateTestToken(user.auth_id);

      const response = await request(app.getHttpServer())
        .post('/invitation/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({ invitationCode: 'ZZZZZZ' })
        .expect(201);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('올바른 초대 코드를 입력해주세요');
    });
  });

  describe('GET /invitation_step_event', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .get('/invitation_step_event')
        .expect(401);

      expect(response.body.message).toBe('No token provided');
    });

    it('초대장이 없으면 404를 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await request(app.getHttpServer())
        .get('/invitation_step_event')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('초대장이 있으면 단계별 이벤트 현황을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      // 초대장 먼저 생성
      await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const response = await request(app.getHttpServer())
        .get('/invitation_step_event')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.invitationCount).toBe(0);
      expect(response.body.receivedRewards).toEqual([]);
      expect(response.body.totalPoints).toBe(0);
      expect(response.body.steps).toHaveLength(4);
      expect(response.body.steps[0]).toEqual({
        count: 3,
        reward: '천원 받기',
        amount: 1000,
      });
    });
  });

  describe('POST /invitation-step-reward', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .post('/invitation-step-reward')
        .send({ stepCount: 3 })
        .expect(401);

      expect(response.body.message).toBe('No token provided');
    });

    it('초대장이 없으면 success: false를 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const response = await request(app.getHttpServer())
        .post('/invitation-step-reward')
        .set('Authorization', `Bearer ${token}`)
        .send({ stepCount: 3 })
        .expect(201);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invitation not found');
    });

    it('초대 수가 부족하면 400을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      // 초대장 생성
      await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      await request(app.getHttpServer())
        .post('/invitation-step-reward')
        .set('Authorization', `Bearer ${token}`)
        .send({ stepCount: 3 })
        .expect(400);
    });

    it('조건을 충족하면 보상을 수령한다', async () => {
      const inviter = await createTestUser(supabase);
      const inviterToken = generateTestToken(inviter.auth_id);

      // 초대장 생성
      const invitationRes = await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${inviterToken}`)
        .expect(200);

      // 초대 유저 3명 추가
      for (let i = 0; i < 3; i++) {
        const invitee = await createTestUser(supabase);
        await supabase.from('invitation_user').insert({
          invitation_id: invitationRes.body.id,
          user_id: invitee.id,
        });
      }

      const response = await request(app.getHttpServer())
        .post('/invitation-step-reward')
        .set('Authorization', `Bearer ${inviterToken}`)
        .send({ stepCount: 3 })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('이미 수령한 보상은 409를 반환한다', async () => {
      const inviter = await createTestUser(supabase);
      const inviterToken = generateTestToken(inviter.auth_id);

      // 초대장 생성
      const invitationRes = await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${inviterToken}`)
        .expect(200);

      // 초대 유저 3명 추가
      for (let i = 0; i < 3; i++) {
        const invitee = await createTestUser(supabase);
        await supabase.from('invitation_user').insert({
          invitation_id: invitationRes.body.id,
          user_id: invitee.id,
        });
      }

      // 첫 번째 수령
      await request(app.getHttpServer())
        .post('/invitation-step-reward')
        .set('Authorization', `Bearer ${inviterToken}`)
        .send({ stepCount: 3 })
        .expect(201);

      // 중복 수령 시도
      await request(app.getHttpServer())
        .post('/invitation-step-reward')
        .set('Authorization', `Bearer ${inviterToken}`)
        .send({ stepCount: 3 })
        .expect(409);
    });
  });

  describe('POST /invitation/lotto-process', () => {
    // 헬퍼: 초대자 생성 + 초대장 생성 + 피초대자 생성 + deviceId 설정
    async function setupInvitationScenario() {
      const inviter = await createTestUser(supabase);
      const invitee = await createTestUser(supabase);
      const inviterToken = generateTestToken(inviter.auth_id);
      const inviteeToken = generateTestToken(invitee.auth_id);
      const deviceId = `device-${Date.now()}`;

      // 피초대자에게 deviceId 설정
      await updateUserDeviceId(supabase, invitee.id, deviceId);

      // 초대장 생성
      const invitationRes = await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${inviterToken}`)
        .expect(200);

      return {
        inviter,
        invitee,
        inviterToken,
        inviteeToken,
        deviceId,
        inviteCode: invitationRes.body.identifier as string,
      };
    }

    it('토큰 없이 요청하면 401을 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .post('/invitation/lotto-process')
        .send({ inviteCode: 'ABC234', deviceId: 'device-1' })
        .expect(401);

      expect(response.body.message).toBe('No token provided');
    });

    // === 성공 케이스 ===

    it('유효한 초대코드로 초대 보상을 처리한다', async () => {
      const { inviteeToken, inviteCode, deviceId } =
        await setupInvitationScenario();

      const response = await request(app.getHttpServer())
        .post('/invitation/lotto-process')
        .set('Authorization', `Bearer ${inviteeToken}`)
        .send({ inviteCode, deviceId })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.rewardPoint).toBeDefined();
      expect([300, 500, 1000, 3000, 50000]).toContain(
        response.body.rewardPoint,
      );
    });

    it('초대 관계(invitation_user)가 생성된다', async () => {
      const { invitee, inviteeToken, inviteCode, deviceId } =
        await setupInvitationScenario();

      await request(app.getHttpServer())
        .post('/invitation/lotto-process')
        .set('Authorization', `Bearer ${inviteeToken}`)
        .send({ inviteCode, deviceId })
        .expect(201);

      // DB에서 직접 확인
      const { data } = await supabase
        .from('invitation_user')
        .select('*')
        .eq('user_id', invitee.id);

      expect(data).toHaveLength(1);
    });

    it('초대자에게 INVITE_REWARD 300P가 지급된다', async () => {
      const { inviter, inviteeToken, inviteCode, deviceId } =
        await setupInvitationScenario();

      await request(app.getHttpServer())
        .post('/invitation/lotto-process')
        .set('Authorization', `Bearer ${inviteeToken}`)
        .send({ inviteCode, deviceId })
        .expect(201);

      const { data } = await supabase
        .from('point_actions')
        .select('*')
        .eq('user_id', inviter.id)
        .eq('type', 'INVITE_REWARD');

      expect(data).toHaveLength(1);
      expect(data![0].point_amount).toBe(300);
    });

    it('피초대자에게 INVITED_USER_REWARD_RANDOM 포인트가 지급된다', async () => {
      const { invitee, inviteeToken, inviteCode, deviceId } =
        await setupInvitationScenario();

      await request(app.getHttpServer())
        .post('/invitation/lotto-process')
        .set('Authorization', `Bearer ${inviteeToken}`)
        .send({ inviteCode, deviceId })
        .expect(201);

      const { data } = await supabase
        .from('point_actions')
        .select('*')
        .eq('user_id', invitee.id)
        .eq('type', 'INVITED_USER_REWARD_RANDOM');

      expect(data).toHaveLength(1);
      expect([300, 500, 1000, 3000, 50000]).toContain(data![0].point_amount);
    });

    it('피초대자 디바이스에 invitation_reward 이벤트가 기록된다', async () => {
      const { inviteeToken, inviteCode, deviceId } =
        await setupInvitationScenario();

      await request(app.getHttpServer())
        .post('/invitation/lotto-process')
        .set('Authorization', `Bearer ${inviteeToken}`)
        .send({ inviteCode, deviceId })
        .expect(201);

      const { data } = await supabase
        .from('device_event_participation')
        .select('*')
        .eq('device_id', deviceId)
        .eq('event_name', 'invitation_reward');

      expect(data).toHaveLength(1);
    });

    it('초대자에게 invite_reward_received 모달이 생성된다', async () => {
      const { inviter, inviteeToken, inviteCode, deviceId } =
        await setupInvitationScenario();

      await request(app.getHttpServer())
        .post('/invitation/lotto-process')
        .set('Authorization', `Bearer ${inviteeToken}`)
        .send({ inviteCode, deviceId })
        .expect(201);

      const { data } = await supabase
        .from('modal_shown')
        .select('*')
        .eq('user_id', inviter.id)
        .eq('name', 'invite_reward_received');

      expect(data).toHaveLength(1);
    });

    // === 실패 케이스: 초대코드 검증 ===

    it('존재하지 않는 초대코드이면 실패한다', async () => {
      const { inviteeToken, deviceId } = await setupInvitationScenario();

      const response = await request(app.getHttpServer())
        .post('/invitation/lotto-process')
        .set('Authorization', `Bearer ${inviteeToken}`)
        .send({ inviteCode: 'ZZZZZZ', deviceId })
        .expect(201);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('본인의 초대코드이면 실패한다', async () => {
      const { inviterToken, inviteCode, deviceId } =
        await setupInvitationScenario();

      // 초대자 본인이 자기 코드로 보상 요청
      const response = await request(app.getHttpServer())
        .post('/invitation/lotto-process')
        .set('Authorization', `Bearer ${inviterToken}`)
        .send({ inviteCode, deviceId })
        .expect(201);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('본인');
    });

    it('invitation type이 normal이 아니면 실패한다', async () => {
      const invitee = await createTestUser(supabase);
      const inviteeToken = generateTestToken(invitee.auth_id);
      const deviceId = `device-${Date.now()}`;
      await updateUserDeviceId(supabase, invitee.id, deviceId);

      // default 타입 초대장을 직접 DB에 생성
      const sender = await createTestUser(supabase);
      const { data: defaultInvitation } = await supabase
        .from('invitation')
        .insert({
          sender_id: sender.id,
          identifier: 'DEFAUL',
          type: 'default',
          status: 'pending',
        })
        .select()
        .single();

      const response = await request(app.getHttpServer())
        .post('/invitation/lotto-process')
        .set('Authorization', `Bearer ${inviteeToken}`)
        .send({ inviteCode: defaultInvitation!.identifier, deviceId })
        .expect(201);

      expect(response.body.success).toBe(false);
    });

    // === 실패 케이스: 중복 보상 방지 ===

    it('이미 invitation_reward를 받은 디바이스면 실패한다', async () => {
      const { inviteeToken, inviteCode, deviceId } =
        await setupInvitationScenario();

      // 이미 다른 초대를 통해 보상을 받은 디바이스
      await createDeviceEventParticipation(supabase, {
        device_id: deviceId,
        event_name: 'invitation_reward',
      });

      const response = await request(app.getHttpServer())
        .post('/invitation/lotto-process')
        .set('Authorization', `Bearer ${inviteeToken}`)
        .send({ inviteCode, deviceId })
        .expect(201);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('이미');
    });

    it('동일한 보상 처리를 다시 호출하면 실패한다', async () => {
      const { inviteeToken, inviteCode, deviceId } =
        await setupInvitationScenario();

      // 첫 번째 성공
      const first = await request(app.getHttpServer())
        .post('/invitation/lotto-process')
        .set('Authorization', `Bearer ${inviteeToken}`)
        .send({ inviteCode, deviceId })
        .expect(201);

      expect(first.body.success).toBe(true);

      // 두 번째 실패
      const second = await request(app.getHttpServer())
        .post('/invitation/lotto-process')
        .set('Authorization', `Bearer ${inviteeToken}`)
        .send({ inviteCode, deviceId })
        .expect(201);

      expect(second.body.success).toBe(false);
    });

    // === 실패 케이스: 가입 시간 제한 ===

    it('가입 후 24시간이 초과한 유저는 실패한다', async () => {
      const inviter = await createTestUser(supabase);
      const inviterToken = generateTestToken(inviter.auth_id);
      const deviceId = `device-${Date.now()}`;

      // 초대장 생성
      const invitationRes = await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${inviterToken}`)
        .expect(200);

      // 피초대자를 먼저 생성한 뒤, created_at을 25시간 전으로 수정
      const invitee = await createTestUser(supabase);
      const inviteeToken = generateTestToken(invitee.auth_id);
      await updateUserDeviceId(supabase, invitee.id, deviceId);

      const twentyFiveHoursAgo = new Date(
        Date.now() - 25 * 60 * 60 * 1000,
      ).toISOString();
      await supabase
        .from('user')
        .update({ created_at: twentyFiveHoursAgo })
        .eq('id', invitee.id);

      const response = await request(app.getHttpServer())
        .post('/invitation/lotto-process')
        .set('Authorization', `Bearer ${inviteeToken}`)
        .send({
          inviteCode: invitationRes.body.identifier,
          deviceId,
        })
        .expect(201);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('24시간');
    });

    it('가입 후 24시간 이내인 유저는 보상을 받을 수 있다', async () => {
      const inviter = await createTestUser(supabase);
      const inviterToken = generateTestToken(inviter.auth_id);
      const deviceId = `device-${Date.now()}`;

      // 초대장 생성
      const invitationRes = await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${inviterToken}`)
        .expect(200);

      // 피초대자를 먼저 생성한 뒤, created_at을 23시간 전으로 수정
      const invitee = await createTestUser(supabase);
      const inviteeToken = generateTestToken(invitee.auth_id);
      await updateUserDeviceId(supabase, invitee.id, deviceId);

      const twentyThreeHoursAgo = new Date(
        Date.now() - 23 * 60 * 60 * 1000,
      ).toISOString();
      await supabase
        .from('user')
        .update({ created_at: twentyThreeHoursAgo })
        .eq('id', invitee.id);

      const response = await request(app.getHttpServer())
        .post('/invitation/lotto-process')
        .set('Authorization', `Bearer ${inviteeToken}`)
        .send({
          inviteCode: invitationRes.body.identifier,
          deviceId,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    // === 중복 보상 방지: 같은 유저가 다른 디바이스로 재시도 ===

    it('이미 초대 보상을 받은 유저가 다른 디바이스로 재시도하면 실패한다', async () => {
      const { invitee, inviteeToken, inviteCode, deviceId } =
        await setupInvitationScenario();

      // 첫 번째 성공
      const first = await request(app.getHttpServer())
        .post('/invitation/lotto-process')
        .set('Authorization', `Bearer ${inviteeToken}`)
        .send({ inviteCode, deviceId })
        .expect(201);

      expect(first.body.success).toBe(true);

      // 다른 디바이스로 변경 후 재시도
      const newDeviceId = `device-new-${Date.now()}`;
      await updateUserDeviceId(supabase, invitee.id, newDeviceId);

      const second = await request(app.getHttpServer())
        .post('/invitation/lotto-process')
        .set('Authorization', `Bearer ${inviteeToken}`)
        .send({ inviteCode, deviceId: newDeviceId })
        .expect(201);

      expect(second.body.success).toBe(false);
    });

    // === 데이터 무결성 검증 ===

    it('초대자 INVITE_REWARD의 additional_data에 피초대자 정보가 포함된다', async () => {
      const { inviter, invitee, inviteeToken, inviteCode, deviceId } =
        await setupInvitationScenario();

      await request(app.getHttpServer())
        .post('/invitation/lotto-process')
        .set('Authorization', `Bearer ${inviteeToken}`)
        .send({ inviteCode, deviceId })
        .expect(201);

      const { data } = await supabase
        .from('point_actions')
        .select('*')
        .eq('user_id', inviter.id)
        .eq('type', 'INVITE_REWARD')
        .single();

      expect(data!.additional_data).toBeDefined();
      expect(data!.additional_data.invited_user_id).toBe(invitee.id);
    });

    it('invite_reward_received 모달에 rewardAmount가 포함된다', async () => {
      const { inviter, inviteeToken, inviteCode, deviceId } =
        await setupInvitationScenario();

      await request(app.getHttpServer())
        .post('/invitation/lotto-process')
        .set('Authorization', `Bearer ${inviteeToken}`)
        .send({ inviteCode, deviceId })
        .expect(201);

      const { data } = await supabase
        .from('modal_shown')
        .select('*')
        .eq('user_id', inviter.id)
        .eq('name', 'invite_reward_received')
        .single();

      expect(data!.additional_data).toBeDefined();
      expect(data!.additional_data.rewardAmount).toBe(300);
    });

    // === 엣지 케이스 ===

    it('deviceId가 요청에도 DB에도 없으면 실패한다', async () => {
      // device_id가 없는 피초대자 생성 (setupInvitationScenario 사용 안 함)
      const inviter = await createTestUser(supabase);
      const inviterToken = generateTestToken(inviter.auth_id);
      const noDeviceUser = await createTestUser(supabase);
      const noDeviceToken = generateTestToken(noDeviceUser.auth_id);

      // 초대장 생성
      const invitationRes = await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${inviterToken}`)
        .expect(200);

      // deviceId 없이 호출 (DB에도 device_id 없음)
      const response = await request(app.getHttpServer())
        .post('/invitation/lotto-process')
        .set('Authorization', `Bearer ${noDeviceToken}`)
        .send({ inviteCode: invitationRes.body.identifier })
        .expect(201);

      expect(response.body.success).toBe(false);
    });

    it('서로 다른 피초대자는 같은 초대코드로 각각 보상을 받을 수 있다', async () => {
      const { inviter, inviteCode } = await setupInvitationScenario();

      // 피초대자 A
      const inviteeA = await createTestUser(supabase);
      const tokenA = generateTestToken(inviteeA.auth_id);
      const deviceA = `device-a-${Date.now()}`;
      await updateUserDeviceId(supabase, inviteeA.id, deviceA);

      // 피초대자 B
      const inviteeB = await createTestUser(supabase);
      const tokenB = generateTestToken(inviteeB.auth_id);
      const deviceB = `device-b-${Date.now()}`;
      await updateUserDeviceId(supabase, inviteeB.id, deviceB);

      const resA = await request(app.getHttpServer())
        .post('/invitation/lotto-process')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ inviteCode, deviceId: deviceA })
        .expect(201);

      const resB = await request(app.getHttpServer())
        .post('/invitation/lotto-process')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ inviteCode, deviceId: deviceB })
        .expect(201);

      expect(resA.body.success).toBe(true);
      expect(resB.body.success).toBe(true);

      // 초대자에게 INVITE_REWARD가 2건 지급
      const { data } = await supabase
        .from('point_actions')
        .select('*')
        .eq('user_id', inviter.id)
        .eq('type', 'INVITE_REWARD');

      expect(data).toHaveLength(2);
    });
  });
});
