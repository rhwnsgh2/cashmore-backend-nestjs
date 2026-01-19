import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
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
});
