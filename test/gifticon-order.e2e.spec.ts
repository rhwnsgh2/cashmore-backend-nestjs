import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { SmartconApiService } from '../src/smartcon/smartcon-api.service';
import { getTestSupabaseAdminClient } from './supabase-client';
import { truncateAllTables } from './setup';
import { createTestUser, TestUser } from './helpers/user.helper';
import { generateTestToken } from './helpers/auth.helper';
import { createPointActions } from './helpers/point.helper';

const ADMIN_API_KEY = process.env.BATCH_API_KEY ?? 'test-batch-api-key';
const EVENT_ID = '64385';

async function seedGoodsAndCuration(
  supabase: ReturnType<typeof getTestSupabaseAdminClient>,
  goodsId: string,
  pointPrice: number,
  opts: { isVisible?: boolean; isActive?: boolean } = {},
) {
  const { isVisible = true, isActive = true } = opts;
  await supabase.from('smartcon_goods').insert({
    goods_id: goodsId,
    event_id: EVENT_ID,
    raw_data: { GOODS_ID: goodsId },
    is_active: isActive,
  });
  await supabase.from('gifticon_products').insert({
    smartcon_goods_id: goodsId,
    point_price: pointPrice,
    is_visible: isVisible,
  });
}

async function setPhone(
  supabase: ReturnType<typeof getTestSupabaseAdminClient>,
  userId: string,
  phone: string,
) {
  await supabase.from('user_info').insert({
    user_id: userId,
    phone_number: phone,
    name: '',
  });
}

