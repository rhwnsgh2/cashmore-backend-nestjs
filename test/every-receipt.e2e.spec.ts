import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getTestSupabaseAdminClient } from './supabase-client';
import { truncateAllTables } from './setup';
import { createTestUser } from './helpers/user.helper';
import {
  createReceiptSubmission,
  createReceiptSubmissions,
  createReceiptReReview,
} from './helpers/streak.helper';
import { generateTestToken } from './helpers/auth.helper';
import { ReceiptQueueService } from '../src/every-receipt/receipt-queue.service';
import { AmplitudeService } from '../src/amplitude/amplitude.service';
import { EventService } from '../src/event/event.service';
import { OnboardingService } from '../src/onboarding/onboarding.service';
import { FcmService } from '../src/fcm/fcm.service';
import { vi } from 'vitest';

describe('EveryReceipt API (e2e)', () => {
  let app: INestApplication;
  const supabase = getTestSupabaseAdminClient();

  const stubQueueService = {
    publish: () => Promise.resolve('test-message-id'),
  };
  const stubAmplitudeService = {
    track: () => {},
    onModuleDestroy: () => Promise.resolve(),
  };
  const stubEventService = {
    isDoublePointActive: vi.fn().mockResolvedValue(false),
  };
  const stubOnboardingService = {
    getEventStatus: vi.fn().mockResolvedValue(false),
  };
  const stubFcmService = {
    pushNotification: vi.fn().mockResolvedValue(undefined),
    sendRefreshMessage: vi.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ReceiptQueueService)
      .useValue(stubQueueService)
      .overrideProvider(AmplitudeService)
      .useValue(stubAmplitudeService)
      .overrideProvider(EventService)
      .useValue(stubEventService)
      .overrideProvider(OnboardingService)
      .useValue(stubOnboardingService)
      .overrideProvider(FcmService)
      .useValue(stubFcmService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new (await import('@nestjs/common')).ValidationPipe({ transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await truncateAllTables();
    await app.close();
  });

  beforeEach(async () => {
    await truncateAllTables();
    stubEventService.isDoublePointActive.mockResolvedValue(false);
    stubOnboardingService.getEventStatus.mockResolvedValue(false);
    stubFcmService.pushNotification.mockClear();
    stubFcmService.sendRefreshMessage.mockClear();
  });

  describe('GET /every_receipt', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .get('/every_receipt')
        .expect(401);

      expect(response.body.message).toBe('No token provided');
    });

    it('영수증이 없으면 빈 배열을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const response = await request(app.getHttpServer())
        .get('/every_receipt')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('영수증 목록을 최신순으로 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createReceiptSubmissions(supabase, [
        {
          user_id: testUser.id,
          created_at: '2026-01-10T10:00:00+09:00',
          status: 'completed',
          point: 200,
          image_url: 'https://example.com/old.jpg',
        },
        {
          user_id: testUser.id,
          created_at: '2026-01-15T10:00:00+09:00',
          status: 'completed',
          point: 250,
          image_url: 'https://example.com/new.jpg',
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/every_receipt')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].pointAmount).toBe(250);
      expect(response.body[1].pointAmount).toBe(200);
    });

    it('모든 상태의 영수증을 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createReceiptSubmissions(supabase, [
        {
          user_id: testUser.id,
          created_at: '2026-01-15T10:00:00+09:00',
          status: 'completed',
          point: 250,
        },
        {
          user_id: testUser.id,
          created_at: '2026-01-15T11:00:00+09:00',
          status: 'pending',
          point: 0,
        },
        {
          user_id: testUser.id,
          created_at: '2026-01-15T12:00:00+09:00',
          status: 'rejected',
          point: 0,
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/every_receipt')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveLength(3);

      const statuses = response.body.map((r: { status: string }) => r.status);
      expect(statuses).toContain('completed');
      expect(statuses).toContain('pending');
      expect(statuses).toContain('rejected');
    });

    it('다른 사용자의 영수증은 포함하지 않는다', async () => {
      const testUser = await createTestUser(supabase);
      const otherUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createReceiptSubmissions(supabase, [
        {
          user_id: testUser.id,
          created_at: '2026-01-15T10:00:00+09:00',
          status: 'completed',
          point: 250,
        },
        {
          user_id: otherUser.id,
          created_at: '2026-01-15T10:00:00+09:00',
          status: 'completed',
          point: 300,
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/every_receipt')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].pointAmount).toBe(250);
    });

    it('영수증 필드가 올바르게 매핑된다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await createReceiptSubmissions(supabase, [
        {
          user_id: testUser.id,
          created_at: '2026-01-15T10:30:00+09:00',
          status: 'completed',
          point: 250,
          image_url: 'https://example.com/receipt.jpg',
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/every_receipt')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const receipt = response.body[0];
      expect(receipt).toHaveProperty('id');
      expect(receipt).toHaveProperty('createdAt');
      expect(receipt.pointAmount).toBe(250);
      expect(receipt.status).toBe('completed');
      expect(receipt.imageUrl).toBe('https://example.com/receipt.jpg');
    });
  });

  describe('GET /every_receipt/:id', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .get('/every_receipt/1')
        .expect(401);

      expect(response.body.message).toBe('No token provided');
    });

    it('존재하지 않는 영수증이면 404를 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      await request(app.getHttpServer())
        .get('/every_receipt/999999')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('다른 사용자의 영수증은 조회할 수 없다', async () => {
      const testUser = await createTestUser(supabase);
      const otherUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const receipt = await createReceiptSubmission(supabase, {
        user_id: otherUser.id,
        status: 'completed',
        point: 25,
      });

      await request(app.getHttpServer())
        .get(`/every_receipt/${receipt.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('score_data가 없는 영수증의 기본 정보를 반환한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const receipt = await createReceiptSubmission(supabase, {
        user_id: testUser.id,
        status: 'completed',
        point: 25,
        image_url: 'https://example.com/receipt.jpg',
      });

      const response = await request(app.getHttpServer())
        .get(`/every_receipt/${receipt.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.id).toBe(receipt.id);
      expect(response.body.pointAmount).toBe(25);
      expect(response.body.status).toBe('completed');
      expect(response.body.imageUrl).toBe('https://example.com/receipt.jpg');
      expect(response.body.adShowPoint).toBe(0);
      expect(response.body.reReviewStatus).toBeNull();
      expect(response.body.grade).toBeUndefined();
    });

    it('score_data가 있으면 등급 정보를 포함한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const scoreData = {
        items: { score: 10, reason: 'good' },
        store_name: { score: 5, reason: 'found' },
        total_score: 80,
        receipt_type: { score: 25, reason: 'offline' },
        date_validity: { score: 15, reason: 'valid' },
        image_quality: { score: 10, reason: 'clear', image_quality: 5 },
        store_details: { score: 5, reason: 'found' },
        payment_amount: { score: 5, reason: 'found' },
        payment_method: { score: 5, reason: 'found' },
        is_duplicate_receipt: false,
        same_store_count_with_in_7_days: { score: 0, reason: 'first' },
      };

      const receipt = await createReceiptSubmission(supabase, {
        user_id: testUser.id,
        status: 'completed',
        point: 30,
        score_data: scoreData,
      });

      const response = await request(app.getHttpServer())
        .get(`/every_receipt/${receipt.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.receiptType).toBe('offline');
      expect(response.body.storeInfo).toBe('both');
      expect(response.body.paymentInfo).toBe('both');
      expect(response.body.hasItems).toBe(true);
      expect(response.body.grade).toBe('A+');
      expect(response.body.totalScore).toBe(80);
    });

    it('재검수 상태를 포함한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const receipt = await createReceiptSubmission(supabase, {
        user_id: testUser.id,
        status: 'completed',
        point: 25,
      });

      await createReceiptReReview(supabase, {
        every_receipt_id: receipt.id,
        status: 'pending',
      });

      const response = await request(app.getHttpServer())
        .get(`/every_receipt/${receipt.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.reReviewStatus).toBe('pending');
    });
  });

  describe('POST /every_receipt/confirm-upload', () => {
    it('토큰 없이 요청하면 401을 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .post('/every_receipt/confirm-upload')
        .send({ publicUrl: 'https://storage.googleapis.com/bucket/image.jpg' })
        .expect(401);

      expect(response.body.message).toBe('No token provided');
    });

    it('영수증 업로드 확인에 성공한다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const response = await request(app.getHttpServer())
        .post('/every_receipt/confirm-upload')
        .set('Authorization', `Bearer ${token}`)
        .send({
          publicUrl: 'https://storage.googleapis.com/bucket/image.jpg',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.everyReceiptId).toBeDefined();
      expect(response.body.imageUrl).toBe(
        'https://storage.googleapis.com/bucket/image.jpg',
      );
    });

    it('DB에 영수증이 pending 상태로 저장된다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const response = await request(app.getHttpServer())
        .post('/every_receipt/confirm-upload')
        .set('Authorization', `Bearer ${token}`)
        .send({
          publicUrl: 'https://storage.googleapis.com/bucket/image.jpg',
        })
        .expect(201);

      const { data: receipt } = await supabase
        .from('every_receipt')
        .select('*')
        .eq('id', response.body.everyReceiptId)
        .single();

      expect(receipt).not.toBeNull();
      expect(receipt!.status).toBe('pending');
      expect(receipt!.point).toBe(0);
      expect(receipt!.image_url).toBe(
        'https://storage.googleapis.com/bucket/image.jpg',
      );
      expect(receipt!.user_id).toBe(testUser.id);
    });

    it('currentPosition을 포함하여 저장할 수 있다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const response = await request(app.getHttpServer())
        .post('/every_receipt/confirm-upload')
        .set('Authorization', `Bearer ${token}`)
        .send({
          publicUrl: 'https://storage.googleapis.com/bucket/image.jpg',
          currentPosition: 'POINT(127.0 37.5)',
        })
        .expect(201);

      const { data: receipt } = await supabase
        .from('every_receipt')
        .select('*')
        .eq('id', response.body.everyReceiptId)
        .single();

      expect(receipt!.position).toEqual({
        type: 'Point',
        coordinates: [127, 37.5],
      });
    });

    it('여러 영수증을 연속으로 등록할 수 있다', async () => {
      const testUser = await createTestUser(supabase);
      const token = generateTestToken(testUser.auth_id);

      const response1 = await request(app.getHttpServer())
        .post('/every_receipt/confirm-upload')
        .set('Authorization', `Bearer ${token}`)
        .send({
          publicUrl: 'https://storage.googleapis.com/bucket/image1.jpg',
        })
        .expect(201);

      const response2 = await request(app.getHttpServer())
        .post('/every_receipt/confirm-upload')
        .set('Authorization', `Bearer ${token}`)
        .send({
          publicUrl: 'https://storage.googleapis.com/bucket/image2.jpg',
        })
        .expect(201);

      expect(response1.body.everyReceiptId).not.toBe(
        response2.body.everyReceiptId,
      );

      // GET으로 목록 확인
      const listResponse = await request(app.getHttpServer())
        .get('/every_receipt')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(listResponse.body).toHaveLength(2);
    });
  });

  describe('POST /every_receipt/complete', () => {
    const scoreData = {
      items: { score: 10, reason: 'good' },
      store_name: { score: 5, reason: 'found' },
      total_score: 80,
      receipt_type: { score: 25, reason: 'offline' },
      date_validity: { score: 15, reason: 'valid' },
      image_quality: { score: 10, reason: 'clear', image_quality: 5 },
      store_details: { score: 5, reason: 'found' },
      payment_amount: { score: 5, reason: 'found' },
      payment_method: { score: 5, reason: 'found' },
      is_duplicate_receipt: false,
      same_store_count_with_in_7_days: { score: 0, reason: 'first' },
    };

    it('everyReceiptId 없이 요청하면 400을 반환한다', async () => {
      await request(app.getHttpServer())
        .post('/every_receipt/complete')
        .send({})
        .expect(400);
    });

    it('존재하지 않는 영수증이면 404를 반환한다', async () => {
      await request(app.getHttpServer())
        .post('/every_receipt/complete')
        .send({ everyReceiptId: 999999 })
        .expect(404);
    });

    it('score_data가 없는 영수증이면 404를 반환한다', async () => {
      const testUser = await createTestUser(supabase);

      const receipt = await createReceiptSubmission(supabase, {
        user_id: testUser.id,
        status: 'pending',
        point: 0,
        // score_data 없음
      });

      await request(app.getHttpServer())
        .post('/every_receipt/complete')
        .send({ everyReceiptId: receipt.id })
        .expect(404);
    });

    it('이미 completed된 영수증이면 404를 반환한다', async () => {
      const testUser = await createTestUser(supabase);

      const receipt = await createReceiptSubmission(supabase, {
        user_id: testUser.id,
        status: 'completed',
        point: 25,
        score_data: scoreData,
      });

      await request(app.getHttpServer())
        .post('/every_receipt/complete')
        .send({ everyReceiptId: receipt.id })
        .expect(404);
    });

    it('정상 영수증 완료 처리에 성공한다', async () => {
      const testUser = await createTestUser(supabase);

      const receipt = await createReceiptSubmission(supabase, {
        user_id: testUser.id,
        status: 'pending',
        point: 25,
        score_data: scoreData,
      });

      const response = await request(app.getHttpServer())
        .post('/every_receipt/complete')
        .send({ everyReceiptId: receipt.id })
        .expect(200);

      expect(response.body.success).toBe(true);

      // DB에서 상태 확인
      const { data: updatedReceipt } = await supabase
        .from('every_receipt')
        .select('status, completed_at')
        .eq('id', receipt.id)
        .single();

      expect(updatedReceipt!.status).toBe('completed');
      expect(updatedReceipt!.completed_at).not.toBeNull();
    });

    it('완료 처리 후 포인트 액션이 생성된다', async () => {
      const testUser = await createTestUser(supabase);

      const receipt = await createReceiptSubmission(supabase, {
        user_id: testUser.id,
        status: 'pending',
        point: 25,
        score_data: scoreData,
      });

      await request(app.getHttpServer())
        .post('/every_receipt/complete')
        .send({ everyReceiptId: receipt.id })
        .expect(200);

      // point_actions 테이블에서 확인
      const { data: pointActions } = await supabase
        .from('point_actions')
        .select('*')
        .eq('user_id', testUser.id)
        .eq('type', 'EVERY_RECEIPT');

      expect(pointActions).toHaveLength(1);
      expect(pointActions![0].point_amount).toBe(25);
      expect(pointActions![0].status).toBe('done');
      expect(pointActions![0].additional_data).toEqual(
        expect.objectContaining({
          every_receipt_id: receipt.id,
        }),
      );
    });

    it('중복 영수증(point=0, is_duplicate_receipt=true)은 rejected로 처리한다', async () => {
      const testUser = await createTestUser(supabase);

      const duplicateScoreData = {
        ...scoreData,
        is_duplicate_receipt: true,
      };

      const receipt = await createReceiptSubmission(supabase, {
        user_id: testUser.id,
        status: 'pending',
        point: 0,
        score_data: duplicateScoreData,
      });

      const response = await request(app.getHttpServer())
        .post('/every_receipt/complete')
        .send({ everyReceiptId: receipt.id })
        .expect(200);

      expect(response.body.success).toBe(true);

      // DB에서 상태 확인
      const { data: updatedReceipt } = await supabase
        .from('every_receipt')
        .select('status, rejected_reason')
        .eq('id', receipt.id)
        .single();

      expect(updatedReceipt!.status).toBe('rejected');
      expect(updatedReceipt!.rejected_reason).toBe('중복된 영수증 제출');
    });

    it('중복 영수증은 포인트 액션을 생성하지 않는다', async () => {
      const testUser = await createTestUser(supabase);

      const duplicateScoreData = {
        ...scoreData,
        is_duplicate_receipt: true,
      };

      const receipt = await createReceiptSubmission(supabase, {
        user_id: testUser.id,
        status: 'pending',
        point: 0,
        score_data: duplicateScoreData,
      });

      await request(app.getHttpServer())
        .post('/every_receipt/complete')
        .send({ everyReceiptId: receipt.id })
        .expect(200);

      // point_actions 테이블에 레코드가 없어야 함
      const { data: pointActions } = await supabase
        .from('point_actions')
        .select('*')
        .eq('user_id', testUser.id)
        .eq('type', 'EVERY_RECEIPT');

      expect(pointActions).toHaveLength(0);
    });

    it('더블 포인트 이벤트 기간에는 포인트가 2배가 된다', async () => {
      stubEventService.isDoublePointActive.mockResolvedValue(true);

      const testUser = await createTestUser(supabase);

      const receipt = await createReceiptSubmission(supabase, {
        user_id: testUser.id,
        status: 'pending',
        point: 25,
        score_data: scoreData,
      });

      await request(app.getHttpServer())
        .post('/every_receipt/complete')
        .send({ everyReceiptId: receipt.id })
        .expect(200);

      // DB에서 포인트 확인
      const { data: updatedReceipt } = await supabase
        .from('every_receipt')
        .select('point')
        .eq('id', receipt.id)
        .single();

      expect(updatedReceipt!.point).toBe(50);

      // point_actions도 2배 포인트로 생성되어야 함
      const { data: pointActions } = await supabase
        .from('point_actions')
        .select('*')
        .eq('user_id', testUser.id)
        .eq('type', 'EVERY_RECEIPT');

      expect(pointActions![0].point_amount).toBe(50);
    });

    it('온보딩 이벤트 기간에는 포인트가 2배가 된다', async () => {
      stubOnboardingService.getEventStatus.mockResolvedValue(true);

      const testUser = await createTestUser(supabase);

      const receipt = await createReceiptSubmission(supabase, {
        user_id: testUser.id,
        status: 'pending',
        point: 30,
        score_data: scoreData,
      });

      await request(app.getHttpServer())
        .post('/every_receipt/complete')
        .send({ everyReceiptId: receipt.id })
        .expect(200);

      // DB에서 포인트 확인
      const { data: updatedReceipt } = await supabase
        .from('every_receipt')
        .select('point')
        .eq('id', receipt.id)
        .single();

      expect(updatedReceipt!.point).toBe(60);
    });

    it('완료 처리 후 FCM 리프레시 메시지를 전송한다', async () => {
      const testUser = await createTestUser(supabase);

      const receipt = await createReceiptSubmission(supabase, {
        user_id: testUser.id,
        status: 'pending',
        point: 25,
        score_data: scoreData,
      });

      await request(app.getHttpServer())
        .post('/every_receipt/complete')
        .send({ everyReceiptId: receipt.id })
        .expect(200);

      expect(stubFcmService.sendRefreshMessage).toHaveBeenCalledWith(
        testUser.id,
        'receipt_update',
      );
    });

    it('완료 처리 후 포인트 알림을 전송한다', async () => {
      const testUser = await createTestUser(supabase);

      const receipt = await createReceiptSubmission(supabase, {
        user_id: testUser.id,
        status: 'pending',
        point: 25,
        score_data: scoreData,
      });

      await request(app.getHttpServer())
        .post('/every_receipt/complete')
        .send({ everyReceiptId: receipt.id })
        .expect(200);

      expect(stubFcmService.pushNotification).toHaveBeenCalledWith(
        testUser.id,
        'AI 영수증 분석이 완료됐어요 🤖',
        '바로 25포인트를 지급할게요!',
        {},
      );
    });

    it('중복 reject 시에는 포인트 알림을 보내지 않는다', async () => {
      const testUser = await createTestUser(supabase);

      const duplicateScoreData = {
        ...scoreData,
        is_duplicate_receipt: true,
      };

      const receipt = await createReceiptSubmission(supabase, {
        user_id: testUser.id,
        status: 'pending',
        point: 0,
        score_data: duplicateScoreData,
      });

      await request(app.getHttpServer())
        .post('/every_receipt/complete')
        .send({ everyReceiptId: receipt.id })
        .expect(200);

      expect(stubFcmService.pushNotification).not.toHaveBeenCalled();
    });

    it('중복 reject 후에도 리프레시 메시지는 전송한다', async () => {
      const testUser = await createTestUser(supabase);

      const duplicateScoreData = {
        ...scoreData,
        is_duplicate_receipt: true,
      };

      const receipt = await createReceiptSubmission(supabase, {
        user_id: testUser.id,
        status: 'pending',
        point: 0,
        score_data: duplicateScoreData,
      });

      await request(app.getHttpServer())
        .post('/every_receipt/complete')
        .send({ everyReceiptId: receipt.id })
        .expect(200);

      expect(stubFcmService.sendRefreshMessage).toHaveBeenCalledWith(
        testUser.id,
        'receipt_update',
      );
    });

    it('이미 rejected된 영수증이면 404를 반환한다', async () => {
      const testUser = await createTestUser(supabase);

      const receipt = await createReceiptSubmission(supabase, {
        user_id: testUser.id,
        status: 'rejected',
        point: 0,
        score_data: scoreData,
      });

      await request(app.getHttpServer())
        .post('/every_receipt/complete')
        .send({ everyReceiptId: receipt.id })
        .expect(404);
    });
  });
});
