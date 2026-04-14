import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import dayjs from 'dayjs';
import { AppModule } from '../src/app.module';
import { getTestSupabaseAdminClient } from './supabase-client';
import { truncateAllTables } from './setup';
import { createTestUser, TestUser } from './helpers/user.helper';
import { SlackService } from '../src/slack/slack.service';

describe('Affiliate API (e2e) - Real DB', () => {
  let app: INestApplication;
  const supabase = getTestSupabaseAdminClient();
  const apiKey = process.env.BATCH_API_KEY ?? 'test-batch-api-key';

  const stubSlackService = {
    reportBugToSlack: () => Promise.resolve(),
    reportToInvitationNoti: () => Promise.resolve(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SlackService)
      .useValue(stubSlackService)
      .compile();

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

  async function createPendingApproval(params: {
    userId: string;
    pointAmount: number;
    merchantId: string;
    approvalDate: string;
    transactionId?: number;
  }): Promise<number> {
    const { data, error } = await supabase
      .from('affiliate_callback_data')
      .insert({
        user_id: params.userId,
        point_amount: params.pointAmount,
        data: { merchant_id: params.merchantId },
        status: 'pending',
        approval_date: params.approvalDate,
        transaction_id:
          params.transactionId ?? Math.floor(Math.random() * 1_000_000_000),
      })
      .select('id')
      .single();

    if (error || !data) {
      throw new Error(
        `Failed to create pending approval: ${error?.message ?? 'no data'}`,
      );
    }
    return (data as { id: number }).id;
  }

  async function fetchAffiliatePointActions(userId: string) {
    const { data, error } = await supabase
      .from('point_actions')
      .select('id, user_id, type, point_amount, status, additional_data')
      .eq('user_id', userId)
      .eq('type', 'AFFILIATE')
      .order('id', { ascending: true });
    if (error) {
      throw error;
    }
    return data ?? [];
  }

  async function fetchAffiliateCallback(id: number) {
    const { data, error } = await supabase
      .from('affiliate_callback_data')
      .select('id, status, completed_at')
      .eq('id', id)
      .single();
    if (error) {
      throw error;
    }
    return data;
  }

  describe('POST /affiliate/cron/approvals', () => {
    it('API key가 없으면 401을 반환한다', async () => {
      await request(app.getHttpServer())
        .post('/affiliate/cron/approvals')
        .expect(401);
    });

    it('잘못된 API key면 401을 반환한다', async () => {
      await request(app.getHttpServer())
        .post('/affiliate/cron/approvals')
        .set('x-batch-api-key', 'wrong-key')
        .expect(401);
    });

    it('pending 건이 없으면 빈 결과를 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .post('/affiliate/cron/approvals')
        .set('x-batch-api-key', apiKey)
        .expect(200);

      expect(response.body).toEqual({
        processed: 0,
        successful: 0,
        failed: 0,
        details: [],
      });
    });

    it('pending 건에 대해 AFFILIATE 포인트를 지급하고 completed로 업데이트한다', async () => {
      const user: TestUser = await createTestUser(supabase);
      const yesterday = dayjs().subtract(1, 'day').toISOString();

      const approvalId = await createPendingApproval({
        userId: user.id,
        pointAmount: 1500,
        merchantId: 'aliexpress',
        approvalDate: yesterday,
      });

      const response = await request(app.getHttpServer())
        .post('/affiliate/cron/approvals')
        .set('x-batch-api-key', apiKey)
        .expect(200);

      expect(response.body.processed).toBe(1);
      expect(response.body.successful).toBe(1);
      expect(response.body.failed).toBe(0);

      const actions = await fetchAffiliatePointActions(user.id);
      expect(actions).toHaveLength(1);
      expect(actions[0].point_amount).toBe(1500);
      expect(actions[0].status).toBe('done');
      expect(actions[0].additional_data).toMatchObject({
        affiliate_callback_id: approvalId,
        merchant_id: 'aliexpress',
      });

      const callback = await fetchAffiliateCallback(approvalId);
      expect(callback.status).toBe('completed');
      expect(callback.completed_at).not.toBeNull();
    });

    it('미래 approval_date는 처리하지 않는다', async () => {
      const user: TestUser = await createTestUser(supabase);
      const tomorrow = dayjs().add(2, 'day').toISOString();

      const approvalId = await createPendingApproval({
        userId: user.id,
        pointAmount: 500,
        merchantId: 'emart',
        approvalDate: tomorrow,
      });

      const response = await request(app.getHttpServer())
        .post('/affiliate/cron/approvals')
        .set('x-batch-api-key', apiKey)
        .expect(200);

      expect(response.body.processed).toBe(0);

      const actions = await fetchAffiliatePointActions(user.id);
      expect(actions).toHaveLength(0);

      const callback = await fetchAffiliateCallback(approvalId);
      expect(callback.status).toBe('pending');
    });

    it('이미 completed된 건은 다시 처리하지 않는다', async () => {
      const user: TestUser = await createTestUser(supabase);
      const yesterday = dayjs().subtract(1, 'day').toISOString();

      const approvalId = await createPendingApproval({
        userId: user.id,
        pointAmount: 500,
        merchantId: 'emart',
        approvalDate: yesterday,
      });

      // 수동으로 completed 처리
      await supabase
        .from('affiliate_callback_data')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', approvalId);

      const response = await request(app.getHttpServer())
        .post('/affiliate/cron/approvals')
        .set('x-batch-api-key', apiKey)
        .expect(200);

      expect(response.body.processed).toBe(0);
      const actions = await fetchAffiliatePointActions(user.id);
      expect(actions).toHaveLength(0);
    });

    it('여러 pending 건을 순차 처리한다', async () => {
      const user1: TestUser = await createTestUser(supabase);
      const user2: TestUser = await createTestUser(supabase);
      const yesterday = dayjs().subtract(1, 'day').toISOString();

      const id1 = await createPendingApproval({
        userId: user1.id,
        pointAmount: 500,
        merchantId: 'a',
        approvalDate: yesterday,
      });
      const id2 = await createPendingApproval({
        userId: user2.id,
        pointAmount: 1000,
        merchantId: 'b',
        approvalDate: yesterday,
      });

      const response = await request(app.getHttpServer())
        .post('/affiliate/cron/approvals')
        .set('x-batch-api-key', apiKey)
        .expect(200);

      expect(response.body.processed).toBe(2);
      expect(response.body.successful).toBe(2);

      const user1Actions = await fetchAffiliatePointActions(user1.id);
      expect(user1Actions).toHaveLength(1);
      expect(user1Actions[0].point_amount).toBe(500);

      const user2Actions = await fetchAffiliatePointActions(user2.id);
      expect(user2Actions).toHaveLength(1);
      expect(user2Actions[0].point_amount).toBe(1000);

      const callback1 = await fetchAffiliateCallback(id1);
      const callback2 = await fetchAffiliateCallback(id2);
      expect(callback1.status).toBe('completed');
      expect(callback2.status).toBe('completed');
    });
  });
});
