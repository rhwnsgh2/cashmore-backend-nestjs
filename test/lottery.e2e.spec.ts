import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import dayjs from 'dayjs';
import { AppModule } from '../src/app.module';
import { getTestSupabaseAdminClient } from './supabase-client';
import { truncateAllTables } from './setup';
import { createTestUser, TestUser } from './helpers/user.helper';
import { createLottery, createLotteries } from './helpers/lottery.helper';
import {
  generateTestToken,
  generateExpiredToken,
  generateInvalidToken,
} from './helpers/auth.helper';

describe('Lottery API (e2e) - Real DB', () => {
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

  describe('GET /lottery/my', () => {
    describe('인증', () => {
      it('토큰 없이 요청하면 401을 반환한다', async () => {
        const response = await request(app.getHttpServer())
          .get('/lottery/my')
          .expect(401);

        expect(response.body.message).toBe('No token provided');
      });

      it('만료된 토큰도 서명이 유효하면 허용한다', async () => {
        const testUser = await createTestUser(supabase);
        const expiredToken = generateExpiredToken(testUser.auth_id);

        const response = await request(app.getHttpServer())
          .get('/lottery/my')
          .set('Authorization', `Bearer ${expiredToken}`)
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
      });

      it('잘못된 토큰으로 요청하면 401을 반환한다', async () => {
        const testUser = await createTestUser(supabase);
        const invalidToken = generateInvalidToken(testUser.auth_id);

        const response = await request(app.getHttpServer())
          .get('/lottery/my')
          .set('Authorization', `Bearer ${invalidToken}`)
          .expect(401);

        expect(response.body.message).toBe('Invalid token');
      });

      it('존재하지 않는 사용자의 토큰으로 요청하면 401을 반환한다', async () => {
        const nonExistentAuthId = 'non-existent-auth-id';
        const token = generateTestToken(nonExistentAuthId);

        const response = await request(app.getHttpServer())
          .get('/lottery/my')
          .set('Authorization', `Bearer ${token}`)
          .expect(401);

        expect(response.body.message).toBe('User not found');
      });
    });

    describe('복권 조회', () => {
      let testUser: TestUser;
      let token: string;

      beforeEach(async () => {
        testUser = await createTestUser(supabase);
        token = generateTestToken(testUser.auth_id);
      });

      it('복권이 없는 사용자는 빈 배열을 반환한다', async () => {
        const response = await request(app.getHttpServer())
          .get('/lottery/my')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body).toEqual([]);
      });

      it('사용 가능한 복권 목록을 반환한다', async () => {
        await createLottery(supabase, {
          user_id: testUser.id,
          lottery_type_id: 'MAX_500',
          status: 'ISSUED',
        });

        const response = await request(app.getHttpServer())
          .get('/lottery/my')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body).toHaveLength(1);
        expect(response.body[0]).toHaveProperty('id');
        expect(response.body[0].lotteryType).toBe('MAX_500');
        expect(response.body[0].status).toBe('ISSUED');
      });

      it('STANDARD_5 타입은 MAX_500으로 변환된다', async () => {
        await createLottery(supabase, {
          user_id: testUser.id,
          lottery_type_id: 'STANDARD_5',
          status: 'ISSUED',
        });

        const response = await request(app.getHttpServer())
          .get('/lottery/my')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body[0].lotteryType).toBe('MAX_500');
        expect(response.body[0].lotteryTypeId).toBe('MAX_500');
      });

      it('만료된 복권은 반환하지 않는다', async () => {
        await createLotteries(supabase, [
          {
            user_id: testUser.id,
            lottery_type_id: 'MAX_500',
            status: 'ISSUED',
            expires_at: dayjs().subtract(1, 'day').toISOString(),
          },
          {
            user_id: testUser.id,
            lottery_type_id: 'MAX_100',
            status: 'ISSUED',
            expires_at: dayjs().add(7, 'day').toISOString(),
          },
        ]);

        const response = await request(app.getHttpServer())
          .get('/lottery/my')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body).toHaveLength(1);
        expect(response.body[0].lotteryType).toBe('MAX_100');
      });

      it('USED 상태의 복권은 반환하지 않는다', async () => {
        await createLotteries(supabase, [
          {
            user_id: testUser.id,
            lottery_type_id: 'MAX_500',
            status: 'USED',
            used_at: dayjs().toISOString(),
          },
          {
            user_id: testUser.id,
            lottery_type_id: 'MAX_100',
            status: 'ISSUED',
          },
        ]);

        const response = await request(app.getHttpServer())
          .get('/lottery/my')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body).toHaveLength(1);
        expect(response.body[0].lotteryType).toBe('MAX_100');
      });

      it('최신순으로 정렬되어 반환된다', async () => {
        await createLotteries(supabase, [
          {
            user_id: testUser.id,
            lottery_type_id: 'MAX_100',
            status: 'ISSUED',
            issued_at: dayjs().subtract(2, 'day').toISOString(),
          },
          {
            user_id: testUser.id,
            lottery_type_id: 'MAX_500',
            status: 'ISSUED',
            issued_at: dayjs().subtract(1, 'day').toISOString(),
          },
          {
            user_id: testUser.id,
            lottery_type_id: 'MAX_1000',
            status: 'ISSUED',
            issued_at: dayjs().toISOString(),
          },
        ]);

        const response = await request(app.getHttpServer())
          .get('/lottery/my')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body).toHaveLength(3);
        expect(response.body[0].lotteryType).toBe('MAX_1000');
        expect(response.body[1].lotteryType).toBe('MAX_500');
        expect(response.body[2].lotteryType).toBe('MAX_100');
      });

      it('다른 사용자의 복권은 조회되지 않는다', async () => {
        const otherUser = await createTestUser(supabase);

        // 다른 사용자의 복권 생성
        await createLottery(supabase, {
          user_id: otherUser.id,
          lottery_type_id: 'MAX_1000',
          status: 'ISSUED',
        });

        // 내 복권 생성
        await createLottery(supabase, {
          user_id: testUser.id,
          lottery_type_id: 'MAX_500',
          status: 'ISSUED',
        });

        const response = await request(app.getHttpServer())
          .get('/lottery/my')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body).toHaveLength(1);
        expect(response.body[0].lotteryType).toBe('MAX_500');
        expect(response.body[0].userId).toBe(testUser.id);
      });

      it('EXPIRED 상태의 복권은 반환하지 않는다', async () => {
        await createLotteries(supabase, [
          {
            user_id: testUser.id,
            lottery_type_id: 'MAX_500',
            status: 'EXPIRED',
          },
          {
            user_id: testUser.id,
            lottery_type_id: 'MAX_100',
            status: 'ISSUED',
          },
        ]);

        const response = await request(app.getHttpServer())
          .get('/lottery/my')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body).toHaveLength(1);
        expect(response.body[0].lotteryType).toBe('MAX_100');
      });

      it('최대 20개까지만 반환한다', async () => {
        // 25개의 복권 생성
        const lotteries = Array.from({ length: 25 }, (_, i) => ({
          user_id: testUser.id,
          lottery_type_id: 'MAX_500' as const,
          status: 'ISSUED' as const,
          issued_at: dayjs().subtract(i, 'hour').toISOString(),
        }));

        await createLotteries(supabase, lotteries);

        const response = await request(app.getHttpServer())
          .get('/lottery/my')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(response.body).toHaveLength(20);
      });

      it('응답에 모든 필드가 포함된다', async () => {
        const issuedAt = dayjs().subtract(1, 'day').toISOString();
        const expiresAt = dayjs().add(7, 'day').toISOString();

        await createLottery(supabase, {
          user_id: testUser.id,
          lottery_type_id: 'MAX_500',
          status: 'ISSUED',
          issued_at: issuedAt,
          expires_at: expiresAt,
          reward_amount: 0,
        });

        const response = await request(app.getHttpServer())
          .get('/lottery/my')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        const lottery = response.body[0];

        expect(lottery).toHaveProperty('id');
        expect(lottery).toHaveProperty('userId', testUser.id);
        expect(lottery).toHaveProperty('lotteryTypeId', 'MAX_500');
        expect(lottery).toHaveProperty('lotteryType', 'MAX_500');
        expect(lottery).toHaveProperty('status', 'ISSUED');
        expect(lottery).toHaveProperty('issuedAt');
        expect(lottery).toHaveProperty('expiresAt');
        expect(lottery).toHaveProperty('rewardAmount', 0);
        // usedAt은 undefined여야 함 (ISSUED 상태)
        expect(lottery.usedAt).toBeUndefined();
      });
    });
  });

  describe('POST /lottery/issue', () => {
    let testUser: TestUser;
    let token: string;

    beforeEach(async () => {
      testUser = await createTestUser(supabase);
      token = generateTestToken(testUser.auth_id);
    });

    it('토큰 없이 요청하면 401을 반환한다', async () => {
      await request(app.getHttpServer())
        .post('/lottery/issue')
        .send({ lotteryType: 'MAX_500' })
        .expect(401);
    });

    it('MAX_500 복권을 발급한다', async () => {
      const response = await request(app.getHttpServer())
        .post('/lottery/issue')
        .set('Authorization', `Bearer ${token}`)
        .send({ lotteryType: 'MAX_500' })
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.userId).toBe(testUser.id);
      expect(response.body.lotteryTypeId).toBe('MAX_500');
      expect(response.body.status).toBe('ISSUED');
      expect(response.body.rewardAmount).toBeGreaterThan(0);
      expect(response.body.issuedAt).toBeDefined();
      expect(response.body.expiresAt).toBeDefined();
    });

    it('STANDARD_5 타입은 MAX_500으로 변환되어 저장된다', async () => {
      const response = await request(app.getHttpServer())
        .post('/lottery/issue')
        .set('Authorization', `Bearer ${token}`)
        .send({ lotteryType: 'STANDARD_5' })
        .expect(201);

      expect(response.body.lotteryTypeId).toBe('MAX_500');
    });

    it('발급된 복권이 /lottery/my에서 조회된다', async () => {
      await request(app.getHttpServer())
        .post('/lottery/issue')
        .set('Authorization', `Bearer ${token}`)
        .send({ lotteryType: 'MAX_500' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get('/lottery/my')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].status).toBe('ISSUED');
    });

    it('reason을 포함하여 발급할 수 있다', async () => {
      const response = await request(app.getHttpServer())
        .post('/lottery/issue')
        .set('Authorization', `Bearer ${token}`)
        .send({ lotteryType: 'MAX_500', reason: 'ad_reward_lottery_13:00' })
        .expect(201);

      expect(response.body.id).toBeDefined();
    });
  });

  describe('POST /lottery/showAdAndClaim', () => {
    let testUser: TestUser;
    let token: string;

    beforeEach(async () => {
      testUser = await createTestUser(supabase);
      token = generateTestToken(testUser.auth_id);
    });

    it('토큰 없이 요청하면 401을 반환한다', async () => {
      await request(app.getHttpServer())
        .post('/lottery/showAdAndClaim')
        .send({ adId: 'ad_123', slotTime: '13:00' })
        .expect(401);
    });

    it('광고 시청 후 복권을 발급하고 즉시 사용한다', async () => {
      const response = await request(app.getHttpServer())
        .post('/lottery/showAdAndClaim')
        .set('Authorization', `Bearer ${token}`)
        .send({ adId: 'ad_123', slotTime: '13:00' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.lottery.id).toBeDefined();
      expect(response.body.lottery.userId).toBe(testUser.id);
      expect(response.body.lottery.status).toBe('USED');
      expect(response.body.lottery.rewardAmount).toBeGreaterThan(0);
      expect(response.body.lottery.usedAt).toBeDefined();
    });

    it('사용된 복권은 /lottery/my에서 조회되지 않는다', async () => {
      await request(app.getHttpServer())
        .post('/lottery/showAdAndClaim')
        .set('Authorization', `Bearer ${token}`)
        .send({ adId: 'ad_123', slotTime: '09:00' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get('/lottery/my')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveLength(0);
    });
  });

  describe('POST /lottery/use', () => {
    let testUser: TestUser;
    let token: string;

    beforeEach(async () => {
      testUser = await createTestUser(supabase);
      token = generateTestToken(testUser.auth_id);
    });

    it('토큰 없이 요청하면 401을 반환한다', async () => {
      await request(app.getHttpServer())
        .post('/lottery/use')
        .send({ lotteryId: 'some-lottery-id' })
        .expect(401);
    });

    it('ISSUED 상태의 복권을 사용한다', async () => {
      const lottery = await createLottery(supabase, {
        user_id: testUser.id,
        lottery_type_id: 'MAX_500',
        status: 'ISSUED',
        reward_amount: 100,
      });

      const response = await request(app.getHttpServer())
        .post('/lottery/use')
        .set('Authorization', `Bearer ${token}`)
        .send({ lotteryId: lottery.id })
        .expect(201);

      expect(response.body.id).toBe(lottery.id);
      expect(response.body.userId).toBe(testUser.id);
      expect(response.body.rewardAmount).toBe(100);
      expect(response.body.status).toBe('USED');
      expect(response.body.usedAt).toBeDefined();
    });

    it('사용 후 복권이 /lottery/my에서 조회되지 않는다', async () => {
      const lottery = await createLottery(supabase, {
        user_id: testUser.id,
        lottery_type_id: 'MAX_500',
        status: 'ISSUED',
        reward_amount: 50,
      });

      await request(app.getHttpServer())
        .post('/lottery/use')
        .set('Authorization', `Bearer ${token}`)
        .send({ lotteryId: lottery.id })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get('/lottery/my')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveLength(0);
    });

    it('포인트가 지급된다', async () => {
      const lottery = await createLottery(supabase, {
        user_id: testUser.id,
        lottery_type_id: 'MAX_500',
        status: 'ISSUED',
        reward_amount: 100,
      });

      await request(app.getHttpServer())
        .post('/lottery/use')
        .set('Authorization', `Bearer ${token}`)
        .send({ lotteryId: lottery.id })
        .expect(201);

      // point_actions 테이블에서 확인
      const { data: pointActions } = await supabase
        .from('point_actions')
        .select('*')
        .eq('user_id', testUser.id)
        .eq('type', 'LOTTERY');

      expect(pointActions).toHaveLength(1);
      expect(pointActions![0].point_amount).toBe(100);
      expect(pointActions![0].additional_data.reference_id).toBe(lottery.id);
    });

    it('존재하지 않는 복권이면 404를 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .post('/lottery/use')
        .set('Authorization', `Bearer ${token}`)
        .send({ lotteryId: '00000000-0000-0000-0000-000000000000' })
        .expect(404);

      expect(response.body.message).toBe('복권을 찾을 수 없습니다.');
    });

    it('다른 사용자의 복권이면 400을 반환한다', async () => {
      const otherUser = await createTestUser(supabase);
      const lottery = await createLottery(supabase, {
        user_id: otherUser.id,
        lottery_type_id: 'MAX_500',
        status: 'ISSUED',
        reward_amount: 100,
      });

      const response = await request(app.getHttpServer())
        .post('/lottery/use')
        .set('Authorization', `Bearer ${token}`)
        .send({ lotteryId: lottery.id })
        .expect(400);

      expect(response.body.message).toBe('본인의 복권만 사용할 수 있습니다.');
    });

    it('USED 상태의 복권이면 400을 반환한다', async () => {
      const lottery = await createLottery(supabase, {
        user_id: testUser.id,
        lottery_type_id: 'MAX_500',
        status: 'USED',
        reward_amount: 100,
        used_at: dayjs().toISOString(),
      });

      const response = await request(app.getHttpServer())
        .post('/lottery/use')
        .set('Authorization', `Bearer ${token}`)
        .send({ lotteryId: lottery.id })
        .expect(400);

      expect(response.body.message).toBe('복권 상태가 올바르지 않습니다.');
    });

    it('EXPIRED 상태의 복권이면 400을 반환한다', async () => {
      const lottery = await createLottery(supabase, {
        user_id: testUser.id,
        lottery_type_id: 'MAX_500',
        status: 'EXPIRED',
        reward_amount: 100,
      });

      const response = await request(app.getHttpServer())
        .post('/lottery/use')
        .set('Authorization', `Bearer ${token}`)
        .send({ lotteryId: lottery.id })
        .expect(400);

      expect(response.body.message).toBe('복권 상태가 올바르지 않습니다.');
    });
  });
});
