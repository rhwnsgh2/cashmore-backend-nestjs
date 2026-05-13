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

    it('status 미지정 → pending만, 오래된 순, 페이지네이션 메타 포함', async () => {
      await seedReady();
      const a = await placeOrder();
      await new Promise((r) => setTimeout(r, 10));
      const b = await placeOrder();

      const res = await request(app.getHttpServer())
        .get('/admin/gifticon/exchanges')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(200);

      expect(res.body.items.map((r: { id: number }) => r.id)).toEqual([
        a.id,
        b.id,
      ]);
      expect(res.body.total).toBe(2);
      expect(res.body.page).toBe(1);
      expect(res.body.pageSize).toBe(50);
      expect(res.body.totalPages).toBe(1);
    });

    it('응답에 user_total_point(차감 후 잔액) 포함', async () => {
      await seedReady();
      // seedReady에서 5000P 적립, 1500P 차감 → 잔액 3500
      const order = await placeOrder();

      const res = await request(app.getHttpServer())
        .get('/admin/gifticon/exchanges')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(200);

      const row = (
        res.body.items as Array<{ id: number; user_total_point: number }>
      ).find((r) => r.id === order.id);
      expect(row?.user_total_point).toBe(3500);
    });

    it('페이지네이션: page=2, pageSize=2로 5건 중 두 번째 페이지 2건', async () => {
      await seedReady();
      // 5건 주문하려면 1500 * 5 = 7500 필요 → 추가 적립
      await createPointActions(supabase, [
        { user_id: testUser.id, point_amount: 5000, type: 'EVENT' },
      ]);
      const ids: number[] = [];
      for (let i = 0; i < 5; i++) {
        const o = await placeOrder();
        ids.push(o.id);
        await new Promise((r) => setTimeout(r, 5));
      }

      const p1 = await request(app.getHttpServer())
        .get('/admin/gifticon/exchanges?page=1&pageSize=2')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(200);
      expect(p1.body.items).toHaveLength(2);
      expect(p1.body.total).toBe(5);
      expect(p1.body.totalPages).toBe(3);

      const p2 = await request(app.getHttpServer())
        .get('/admin/gifticon/exchanges?page=2&pageSize=2')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(200);
      expect(p2.body.items).toHaveLength(2);

      const p3 = await request(app.getHttpServer())
        .get('/admin/gifticon/exchanges?page=3&pageSize=2')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(200);
      expect(p3.body.items).toHaveLength(1);

      const allIds: number[] = [
        ...p1.body.items.map((r: { id: number }) => r.id),
        ...p2.body.items.map((r: { id: number }) => r.id),
        ...p3.body.items.map((r: { id: number }) => r.id),
      ];
      expect(new Set(allIds).size).toBe(5);
    });

    it('잘못된 pageSize(0 이하 또는 >200) → 400', async () => {
      await request(app.getHttpServer())
        .get('/admin/gifticon/exchanges?pageSize=0')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(400);

      await request(app.getHttpServer())
        .get('/admin/gifticon/exchanges?pageSize=300')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(400);
    });

    it('GET /admin/gifticon/stats/daily — 잘못된 API 키 → 401', async () => {
      await request(app.getHttpServer())
        .get('/admin/gifticon/stats/daily?year=2026&month=5')
        .set('x-admin-api-key', 'wrong')
        .expect(401);
    });

    it('GET /admin/gifticon/stats/daily — sent만 KST 일별 집계, 빈 날 0 채움', async () => {
      // 어드민이라 직접 DB seed
      await supabase.from('smartcon_goods').insert({
        goods_id: 'A',
        event_id: '64385',
        raw_data: { GOODS_ID: 'A' },
        is_active: true,
      });
      await supabase.from('gifticon_products').insert({
        smartcon_goods_id: 'A',
        point_price: 1500,
        is_visible: true,
      });

      // KST 5/3 (UTC 5/3 03:00)에 sent 2건
      await supabase.from('coupon_exchanges').insert([
        {
          user_id: testUser.id,
          point_action_id: null,
          amount: 1500,
          smartcon_goods_id: 'A',
          tr_id: 'tr-stats-1',
          send_status: 'sent',
          updated_at: '2026-05-03T03:00:00.000Z',
        },
        {
          user_id: testUser.id,
          point_action_id: null,
          amount: 2000,
          smartcon_goods_id: 'A',
          tr_id: 'tr-stats-2',
          send_status: 'sent',
          updated_at: '2026-05-03T04:00:00.000Z',
        },
        // pending — 집계 제외
        {
          user_id: testUser.id,
          point_action_id: null,
          amount: 9999,
          smartcon_goods_id: 'A',
          tr_id: 'tr-stats-pending',
          send_status: 'pending',
          updated_at: '2026-05-03T05:00:00.000Z',
        },
        // 4월 — 월 범위 밖
        {
          user_id: testUser.id,
          point_action_id: null,
          amount: 8888,
          smartcon_goods_id: 'A',
          tr_id: 'tr-stats-april',
          send_status: 'sent',
          updated_at: '2026-04-25T03:00:00.000Z',
        },
      ]);

      const res = await request(app.getHttpServer())
        .get('/admin/gifticon/stats/daily?year=2026&month=5')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(200);

      expect(res.body.items).toHaveLength(31); // 5월은 31일
      expect(res.body.items[0].date).toBe('2026-05-01');

      const may3 = (
        res.body.items as Array<{
          date: string;
          count: number;
          amount: number;
        }>
      ).find((i) => i.date === '2026-05-03')!;
      expect(may3.count).toBe(2);
      expect(may3.amount).toBe(3500);

      // 빈 날 확인
      const may1 = (
        res.body.items as Array<{
          date: string;
          count: number;
          amount: number;
        }>
      ).find((i) => i.date === '2026-05-01')!;
      expect(may1.count).toBe(0);
      expect(may1.amount).toBe(0);

      expect(res.body.totalCount).toBe(2);
      expect(res.body.totalAmount).toBe(3500);
    });

    it('GET /admin/gifticon/stats/daily — month=13 → 400', async () => {
      await request(app.getHttpServer())
        .get('/admin/gifticon/stats/daily?year=2026&month=13')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(400);
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

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].send_status).toBe('sent');
      expect(res.body.total).toBe(1);
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
      expect((pa?.[1].additional_data as { reason?: string })?.reason).toBe(
        'admin_rejected',
      );

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