describe('Gifticon Order (e2e) - Real DB', () => {
  let app: INestApplication;
  const supabase = getTestSupabaseAdminClient();
  const couponCreate = vi.fn();
  let testUser: TestUser;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SmartconApiService)
      .useValue({
        couponCreate,
        getEventGoods: vi.fn(),
      })
      .compile();

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
    testUser = await createTestUser(supabase);
    authToken = generateTestToken(testUser.auth_id);
    couponCreate.mockReset();
    couponCreate.mockResolvedValue({
      RESULTCODE: '00',
      RESULTMSG: '처리완료',
      RECEIVERMOBILE: '01012345678',
      BARCODE_NUM: '1234567890123',
      ORDER_ID: 'SC0001',
      USER_ID: 'bridgeworks',
      TR_ID: 'will-be-overridden',
      EXP_DATE: '20260605',
    });
  });

  async function seedReady() {
    await seedGoodsAndCuration(supabase, 'A', 1500);
    await setPhone(supabase, testUser.id, '01012345678');
    await createPointActions(supabase, [
      { user_id: testUser.id, point_amount: 5000, type: 'EVENT' },
    ]);
  }

  async function placeOrder(): Promise<{ id: number; send_status: string }> {
    const res = await request(app.getHttpServer())
      .post('/gifticon/order')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ goodsId: 'A' })
      .expect(201);
    return res.body;
  }

  // === POST /gifticon/order — 차감 + pending ===
  describe('POST /gifticon/order', () => {
    it('인증 없음 → 401', async () => {
      await request(app.getHttpServer())
        .post('/gifticon/order')
        .send({ goodsId: 'A' })
        .expect(401);
    });

    it('정상: status=pending, 스마트콘 호출 X, send_logs 없음, 차감 1번', async () => {
      await seedReady();

      const response = await request(app.getHttpServer())
        .post('/gifticon/order')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ goodsId: 'A' })
        .expect(201);

      expect(response.body.send_status).toBe('pending');
      expect(response.body.barcode_num).toBeNull();
      expect(couponCreate).not.toHaveBeenCalled();

      const { data: pa } = await supabase
        .from('point_actions')
        .select('point_amount')
        .eq('user_id', testUser.id)
        .eq('type', 'GIFTICON_PURCHASE');
      expect(pa).toHaveLength(1);
      expect(pa?.[0].point_amount).toBe(-1500);

      const { data: logs } = await supabase
        .from('coupon_send_logs')
        .select('id')
        .eq('exchange_id', response.body.id);
      expect(logs).toHaveLength(0);
    });

    it('포인트 부족 → 400, 차감 없음', async () => {
      await seedGoodsAndCuration(supabase, 'A', 1500);
      await setPhone(supabase, testUser.id, '01012345678');
      await createPointActions(supabase, [
        { user_id: testUser.id, point_amount: 100, type: 'EVENT' },
      ]);

      await request(app.getHttpServer())
        .post('/gifticon/order')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ goodsId: 'A' })
        .expect(400);

      const { data: pa } = await supabase
        .from('point_actions')
        .select('id')
        .eq('user_id', testUser.id)
        .eq('type', 'GIFTICON_PURCHASE');
      expect(pa).toHaveLength(0);
    });

    it('phone 미등록 → 400', async () => {
      await seedGoodsAndCuration(supabase, 'A', 1500);
      await createPointActions(supabase, [
        { user_id: testUser.id, point_amount: 5000, type: 'EVENT' },
      ]);

      await request(app.getHttpServer())
        .post('/gifticon/order')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ goodsId: 'A' })
        .expect(400);
    });

    it('노출 OFF → 404, 차감 없음', async () => {
      await seedGoodsAndCuration(supabase, 'A', 1500, { isVisible: false });
      await setPhone(supabase, testUser.id, '01012345678');
      await createPointActions(supabase, [
        { user_id: testUser.id, point_amount: 5000, type: 'EVENT' },
      ]);

      await request(app.getHttpServer())
        .post('/gifticon/order')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ goodsId: 'A' })
        .expect(404);
    });

    it('단종 → 404', async () => {
      await seedGoodsAndCuration(supabase, 'A', 1500, { isActive: false });
      await setPhone(supabase, testUser.id, '01012345678');
      await createPointActions(supabase, [
        { user_id: testUser.id, point_amount: 5000, type: 'EVENT' },
      ]);

      await request(app.getHttpServer())
        .post('/gifticon/order')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ goodsId: 'A' })
        .expect(404);
    });

    it('idempotencyKey: 같은 키로 2번 호출 → 같은 row, 차감 1번', async () => {
      await seedReady();

      const key = `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const first = await request(app.getHttpServer())
        .post('/gifticon/order')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ goodsId: 'A', idempotencyKey: key })
        .expect(201);
      const second = await request(app.getHttpServer())
        .post('/gifticon/order')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ goodsId: 'A', idempotencyKey: key })
        .expect(201);

      expect(second.body.id).toBe(first.body.id);

      const { data: pa } = await supabase
        .from('point_actions')
        .select('id')
        .eq('user_id', testUser.id)
        .eq('type', 'GIFTICON_PURCHASE');
      expect(pa).toHaveLength(1);

      expect(couponCreate).not.toHaveBeenCalled();
    });

    it('idempotencyKey: 동시 5번 호출 (race) → 한 row, 차감 1번', async () => {
      await seedReady();

      const key = `race-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const responses = await Promise.all(
        Array.from({ length: 5 }, () =>
          request(app.getHttpServer())
            .post('/gifticon/order')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ goodsId: 'A', idempotencyKey: key }),
        ),
      );
      for (const r of responses) {
        expect(r.status).toBe(201);
      }
      const ids = new Set(responses.map((r) => r.body.id));
      expect(ids.size).toBe(1);

      const { data: pa } = await supabase
        .from('point_actions')
        .select('id')
        .eq('user_id', testUser.id)
        .eq('type', 'GIFTICON_PURCHASE');
      expect(pa).toHaveLength(1);

      const { data: exchanges } = await supabase
        .from('coupon_exchanges')
        .select('id')
        .eq('idempotency_key', key);
      expect(exchanges).toHaveLength(1);
    });

    it('idempotencyKey 미지정: 2번 호출 → 주문 2번 (기존 동작)', async () => {
      await seedReady();

      const a = await request(app.getHttpServer())
        .post('/gifticon/order')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ goodsId: 'A' })
        .expect(201);
      const b = await request(app.getHttpServer())
        .post('/gifticon/order')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ goodsId: 'A' })
        .expect(201);
      expect(a.body.id).not.toBe(b.body.id);
    });
  });

  // === GET /admin/gifticon/exchanges ===
  describe('GET /admin/gifticon/exchanges', () => {
    it('잘못된 API 키 → 401', async () => {
      await request(app.getHttpServer())
        .get('/admin/gifticon/exchanges')
        .set('x-admin-api-key', 'wrong')
        .expect(401);
    });

    it('status 미지정 → pending만, 오래된 순', async () => {
      await seedReady();
      const a = await placeOrder();
      await new Promise((r) => setTimeout(r, 10));
      const b = await placeOrder();

      const res = await request(app.getHttpServer())
        .get('/admin/gifticon/exchanges')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(200);

      expect(res.body.map((r: { id: number }) => r.id)).toEqual([a.id, b.id]);
    });

    it('status=sent 필터', async () => {
      await seedReady();
      const a = await placeOrder();
      await request(app.getHttpServer())
        .post(`/admin/gifticon/approve/${a.id}`)
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/admin/gifticon/exchanges?status=sent')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].send_status).toBe('sent');
    });
  });

  // === POST /admin/gifticon/approve/:id ===
  describe('POST /admin/gifticon/approve/:id', () => {
    it('잘못된 API 키 → 401', async () => {
      await request(app.getHttpServer())
        .post('/admin/gifticon/approve/1')
        .set('x-admin-api-key', 'wrong')
        .expect(401);
    });

    it('pending → sent + send_logs INSERT', async () => {
      await seedReady();
      const order = await placeOrder();

      const res = await request(app.getHttpServer())
        .post(`/admin/gifticon/approve/${order.id}`)
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(201);

      expect(res.body).toMatchObject({
        send_status: 'sent',
        barcode_num: '1234567890123',
        exp_date: '2026-06-05',
        result_code: '00',
      });
      expect(couponCreate).toHaveBeenCalledTimes(1);

      const { data: logs } = await supabase
        .from('coupon_send_logs')
        .select('receiver_phone')
        .eq('exchange_id', order.id);
      expect(logs).toHaveLength(1);
      expect(logs?.[0].receiver_phone).toBe('01012345678');
    });

    it('RESULTCODE=99 → send_failed + 자동 환불', async () => {
      await seedReady();
      const order = await placeOrder();
      couponCreate.mockResolvedValueOnce({
        RESULTCODE: '99',
        RESULTMSG: '잘못된 URL 입니다.',
      });

      const res = await request(app.getHttpServer())
        .post(`/admin/gifticon/approve/${order.id}`)
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(201);

      expect(res.body.send_status).toBe('send_failed');
      expect(res.body.result_code).toBe('99');

      const { data: pa } = await supabase
        .from('point_actions')
        .select('point_amount')
        .eq('user_id', testUser.id)
        .eq('type', 'GIFTICON_PURCHASE')
        .order('id');
      expect(pa).toHaveLength(2);
      expect(pa?.[0].point_amount).toBe(-1500);
      expect(pa?.[1].point_amount).toBe(+1500);
    });

    it('네트워크 에러 → send_failed + 환불, result_code=NETWORK_ERROR', async () => {
      await seedReady();
      const order = await placeOrder();
      couponCreate.mockRejectedValueOnce(new Error('connection timeout'));

      const res = await request(app.getHttpServer())
        .post(`/admin/gifticon/approve/${order.id}`)
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(201);

      expect(res.body.send_status).toBe('send_failed');
      expect(res.body.result_code).toBe('NETWORK_ERROR');
    });

    it('이미 sent → 400', async () => {
      await seedReady();
      const order = await placeOrder();
      await request(app.getHttpServer())
        .post(`/admin/gifticon/approve/${order.id}`)
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(201);

      await request(app.getHttpServer())
        .post(`/admin/gifticon/approve/${order.id}`)
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(400);
    });

    it('미존재 id → 404', async () => {
      await request(app.getHttpServer())
        .post('/admin/gifticon/approve/999999')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(404);
    });
  });

  // === POST /admin/gifticon/reject/:id ===
  describe('POST /admin/gifticon/reject/:id', () => {
    it('잘못된 API 키 → 401', async () => {
      await request(app.getHttpServer())
        .post('/admin/gifticon/reject/1')
        .set('x-admin-api-key', 'wrong')
        .send({})
        .expect(401);
    });

    it('pending → rejected + 환불, reason은 result_msg에 박제', async () => {
      await seedReady();
      const order = await placeOrder();

      const res = await request(app.getHttpServer())
        .post(`/admin/gifticon/reject/${order.id}`)
        .set('x-admin-api-key', ADMIN_API_KEY)
        .send({ reason: '재고 소진' })
        .expect(201);

      expect(res.body.send_status).toBe('rejected');
      expect(res.body.result_code).toBe('ADMIN_REJECTED');
      expect(res.body.result_msg).toBe('재고 소진');

      const { data: pa } = await supabase
        .from('point_actions')
        .select('point_amount, additional_data')
        .eq('user_id', testUser.id)
        .eq('type', 'GIFTICON_PURCHASE')
        .order('id');
      expect(pa).toHaveLength(2);
      expect(pa?.[1].point_amount).toBe(+1500);
      expect(
        (pa?.[1].additional_data as { reason?: string })?.reason,
      ).toBe('admin_rejected');

      expect(couponCreate).not.toHaveBeenCalled();
    });

    it('reason 미전송 → result_msg = null', async () => {
      await seedReady();
      const order = await placeOrder();

      const res = await request(app.getHttpServer())
        .post(`/admin/gifticon/reject/${order.id}`)
        .set('x-admin-api-key', ADMIN_API_KEY)
        .send({})
        .expect(201);

      expect(res.body.result_msg).toBeNull();
    });

    it('sent → 400 (이미 발송된 건은 reject 불가)', async () => {
      await seedReady();
      const order = await placeOrder();
      await request(app.getHttpServer())
        .post(`/admin/gifticon/approve/${order.id}`)
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(201);

      await request(app.getHttpServer())
        .post(`/admin/gifticon/reject/${order.id}`)
        .set('x-admin-api-key', ADMIN_API_KEY)
        .send({})
        .expect(400);
    });

    it('이미 rejected → 400', async () => {
      await seedReady();
      const order = await placeOrder();
      await request(app.getHttpServer())
        .post(`/admin/gifticon/reject/${order.id}`)
        .set('x-admin-api-key', ADMIN_API_KEY)
        .send({})
        .expect(201);

      await request(app.getHttpServer())
        .post(`/admin/gifticon/reject/${order.id}`)
        .set('x-admin-api-key', ADMIN_API_KEY)
        .send({})
        .expect(400);
    });

    it('미존재 id → 404', async () => {
      await request(app.getHttpServer())
        .post('/admin/gifticon/reject/999999')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .send({})
        .expect(404);
    });
  });

  // === POST /admin/gifticon/refund/:id (sent → refunded) ===
  describe('POST /admin/gifticon/refund/:id', () => {
    async function placeSent() {
      await seedReady();
      const order = await placeOrder();
      await request(app.getHttpServer())
        .post(`/admin/gifticon/approve/${order.id}`)
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(201);
      return order;
    }

    it('잘못된 API 키 → 401', async () => {
      await request(app.getHttpServer())
        .post('/admin/gifticon/refund/1')
        .set('x-admin-api-key', 'wrong')
        .expect(401);
    });

    it('sent → refunded + 복원 행', async () => {
      const order = await placeSent();

      const res = await request(app.getHttpServer())
        .post(`/admin/gifticon/refund/${order.id}`)
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(201);

      expect(res.body.send_status).toBe('refunded');

      const { data: pa } = await supabase
        .from('point_actions')
        .select('point_amount, additional_data')
        .eq('user_id', testUser.id)
        .eq('type', 'GIFTICON_PURCHASE')
        .order('id');
      expect(pa).toHaveLength(2);
      expect(pa?.[1].point_amount).toBe(+1500);
      expect((pa?.[1].additional_data as { reason?: string })?.reason).toBe(
        'admin_refund',
      );
    });

    it('pending → 400 (reject로 처리해야 함)', async () => {
      await seedReady();
      const order = await placeOrder();

      await request(app.getHttpServer())
        .post(`/admin/gifticon/refund/${order.id}`)
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(400);
    });

    it('send_failed → 400', async () => {
      await seedReady();
      const order = await placeOrder();
      couponCreate.mockResolvedValueOnce({
        RESULTCODE: '99',
        RESULTMSG: 'fail',
      });
      await request(app.getHttpServer())
        .post(`/admin/gifticon/approve/${order.id}`)
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(201);

      await request(app.getHttpServer())
        .post(`/admin/gifticon/refund/${order.id}`)
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(400);
    });

    it('이미 refunded → 400', async () => {
      const order = await placeSent();
      await request(app.getHttpServer())
        .post(`/admin/gifticon/refund/${order.id}`)
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(201);

      await request(app.getHttpServer())
        .post(`/admin/gifticon/refund/${order.id}`)
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(400);
    });

    it('미존재 id → 404', async () => {
      await request(app.getHttpServer())
        .post('/admin/gifticon/refund/999999')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(404);
    });
  });
});
