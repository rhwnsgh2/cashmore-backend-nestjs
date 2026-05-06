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

  describe('POST /gifticon/order', () => {
    it('인증 없음 → 401', async () => {
      await request(app.getHttpServer())
        .post('/gifticon/order')
        .send({ goodsId: 'A' })
        .expect(401);
    });

    it('정상: status=sent + 포인트 차감 + send_logs 기록', async () => {
      await seedGoodsAndCuration(supabase, 'A', 1500);
      await setPhone(supabase, testUser.id, '01012345678');
      await createPointActions(supabase, [
        { user_id: testUser.id, point_amount: 5000, type: 'EVENT' },
      ]);

      const response = await request(app.getHttpServer())
        .post('/gifticon/order')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ goodsId: 'A' })
        .expect(201);

      expect(response.body).toMatchObject({
        send_status: 'sent',
        barcode_num: '1234567890123',
        exp_date: '2026-06-05',
        result_code: '00',
      });

      // 차감 행 확인
      const { data: pa } = await supabase
        .from('point_actions')
        .select('point_amount, type, additional_data')
        .eq('user_id', testUser.id)
        .eq('type', 'GIFTICON_PURCHASE');
      expect(pa).toHaveLength(1);
      expect(pa?.[0].point_amount).toBe(-1500);

      // send_logs 확인
      const { data: logs } = await supabase
        .from('coupon_send_logs')
        .select('receiver_phone')
        .eq('exchange_id', response.body.id);
      expect(logs).toHaveLength(1);
      expect(logs?.[0].receiver_phone).toBe('01012345678');
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

    it('스마트콘 RESULTCODE=99 → status=send_failed + 자동 환불', async () => {
      await seedGoodsAndCuration(supabase, 'A', 1500);
      await setPhone(supabase, testUser.id, '01012345678');
      await createPointActions(supabase, [
        { user_id: testUser.id, point_amount: 5000, type: 'EVENT' },
      ]);
      couponCreate.mockResolvedValueOnce({
        RESULTCODE: '99',
        RESULTMSG: '잘못된 URL 입니다.',
      });

      const response = await request(app.getHttpServer())
        .post('/gifticon/order')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ goodsId: 'A' })
        .expect(201);

      expect(response.body.send_status).toBe('send_failed');
      expect(response.body.result_code).toBe('99');

      // 차감 + 복원 두 행
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

    it('네트워크 에러 → status=send_failed + 환불, result_code=NETWORK_ERROR', async () => {
      await seedGoodsAndCuration(supabase, 'A', 1500);
      await setPhone(supabase, testUser.id, '01012345678');
      await createPointActions(supabase, [
        { user_id: testUser.id, point_amount: 5000, type: 'EVENT' },
      ]);
      couponCreate.mockRejectedValueOnce(new Error('connection timeout'));

      const response = await request(app.getHttpServer())
        .post('/gifticon/order')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ goodsId: 'A' })
        .expect(201);

      expect(response.body.send_status).toBe('send_failed');
      expect(response.body.result_code).toBe('NETWORK_ERROR');
    });
  });

  describe('POST /admin/gifticon/refund/:id', () => {
    async function placeSentOrder() {
      await seedGoodsAndCuration(supabase, 'A', 1500);
      await setPhone(supabase, testUser.id, '01012345678');
      await createPointActions(supabase, [
        { user_id: testUser.id, point_amount: 5000, type: 'EVENT' },
      ]);
      const response = await request(app.getHttpServer())
        .post('/gifticon/order')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ goodsId: 'A' })
        .expect(201);
      return response.body as { id: number; send_status: string };
    }

    it('잘못된 API 키 → 401', async () => {
      await request(app.getHttpServer())
        .post('/admin/gifticon/refund/1')
        .set('x-admin-api-key', 'wrong')
        .expect(401);
    });

    it('"sent" → "refunded" + 복원 행 INSERT', async () => {
      const order = await placeSentOrder();
      expect(order.send_status).toBe('sent');

      const response = await request(app.getHttpServer())
        .post(`/admin/gifticon/refund/${order.id}`)
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(201);

      expect(response.body.send_status).toBe('refunded');

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

    it('"send_failed" → 400', async () => {
      await seedGoodsAndCuration(supabase, 'A', 1500);
      await setPhone(supabase, testUser.id, '01012345678');
      await createPointActions(supabase, [
        { user_id: testUser.id, point_amount: 5000, type: 'EVENT' },
      ]);
      couponCreate.mockResolvedValueOnce({
        RESULTCODE: '99',
        RESULTMSG: 'fail',
      });
      const order = (
        await request(app.getHttpServer())
          .post('/gifticon/order')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ goodsId: 'A' })
          .expect(201)
      ).body as { id: number };

      await request(app.getHttpServer())
        .post(`/admin/gifticon/refund/${order.id}`)
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(400);
    });

    it('이미 refunded → 400', async () => {
      const order = await placeSentOrder();
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
