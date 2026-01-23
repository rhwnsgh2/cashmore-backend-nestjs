import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import dayjs from 'dayjs';
import { AppModule } from '../src/app.module';
import { getTestSupabaseAdminClient } from './supabase-client';
import { truncateAllTables } from './setup';
import { createTestUser, TestUser } from './helpers/user.helper';
import {
  createAdLotterySlot,
  getCurrentSlotTime,
  getCurrentSlotStartTime,
} from './helpers/ad-lottery-slot.helper';
import {
  generateTestToken,
  generateExpiredToken,
  generateInvalidToken,
} from './helpers/auth.helper';

describe('Ad Lottery Slot API (e2e) - Real DB', () => {
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

  describe('GET /lottery/check-availability', () => {
    describe('인증', () => {
      it('토큰 없이 요청하면 401을 반환한다', async () => {
        const response = await request(app.getHttpServer())
          .get('/lottery/check-availability')
          .expect(401);

        expect(response.body.message).toBe('No token provided');
      });

      it('만료된 토큰도 서명이 유효하면 허용한다', async () => {
        const testUser = await createTestUser(supabase);
        const expiredToken = generateExpiredToken(testUser.auth_id);

        const response = await request(app.getHttpServer())
          .get('/lottery/check-availability')
          .set('Authorization', `Bearer ${expiredToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('available');
      });

      it('잘못된 토큰으로 요청하면 401을 반환한다', async () => {
        const testUser = await createTestUser(supabase);
        const invalidToken = generateInvalidToken(testUser.auth_id);

        const response = await request(app.getHttpServer())
          .get('/lottery/check-availability')
          .set('Authorization', `Bearer ${invalidToken}`)
          .expect(401);

        expect(response.body.message).toBe('Invalid token');
      });

      it('존재하지 않는 사용자의 토큰으로 요청하면 401을 반환한다', async () => {
        const nonExistentAuthId = 'non-existent-auth-id';
        const token = generateTestToken(nonExistentAuthId);

        const response = await request(app.getHttpServer())
          .get('/lottery/check-availability')
          .set('Authorization', `Bearer ${token}`)
          .expect(401);

        expect(response.body.message).toBe('User not found');
      });
    });

    describe('시청 가능 여부 확인', () => {
      let testUser: TestUser;
      let token: string;

      beforeEach(async () => {
        testUser = await createTestUser(supabase);
        token = generateTestToken(testUser.auth_id);
      });

      it('시청 기록이 없으면 available: true를 반환한다', async () => {
        const response = await request(app.getHttpServer())
          .get('/lottery/check-availability')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.available).toBe(true);
        expect(response.body.currentSlot).toBeDefined();
        expect(response.body.message).toContain('시청할 수 있습니다');
        expect(response.body.nextSlot).toBeUndefined();
        expect(response.body.nextSlotTime).toBeUndefined();
      });

      it('현재 슬롯에서 이미 시청했으면 available: false를 반환한다', async () => {
        const currentSlot = getCurrentSlotTime();
        const startTime = getCurrentSlotStartTime();

        await createAdLotterySlot(supabase, {
          user_id: testUser.id,
          slot_time: currentSlot,
          created_at: dayjs(startTime).add(1, 'minute').toISOString(),
        });

        const response = await request(app.getHttpServer())
          .get('/lottery/check-availability')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.available).toBe(false);
        expect(response.body.currentSlot).toBe(currentSlot);
        expect(response.body.nextSlot).toBeDefined();
        expect(response.body.nextSlotTime).toBeDefined();
        expect(response.body.message).toContain('다음 슬롯은');
      });

      it('다른 슬롯에서 시청한 기록은 현재 슬롯에 영향을 주지 않는다', async () => {
        const currentSlot = getCurrentSlotTime();
        // 다른 슬롯 선택
        const otherSlot = currentSlot === '09:00' ? '13:00' : '09:00';

        await createAdLotterySlot(supabase, {
          user_id: testUser.id,
          slot_time: otherSlot,
          created_at: dayjs().subtract(1, 'hour').toISOString(),
        });

        const response = await request(app.getHttpServer())
          .get('/lottery/check-availability')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.available).toBe(true);
      });

      it('다른 사용자의 시청 기록은 영향을 주지 않는다', async () => {
        const otherUser = await createTestUser(supabase);
        const currentSlot = getCurrentSlotTime();

        await createAdLotterySlot(supabase, {
          user_id: otherUser.id,
          slot_time: currentSlot,
          created_at: dayjs().toISOString(),
        });

        const response = await request(app.getHttpServer())
          .get('/lottery/check-availability')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.available).toBe(true);
      });

      it('슬롯 시간 범위 이전의 기록은 영향을 주지 않는다', async () => {
        const currentSlot = getCurrentSlotTime();
        const startTime = getCurrentSlotStartTime();

        // 슬롯 시작 시간 이전에 생성된 기록
        await createAdLotterySlot(supabase, {
          user_id: testUser.id,
          slot_time: currentSlot,
          created_at: dayjs(startTime).subtract(1, 'hour').toISOString(),
        });

        const response = await request(app.getHttpServer())
          .get('/lottery/check-availability')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.available).toBe(true);
      });

      it('응답에 모든 필드가 포함된다 (시청 가능한 경우)', async () => {
        const response = await request(app.getHttpServer())
          .get('/lottery/check-availability')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body).toHaveProperty('available', true);
        expect(response.body).toHaveProperty('currentSlot');
        expect(response.body).toHaveProperty('message');
        expect(['09:00', '13:00', '18:00', '22:00']).toContain(
          response.body.currentSlot,
        );
      });

      it('응답에 모든 필드가 포함된다 (시청 불가능한 경우)', async () => {
        const currentSlot = getCurrentSlotTime();

        await createAdLotterySlot(supabase, {
          user_id: testUser.id,
          slot_time: currentSlot,
          created_at: dayjs().toISOString(),
        });

        const response = await request(app.getHttpServer())
          .get('/lottery/check-availability')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body).toHaveProperty('available', false);
        expect(response.body).toHaveProperty('currentSlot', currentSlot);
        expect(response.body).toHaveProperty('nextSlot');
        expect(response.body).toHaveProperty('nextSlotTime');
        expect(response.body).toHaveProperty('message');
        expect(['09:00', '13:00', '18:00', '22:00']).toContain(
          response.body.nextSlot,
        );
      });

      it('nextSlotTime은 ISO 8601 형식이다', async () => {
        const currentSlot = getCurrentSlotTime();

        await createAdLotterySlot(supabase, {
          user_id: testUser.id,
          slot_time: currentSlot,
          created_at: dayjs().toISOString(),
        });

        const response = await request(app.getHttpServer())
          .get('/lottery/check-availability')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body.nextSlotTime).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
        );
      });
    });
  });
});
