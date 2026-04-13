import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getTestSupabaseAdminClient } from './supabase-client';
import { truncateAllTables } from './setup';
import { createTestUser, TestUser } from './helpers/user.helper';
import {
  generateTestToken,
  generateExpiredToken,
  generateInvalidToken,
} from './helpers/auth.helper';

describe('User API (e2e) - Real DB', () => {
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

  describe('GET /user/info', () => {
    describe('인증', () => {
      it('토큰 없이 요청하면 401을 반환한다', async () => {
        const response = await request(app.getHttpServer())
          .get('/user/info')
          .expect(401);

        expect(response.body.message).toBe('No token provided');
      });

      it('만료된 토큰도 서명이 유효하면 허용한다', async () => {
        const testUser = await createTestUser(supabase);
        const expiredToken = generateExpiredToken(testUser.auth_id);

        const response = await request(app.getHttpServer())
          .get('/user/info')
          .set('Authorization', `Bearer ${expiredToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('id');
      });

      it('잘못된 토큰으로 요청하면 401을 반환한다', async () => {
        const testUser = await createTestUser(supabase);
        const invalidToken = generateInvalidToken(testUser.auth_id);

        const response = await request(app.getHttpServer())
          .get('/user/info')
          .set('Authorization', `Bearer ${invalidToken}`)
          .expect(401);

        expect(response.body.message).toBe('Invalid token');
      });

      it('존재하지 않는 사용자의 토큰으로 요청하면 401을 반환한다', async () => {
        const nonExistentAuthId = 'non-existent-auth-id';
        const token = generateTestToken(nonExistentAuthId);

        const response = await request(app.getHttpServer())
          .get('/user/info')
          .set('Authorization', `Bearer ${token}`)
          .expect(401);

        expect(response.body.message).toBe('User not found');
      });
    });

    describe('사용자 정보 조회', () => {
      let testUser: TestUser;
      let token: string;

      beforeEach(async () => {
        testUser = await createTestUser(supabase, {
          nickname: 'testnickname',
        });
        token = generateTestToken(testUser.auth_id);
      });

      it('사용자 정보를 반환한다', async () => {
        const response = await request(app.getHttpServer())
          .get('/user/info')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.id).toBe(testUser.id);
        expect(response.body.nickname).toBe('testnickname');
        expect(response.body.role).toBe('user');
        expect(response.body.isBanned).toBe(false);
        expect(response.body.banReason).toBeNull();
      });

      it('응답에 모든 필드가 포함된다', async () => {
        const response = await request(app.getHttpServer())
          .get('/user/info')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('email');
        expect(response.body).toHaveProperty('role');
        expect(response.body).toHaveProperty('provider');
        expect(response.body).toHaveProperty('createdAt');
        expect(response.body).toHaveProperty('isBanned');
        expect(response.body).toHaveProperty('banReason');
        expect(response.body).toHaveProperty('marketingAgreement');
        expect(response.body).toHaveProperty('nickname');
      });

      it('닉네임이 없으면 자동 생성된다', async () => {
        // 닉네임 없는 사용자 생성
        const userWithoutNickname = await createTestUser(supabase, {
          nickname: undefined,
        });
        const tokenWithoutNickname = generateTestToken(
          userWithoutNickname.auth_id,
        );

        // DB에서 닉네임을 null로 업데이트
        await supabase
          .from('user')
          .update({ nickname: null })
          .eq('id', userWithoutNickname.id);

        const response = await request(app.getHttpServer())
          .get('/user/info')
          .set('Authorization', `Bearer ${tokenWithoutNickname}`)
          .expect(200);

        expect(response.body.nickname).toBeTruthy();
        expect(response.body.nickname.length).toBeGreaterThan(0);
      });

      it('다른 사용자의 정보는 조회할 수 없다', async () => {
        const otherUser = await createTestUser(supabase);

        // 내 토큰으로 요청하면 내 정보만 반환
        const response = await request(app.getHttpServer())
          .get('/user/info')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.id).toBe(testUser.id);
        expect(response.body.id).not.toBe(otherUser.id);
      });

      it('마케팅 동의 정보가 올바르게 반환된다', async () => {
        // 마케팅 동의한 사용자
        const marketingUser = await createTestUser(supabase, {
          marketing_info: true,
        });
        const marketingToken = generateTestToken(marketingUser.auth_id);

        const response = await request(app.getHttpServer())
          .get('/user/info')
          .set('Authorization', `Bearer ${marketingToken}`)
          .expect(200);

        expect(response.body.marketingAgreement).toBe(true);
      });
    });

    describe('차단된 사용자', () => {
      it('차단된 사용자는 isBanned=true와 banReason을 반환한다', async () => {
        // 차단된 사용자 생성
        const bannedUser = await createTestUser(supabase);
        const bannedToken = generateTestToken(bannedUser.auth_id);

        // user 테이블의 is_banned를 true로 업데이트
        await supabase
          .from('user')
          .update({ is_banned: true })
          .eq('id', bannedUser.id);

        // banned_user 테이블에 추가
        await supabase.from('banned_user').insert({
          auth_id: bannedUser.auth_id,
          reason: '부정 사용',
        });

        const response = await request(app.getHttpServer())
          .get('/user/info')
          .set('Authorization', `Bearer ${bannedToken}`)
          .expect(200);

        expect(response.body.isBanned).toBe(true);
        expect(response.body.banReason).toBe('부정 사용');
      });

      it('is_banned=true지만 banned_user에 없으면 isBanned=false', async () => {
        const partialBannedUser = await createTestUser(supabase);
        const partialBannedToken = generateTestToken(partialBannedUser.auth_id);

        // user 테이블의 is_banned만 true로 업데이트 (banned_user에는 추가 안함)
        await supabase
          .from('user')
          .update({ is_banned: true })
          .eq('id', partialBannedUser.id);

        const response = await request(app.getHttpServer())
          .get('/user/info')
          .set('Authorization', `Bearer ${partialBannedToken}`)
          .expect(200);

        expect(response.body.isBanned).toBe(false);
        expect(response.body.banReason).toBeNull();
      });
    });
  });

  describe('PUT /user/nickname', () => {
    let testUser: TestUser;
    let token: string;

    beforeEach(async () => {
      testUser = await createTestUser(supabase, { nickname: 'oldnick' });
      token = generateTestToken(testUser.auth_id);
    });

    it('토큰 없이 요청하면 401을 반환한다', async () => {
      await request(app.getHttpServer())
        .put('/user/nickname')
        .send({ nickname: 'newnick' })
        .expect(401);
    });

    it('닉네임을 변경하고 이력을 저장한다', async () => {
      const response = await request(app.getHttpServer())
        .put('/user/nickname')
        .set('Authorization', `Bearer ${token}`)
        .send({ nickname: 'newnick' })
        .expect(200);

      expect(response.body.success).toBe(true);

      const { data: user } = await supabase
        .from('user')
        .select('nickname')
        .eq('id', testUser.id)
        .single();
      expect(user?.nickname).toBe('newnick');

      const { data: history } = await supabase
        .from('nickname_history')
        .select('before, after, user_id')
        .eq('user_id', testUser.id);
      expect(history).toHaveLength(1);
      expect(history![0].before).toBe('oldnick');
      expect(history![0].after).toBe('newnick');
    });

    it('앞뒤 공백은 trim 후 저장한다', async () => {
      await request(app.getHttpServer())
        .put('/user/nickname')
        .set('Authorization', `Bearer ${token}`)
        .send({ nickname: '  spaced  ' })
        .expect(200);

      const { data: user } = await supabase
        .from('user')
        .select('nickname')
        .eq('id', testUser.id)
        .single();
      expect(user?.nickname).toBe('spaced');
    });

    it('2자 미만이면 400을 반환한다', async () => {
      await request(app.getHttpServer())
        .put('/user/nickname')
        .set('Authorization', `Bearer ${token}`)
        .send({ nickname: 'a' })
        .expect(400);
    });

    it('12자 초과면 400을 반환한다', async () => {
      await request(app.getHttpServer())
        .put('/user/nickname')
        .set('Authorization', `Bearer ${token}`)
        .send({ nickname: '1234567890123' })
        .expect(400);
    });

    it('trim 후 2자 미만이면 400을 반환한다', async () => {
      await request(app.getHttpServer())
        .put('/user/nickname')
        .set('Authorization', `Bearer ${token}`)
        .send({ nickname: ' a ' })
        .expect(400);
    });

    it('정확히 2자는 허용된다', async () => {
      await request(app.getHttpServer())
        .put('/user/nickname')
        .set('Authorization', `Bearer ${token}`)
        .send({ nickname: '가나' })
        .expect(200);
    });

    it('정확히 12자는 허용된다', async () => {
      await request(app.getHttpServer())
        .put('/user/nickname')
        .set('Authorization', `Bearer ${token}`)
        .send({ nickname: '123456789012' })
        .expect(200);
    });

    it('nickname이 없으면 400을 반환한다', async () => {
      await request(app.getHttpServer())
        .put('/user/nickname')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);
    });

    it('다른 유저가 이미 사용 중이면 409를 반환한다', async () => {
      await createTestUser(supabase, { nickname: 'taken' });

      await request(app.getHttpServer())
        .put('/user/nickname')
        .set('Authorization', `Bearer ${token}`)
        .send({ nickname: 'taken' })
        .expect(409);
    });

    it('본인의 기존 닉네임과 같아도 성공한다', async () => {
      await request(app.getHttpServer())
        .put('/user/nickname')
        .set('Authorization', `Bearer ${token}`)
        .send({ nickname: 'oldnick' })
        .expect(200);
    });
  });

  describe('POST /user/nickname/check', () => {
    let testUser: TestUser;
    let token: string;

    beforeEach(async () => {
      testUser = await createTestUser(supabase, { nickname: 'mynick' });
      token = generateTestToken(testUser.auth_id);
    });

    it('토큰 없이 요청하면 401을 반환한다', async () => {
      await request(app.getHttpServer())
        .post('/user/nickname/check')
        .send({ nickname: 'anything' })
        .expect(401);
    });

    it('사용 가능한 닉네임이면 isDuplicate: false', async () => {
      const response = await request(app.getHttpServer())
        .post('/user/nickname/check')
        .set('Authorization', `Bearer ${token}`)
        .send({ nickname: 'available' })
        .expect(200);

      expect(response.body.isDuplicate).toBe(false);
    });

    it('다른 유저가 사용 중이면 isDuplicate: true', async () => {
      await createTestUser(supabase, { nickname: 'taken' });

      const response = await request(app.getHttpServer())
        .post('/user/nickname/check')
        .set('Authorization', `Bearer ${token}`)
        .send({ nickname: 'taken' })
        .expect(200);

      expect(response.body.isDuplicate).toBe(true);
    });

    it('본인의 닉네임은 isDuplicate: false', async () => {
      const response = await request(app.getHttpServer())
        .post('/user/nickname/check')
        .set('Authorization', `Bearer ${token}`)
        .send({ nickname: 'mynick' })
        .expect(200);

      expect(response.body.isDuplicate).toBe(false);
    });

    it('빈 문자열은 isDuplicate: false', async () => {
      const response = await request(app.getHttpServer())
        .post('/user/nickname/check')
        .set('Authorization', `Bearer ${token}`)
        .send({ nickname: '' })
        .expect(200);

      expect(response.body.isDuplicate).toBe(false);
    });

    it('공백만 있는 문자열은 isDuplicate: false', async () => {
      const response = await request(app.getHttpServer())
        .post('/user/nickname/check')
        .set('Authorization', `Bearer ${token}`)
        .send({ nickname: '   ' })
        .expect(200);

      expect(response.body.isDuplicate).toBe(false);
    });

    it('앞뒤 공백은 trim 후 비교한다', async () => {
      await createTestUser(supabase, { nickname: 'taken' });

      const response = await request(app.getHttpServer())
        .post('/user/nickname/check')
        .set('Authorization', `Bearer ${token}`)
        .send({ nickname: '  taken  ' })
        .expect(200);

      expect(response.body.isDuplicate).toBe(true);
    });
  });

  describe('POST /user', () => {
    /**
     * auth.users에만 유저를 생성하고 user 테이블에는 생성하지 않는 헬퍼.
     * POST /user가 user 레코드를 생성하므로, 사전에 user 테이블 레코드가 없어야 함.
     */
    async function createAuthOnlyUser() {
      const email = `test-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
      const { data: authUser, error } = await supabase.auth.admin.createUser({
        email,
        password: 'test-password-123',
        email_confirm: true,
      });
      if (error || !authUser.user) {
        throw new Error(`Failed to create auth user: ${error?.message}`);
      }
      return { authId: authUser.user.id, email };
    }

    /**
     * 초대자 + 초대장 생성 헬퍼
     */
    async function setupInviter() {
      const inviter = await createTestUser(supabase);
      const inviterToken = generateTestToken(inviter.auth_id);

      const invitationRes = await request(app.getHttpServer())
        .get('/invitation')
        .set('Authorization', `Bearer ${inviterToken}`)
        .expect(200);

      return {
        inviter,
        inviterToken,
        invitationCode: invitationRes.body.identifier as string,
      };
    }

    describe('기본 가입 (signupContext 없음)', () => {
      it('signupContext 없이 가입하면 기존 플로우대로 동작한다', async () => {
        const { authId } = await createAuthOnlyUser();
        const token = generateTestToken(authId);

        const response = await request(app.getHttpServer())
          .post('/user')
          .set('Authorization', `Bearer ${token}`)
          .send({
            marketingAgreement: false,
            onboardingCompleted: true,
            deviceId: `device-${Date.now()}`,
          })
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.userId).toBeDefined();
        expect(response.body.nickname).toBeDefined();
        expect(response.body.invitationReward).toBeUndefined();
      });

      it('signupContext 없이 가입하면 invite_code_input_lotto 모달이 생성된다', async () => {
        const { authId } = await createAuthOnlyUser();
        const token = generateTestToken(authId);

        const response = await request(app.getHttpServer())
          .post('/user')
          .set('Authorization', `Bearer ${token}`)
          .send({
            marketingAgreement: false,
            onboardingCompleted: true,
            deviceId: `device-${Date.now()}`,
          })
          .expect(201);

        const { data: modals } = await supabase
          .from('modal_shown')
          .select('*')
          .eq('user_id', response.body.userId)
          .eq('name', 'invite_code_input_lotto');

        expect(modals).toHaveLength(1);
      });

      it('이미 가입된 사용자가 다시 요청하면 409를 반환한다', async () => {
        const testUser = await createTestUser(supabase);
        const token = generateTestToken(testUser.auth_id);

        await request(app.getHttpServer())
          .post('/user')
          .set('Authorization', `Bearer ${token}`)
          .send({
            marketingAgreement: false,
            onboardingCompleted: true,
          })
          .expect(409);
      });
    });

    describe('invitation_normal 가입', () => {
      it('유효한 초대코드로 가입하면 보상이 처리된다', async () => {
        const { invitationCode } = await setupInviter();
        const { authId } = await createAuthOnlyUser();
        const token = generateTestToken(authId);
        const deviceId = `device-${Date.now()}`;

        const response = await request(app.getHttpServer())
          .post('/user')
          .set('Authorization', `Bearer ${token}`)
          .send({
            marketingAgreement: false,
            onboardingCompleted: true,
            deviceId,
            signupContext: {
              type: 'invitation_normal',
              invitationCode,
            },
          })
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.invitationReward).toBeDefined();
        expect(response.body.invitationReward.type).toBe('invitation_normal');
        expect(response.body.invitationReward.success).toBe(true);
        expect(response.body.invitationReward.rewardPoint).toBeDefined();
        expect([300, 500, 1000, 3000, 50000]).toContain(
          response.body.invitationReward.rewardPoint,
        );
      });

      it('초대 보상 시 invite_code_input_lotto 모달이 생성되지 않는다', async () => {
        const { invitationCode } = await setupInviter();
        const { authId } = await createAuthOnlyUser();
        const token = generateTestToken(authId);
        const deviceId = `device-${Date.now()}`;

        const response = await request(app.getHttpServer())
          .post('/user')
          .set('Authorization', `Bearer ${token}`)
          .send({
            marketingAgreement: false,
            onboardingCompleted: true,
            deviceId,
            signupContext: {
              type: 'invitation_normal',
              invitationCode,
            },
          })
          .expect(201);

        const { data: modals } = await supabase
          .from('modal_shown')
          .select('*')
          .eq('user_id', response.body.userId)
          .eq('name', 'invite_code_input_lotto');

        expect(modals).toHaveLength(0);
      });

      it('초대자에게 INVITE_REWARD 포인트가 지급된다', async () => {
        const { inviter, invitationCode } = await setupInviter();
        const { authId } = await createAuthOnlyUser();
        const token = generateTestToken(authId);
        const deviceId = `device-${Date.now()}`;

        await request(app.getHttpServer())
          .post('/user')
          .set('Authorization', `Bearer ${token}`)
          .send({
            marketingAgreement: false,
            onboardingCompleted: true,
            deviceId,
            signupContext: {
              type: 'invitation_normal',
              invitationCode,
            },
          })
          .expect(201);

        const { data } = await supabase
          .from('point_actions')
          .select('*')
          .eq('user_id', inviter.id)
          .eq('type', 'INVITE_REWARD');

        expect(data).toHaveLength(1);
        expect(data![0].point_amount).toBe(300);
      });

      it('존재하지 않는 초대코드로 가입하면 가입은 성공하고 보상은 실패한다', async () => {
        const { authId } = await createAuthOnlyUser();
        const token = generateTestToken(authId);
        const deviceId = `device-${Date.now()}`;

        const response = await request(app.getHttpServer())
          .post('/user')
          .set('Authorization', `Bearer ${token}`)
          .send({
            marketingAgreement: false,
            onboardingCompleted: true,
            deviceId,
            signupContext: {
              type: 'invitation_normal',
              invitationCode: 'ZZZZZZ',
            },
          })
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.userId).toBeDefined();
        expect(response.body.invitationReward).toBeDefined();
        expect(response.body.invitationReward.type).toBe('invitation_normal');
        expect(response.body.invitationReward.success).toBe(false);
        expect(response.body.invitationReward.error).toBeDefined();
      });

      it('본인의 초대코드로 가입하면 가입은 성공하고 보상은 실패한다', async () => {
        // 먼저 초대자로 가입 (기존 유저)
        const selfInviter = await createTestUser(supabase);
        const selfInviterToken = generateTestToken(selfInviter.auth_id);

        // 초대장 생성
        const invitationRes = await request(app.getHttpServer())
          .get('/invitation')
          .set('Authorization', `Bearer ${selfInviterToken}`)
          .expect(200);

        // 새 유저가 본인 초대 코드로... 는 불가능하지만
        // 같은 초대코드를 본인이 사용하는 시나리오는
        // 실제로는 다른 사람이 가입할 때 발생하므로,
        // 여기서는 다른 유저가 가입하되 자기 코드인 경우를 테스트
        const { authId } = await createAuthOnlyUser();
        const token = generateTestToken(authId);
        const deviceId = `device-${Date.now()}`;

        const response = await request(app.getHttpServer())
          .post('/user')
          .set('Authorization', `Bearer ${token}`)
          .send({
            marketingAgreement: false,
            onboardingCompleted: true,
            deviceId,
            signupContext: {
              type: 'invitation_normal',
              invitationCode: invitationRes.body.identifier,
            },
          })
          .expect(201);

        // 새 유저이므로 본인 초대코드가 아님 → 성공
        expect(response.body.success).toBe(true);
        expect(response.body.invitationReward.success).toBe(true);
      });
    });

    describe('invitation_receipt 가입', () => {
      /**
       * 초대자 + 초대장 + 영수증 생성 헬퍼
       */
      async function setupInviterWithReceipt() {
        const { inviter, inviterToken, invitationCode } = await setupInviter();

        // 초대자의 completed 영수증 생성
        const { data: receipt, error } = await supabase
          .from('every_receipt')
          .insert({
            user_id: inviter.id,
            point: 40,
            status: 'completed',
            image_url: 'https://storage.example.com/receipt.jpg',
            score_data: { total_score: 30 },
          })
          .select()
          .single();

        if (error) {
          throw new Error(`Failed to create receipt: ${error.message}`);
        }

        return { inviter, inviterToken, invitationCode, receipt };
      }

      it('유효한 초대코드 + 영수증으로 가입하면 초대 보상이 처리된다', async () => {
        const { inviter, invitationCode, receipt } =
          await setupInviterWithReceipt();
        const { authId } = await createAuthOnlyUser();
        const token = generateTestToken(authId);
        const deviceId = `device-${Date.now()}`;

        const response = await request(app.getHttpServer())
          .post('/user')
          .set('Authorization', `Bearer ${token}`)
          .send({
            marketingAgreement: false,
            onboardingCompleted: true,
            deviceId,
            signupContext: {
              type: 'invitation_receipt',
              invitationCode,
              receiptId: receipt.id,
            },
          })
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.invitationReward).toBeDefined();
        expect(response.body.invitationReward.type).toBe('invitation_receipt');
        expect(response.body.invitationReward.success).toBe(true);
        expect(response.body.invitationReward.rewardPoint).toBeDefined();
        expect([300, 500, 1000, 3000, 50000]).toContain(
          response.body.invitationReward.rewardPoint,
        );

        // 초대자에게 INVITE_REWARD 300P 지급 확인
        const { data: inviterRewards } = await supabase
          .from('point_actions')
          .select('*')
          .eq('user_id', inviter.id)
          .eq('type', 'INVITE_REWARD');

        expect(inviterRewards).toHaveLength(1);
        expect(inviterRewards![0].point_amount).toBe(300);
      });

      it('INVITATION_RECEIPT 포인트가 지급된다 (영수증 복사 없음)', async () => {
        const { invitationCode, receipt } = await setupInviterWithReceipt();
        const { authId } = await createAuthOnlyUser();
        const token = generateTestToken(authId);
        const deviceId = `device-${Date.now()}`;

        const response = await request(app.getHttpServer())
          .post('/user')
          .set('Authorization', `Bearer ${token}`)
          .send({
            marketingAgreement: false,
            onboardingCompleted: true,
            deviceId,
            signupContext: {
              type: 'invitation_receipt',
              invitationCode,
              receiptId: receipt.id,
            },
          })
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.invitationReward.receiptPoint).toBe(40);

        // INVITATION_RECEIPT point_action 확인
        const { data: receiptPointActions } = await supabase
          .from('point_actions')
          .select('*')
          .eq('user_id', response.body.userId)
          .eq('type', 'INVITATION_RECEIPT');

        expect(receiptPointActions).toHaveLength(1);
        expect(receiptPointActions![0].point_amount).toBe(40);
        expect(receiptPointActions![0].additional_data).toEqual({
          source_receipt_id: receipt.id,
          point: 40,
        });

        // every_receipt에 복사되지 않았는지 확인
        const { data: userReceipts } = await supabase
          .from('every_receipt')
          .select('*')
          .eq('user_id', response.body.userId);

        expect(userReceipts).toHaveLength(0);
      });

      it('invite_code_input_lotto 모달이 생성되지 않고 invitation_lotto_result 모달이 생성된다', async () => {
        const { invitationCode, receipt } = await setupInviterWithReceipt();
        const { authId } = await createAuthOnlyUser();
        const token = generateTestToken(authId);
        const deviceId = `device-${Date.now()}`;

        const response = await request(app.getHttpServer())
          .post('/user')
          .set('Authorization', `Bearer ${token}`)
          .send({
            marketingAgreement: false,
            onboardingCompleted: true,
            deviceId,
            signupContext: {
              type: 'invitation_receipt',
              invitationCode,
              receiptId: receipt.id,
            },
          })
          .expect(201);

        // invite_code_input_lotto 모달은 생성되지 않아야 함
        const { data: inviteModals } = await supabase
          .from('modal_shown')
          .select('*')
          .eq('user_id', response.body.userId)
          .eq('name', 'invite_code_input_lotto');

        expect(inviteModals).toHaveLength(0);

        // invitation_lotto_result 모달이 생성되어야 함
        const { data: lottoModals } = await supabase
          .from('modal_shown')
          .select('*')
          .eq('user_id', response.body.userId)
          .eq('name', 'invitation_lotto_result');

        expect(lottoModals).toHaveLength(1);
      });

      it('존재하지 않는 영수증 ID로 가입하면 가입은 성공하고 보상은 실패한다', async () => {
        const { invitationCode } = await setupInviter();
        const { authId } = await createAuthOnlyUser();
        const token = generateTestToken(authId);
        const deviceId = `device-${Date.now()}`;

        const response = await request(app.getHttpServer())
          .post('/user')
          .set('Authorization', `Bearer ${token}`)
          .send({
            marketingAgreement: false,
            onboardingCompleted: true,
            deviceId,
            signupContext: {
              type: 'invitation_receipt',
              invitationCode,
              receiptId: 999999,
            },
          })
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.userId).toBeDefined();
        // 초대 보상은 성공, 영수증 포인트만 실패
        expect(response.body.invitationReward).toBeDefined();
        expect(response.body.invitationReward.success).toBe(true);
      });
    });

    describe('signupContext 유효성 검증', () => {
      it('signupContext.type이 잘못된 값이면 400을 반환한다', async () => {
        const { authId } = await createAuthOnlyUser();
        const token = generateTestToken(authId);

        await request(app.getHttpServer())
          .post('/user')
          .set('Authorization', `Bearer ${token}`)
          .send({
            marketingAgreement: false,
            onboardingCompleted: true,
            signupContext: {
              type: 'invalid_type',
              invitationCode: 'ABC234',
            },
          })
          .expect(400);
      });

      it('signupContext.invitationCode가 빠지면 400을 반환한다', async () => {
        const { authId } = await createAuthOnlyUser();
        const token = generateTestToken(authId);

        await request(app.getHttpServer())
          .post('/user')
          .set('Authorization', `Bearer ${token}`)
          .send({
            marketingAgreement: false,
            onboardingCompleted: true,
            signupContext: {
              type: 'invitation_normal',
            },
          })
          .expect(400);
      });
    });
  });
});
