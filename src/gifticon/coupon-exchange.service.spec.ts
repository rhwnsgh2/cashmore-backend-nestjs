import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CouponExchangeService } from './coupon-exchange.service';
import { SmartconApiService } from '../smartcon/smartcon-api.service';
import { SMARTCON_GOODS_REPOSITORY } from '../smartcon/interfaces/smartcon-goods-repository.interface';
import { StubSmartconGoodsRepository } from '../smartcon/repositories/stub-smartcon-goods.repository';
import { GIFTICON_PRODUCT_REPOSITORY } from './interfaces/gifticon-product-repository.interface';
import { StubGifticonProductRepository } from './repositories/stub-gifticon-product.repository';
import { COUPON_EXCHANGE_REPOSITORY } from './interfaces/coupon-exchange-repository.interface';
import { StubCouponExchangeRepository } from './repositories/stub-coupon-exchange.repository';
import { COUPON_SEND_LOG_REPOSITORY } from './interfaces/coupon-send-log-repository.interface';
import { StubCouponSendLogRepository } from './repositories/stub-coupon-send-log.repository';
import { POINT_WRITE_SERVICE } from '../point-write/point-write.interface';
import { UserInfoService } from '../user-info/user-info.service';
import { PointService } from '../point/point.service';
import type { SmartconGoodsResponseItem } from '../smartcon/dto/smartcon-goods.dto';

const USER_ID = '00000000-0000-0000-0000-000000000001';
const GOODS_ID = 'A';
const POINT_PRICE = 1500;
const PHONE = '01012345678';

function makeRawItem(goodsId: string): SmartconGoodsResponseItem {
  return {
    GOODS_ID: goodsId,
    BRAND_NAME: '컴포즈커피',
    GOODS_NAME: `상품-${goodsId}`,
    MSG: '안내',
    PRICE: 1800,
    DISC_PRICE: 1710,
    DISC_RATE: 5,
    EXTRA_CHARGE: 0,
    IMG_URL: null,
    IMG_URL_HTTPS: null,
    GOODS_SALE_TYPE: 'BARCODE',
    GOODS_USE_TYPE: 'EXCHANGE',
    SC_LIMIT_DATE: 30,
    B2C_ITEM_NO: null,
  };
}

describe('CouponExchangeService', () => {
  let service: CouponExchangeService;
  let productRepo: StubGifticonProductRepository;
  let smartconRepo: StubSmartconGoodsRepository;
  let exchangeRepo: StubCouponExchangeRepository;
  let sendLogRepo: StubCouponSendLogRepository;
  let pointActions: Array<{
    id: number;
    userId: string;
    amount: number;
    type: string;
    additionalData?: Record<string, unknown>;
  }>;
  let addPoint: ReturnType<typeof vi.fn>;
  let getPointTotal: ReturnType<typeof vi.fn>;
  let getPhone: ReturnType<typeof vi.fn>;
  let couponCreate: ReturnType<typeof vi.fn>;

  async function setupCuratedGoods(
    opts: {
      isVisible?: boolean;
      isActive?: boolean;
    } = {},
  ): Promise<void> {
    const { isVisible = true, isActive = true } = opts;
    await smartconRepo.syncByEvent({
      eventId: '64385',
      items: [
        {
          goods_id: GOODS_ID,
          event_id: '64385',
          brand_name: null,
          goods_name: null,
          msg: null,
          price: null,
          disc_price: null,
          disc_rate: null,
          extra_charge: null,
          img_url: null,
          img_url_https: null,
          goods_sale_type: null,
          goods_use_type: null,
          sc_limit_date: null,
          b2c_item_no: null,
          raw_data: makeRawItem(GOODS_ID),
          last_synced_at: new Date().toISOString(),
        },
      ],
    });
    if (!isActive) {
      await smartconRepo.syncByEvent({ eventId: '64385', items: [] });
    }
    productRepo.seedGoods([
      {
        goods_id: GOODS_ID,
        event_id: '64385',
        brand_name: null,
        goods_name: null,
        msg: null,
        price: null,
        disc_price: null,
        img_url_https: null,
        cached_img_url: null,
        is_active: isActive,
      },
    ]);
    await productRepo.upsertCuration({
      smartcon_goods_id: GOODS_ID,
      point_price: POINT_PRICE,
      is_visible: isVisible,
    });
  }

  beforeEach(async () => {
    productRepo = new StubGifticonProductRepository();
    smartconRepo = new StubSmartconGoodsRepository();
    exchangeRepo = new StubCouponExchangeRepository();
    sendLogRepo = new StubCouponSendLogRepository();
    pointActions = [];

    addPoint = vi
      .fn()
      .mockImplementation(
        async (input: {
          userId: string;
          amount: number;
          type: string;
          additionalData?: Record<string, unknown>;
        }) => {
          const id = pointActions.length + 1;
          pointActions.push({ id, ...input });
          return { id };
        },
      );

    getPointTotal = vi.fn().mockResolvedValue({ totalPoint: 10_000 });
    getPhone = vi.fn().mockResolvedValue(PHONE);
    couponCreate = vi.fn().mockResolvedValue({
      RESULTCODE: '00',
      RESULTMSG: '처리완료',
      RECEIVERMOBILE: PHONE,
      BARCODE_NUM: '1234567890123',
      ORDER_ID: 'SC0001',
      USER_ID: 'bridgeworks',
      TR_ID: 'will-be-overridden',
      EXP_DATE: '20260605',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponExchangeService,
        { provide: SmartconApiService, useValue: { couponCreate } },
        { provide: SMARTCON_GOODS_REPOSITORY, useValue: smartconRepo },
        { provide: GIFTICON_PRODUCT_REPOSITORY, useValue: productRepo },
        { provide: COUPON_EXCHANGE_REPOSITORY, useValue: exchangeRepo },
        { provide: COUPON_SEND_LOG_REPOSITORY, useValue: sendLogRepo },
        { provide: POINT_WRITE_SERVICE, useValue: { addPoint } },
        { provide: UserInfoService, useValue: { getPhone } },
        { provide: PointService, useValue: { getPointTotal } },
      ],
    }).compile();

    service = module.get<CouponExchangeService>(CouponExchangeService);
  });

  // === 카테고리 1: 정상 발송 ===
  describe('정상 발송', () => {
    it('성공 → status="sent", barcode_num/exp_date 채워짐', async () => {
      await setupCuratedGoods();

      const result = await service.createOrder({
        userId: USER_ID,
        goodsId: GOODS_ID,
      });

      expect(result.send_status).toBe('sent');
      expect(result.barcode_num).toBe('1234567890123');
      expect(result.order_id).toBe('SC0001');
      expect(result.exp_date).toBe('2026-06-05'); // YYYYMMDD → YYYY-MM-DD
      expect(result.result_code).toBe('00');
    });

    it('point_actions 차감 행 INSERT (음수, type=GIFTICON_PURCHASE)', async () => {
      await setupCuratedGoods();
      await service.createOrder({ userId: USER_ID, goodsId: GOODS_ID });

      expect(pointActions).toHaveLength(1);
      expect(pointActions[0]).toMatchObject({
        userId: USER_ID,
        amount: -POINT_PRICE,
        type: 'GIFTICON_PURCHASE',
      });
      expect(pointActions[0].additionalData).toMatchObject({
        goods_id: GOODS_ID,
      });
      expect(pointActions[0].additionalData?.tr_id).toMatch(
        /^cashmore\d{17}[0-9a-f]{4}$/,
      );
    });

    it('coupon_send_logs INSERT (receiver_phone = user_info.phone)', async () => {
      await setupCuratedGoods();
      const order = await service.createOrder({
        userId: USER_ID,
        goodsId: GOODS_ID,
      });

      const logs = await sendLogRepo.findByExchangeId(order.id);
      expect(logs).toHaveLength(1);
      expect(logs[0].receiver_phone).toBe(PHONE);
    });

    it('스마트콘에 정확한 인자 전달 (goodsId, receiverMobile, trId)', async () => {
      await setupCuratedGoods();
      await service.createOrder({ userId: USER_ID, goodsId: GOODS_ID });

      const call = couponCreate.mock.calls[0][0];
      expect(call.goodsId).toBe(GOODS_ID);
      expect(call.receiverMobile).toBe(PHONE);
      expect(call.trId).toMatch(/^cashmore\d{17}[0-9a-f]{4}$/);
    });

    it('coupon_exchanges.amount = 호출 시점 point_price 박제', async () => {
      await setupCuratedGoods();
      const order = await service.createOrder({
        userId: USER_ID,
        goodsId: GOODS_ID,
      });

      expect(order.amount).toBe(POINT_PRICE);
      // 가격 변경해도 박제값 유지
      await productRepo.upsertCuration({
        smartcon_goods_id: GOODS_ID,
        point_price: 9999,
        is_visible: true,
      });
      const refetched = await exchangeRepo.findById(order.id);
      expect(refetched?.amount).toBe(POINT_PRICE);
    });
  });

  // === 카테고리 2: 사전 검증 실패 (차감 X) ===
  describe('사전 검증 실패', () => {
    it('큐레이션 안 된 상품 → NotFoundException, 차감 X', async () => {
      // 카탈로그만 있고 큐레이션 X
      productRepo.seedGoods([
        {
          goods_id: GOODS_ID,
          event_id: '64385',
          brand_name: null,
          goods_name: null,
          msg: null,
          price: null,
          disc_price: null,
          img_url_https: null,
          cached_img_url: null,
          is_active: true,
        },
      ]);

      await expect(
        service.createOrder({ userId: USER_ID, goodsId: GOODS_ID }),
      ).rejects.toThrow(NotFoundException);
      expect(pointActions).toHaveLength(0);
    });

    it('노출 OFF → NotFoundException, 차감 X', async () => {
      await setupCuratedGoods({ isVisible: false });

      await expect(
        service.createOrder({ userId: USER_ID, goodsId: GOODS_ID }),
      ).rejects.toThrow(NotFoundException);
      expect(pointActions).toHaveLength(0);
    });

    it('단종 (smartcon_goods.is_active=false) → NotFoundException, 차감 X', async () => {
      await setupCuratedGoods({ isActive: false });

      await expect(
        service.createOrder({ userId: USER_ID, goodsId: GOODS_ID }),
      ).rejects.toThrow(NotFoundException);
      expect(pointActions).toHaveLength(0);
    });

    it('미존재 goods_id → NotFoundException', async () => {
      await expect(
        service.createOrder({ userId: USER_ID, goodsId: 'UNKNOWN' }),
      ).rejects.toThrow(NotFoundException);
      expect(pointActions).toHaveLength(0);
    });

    it('phone 미등록 → BadRequestException, 차감 X', async () => {
      await setupCuratedGoods();
      getPhone.mockResolvedValueOnce(null);

      await expect(
        service.createOrder({ userId: USER_ID, goodsId: GOODS_ID }),
      ).rejects.toThrow(BadRequestException);
      expect(pointActions).toHaveLength(0);
    });

    it('포인트 부족 → BadRequestException, 차감 X', async () => {
      await setupCuratedGoods();
      getPointTotal.mockResolvedValueOnce({ totalPoint: 100 });

      await expect(
        service.createOrder({ userId: USER_ID, goodsId: GOODS_ID }),
      ).rejects.toThrow(BadRequestException);
      expect(pointActions).toHaveLength(0);
    });
  });

  // === 카테고리 3: 발송 실패 → 자동 환불 ===
  describe('발송 실패 → 자동 환불', () => {
    it('RESULTCODE=99 → 차감+환불 행, status=send_failed', async () => {
      await setupCuratedGoods();
      couponCreate.mockResolvedValueOnce({
        RESULTCODE: '99',
        RESULTMSG: '잘못된 URL 입니다.',
      });

      const result = await service.createOrder({
        userId: USER_ID,
        goodsId: GOODS_ID,
      });

      expect(result.send_status).toBe('send_failed');
      expect(result.result_code).toBe('99');
      expect(result.result_msg).toBe('잘못된 URL 입니다.');

      // 차감 + 복원 두 행
      expect(pointActions).toHaveLength(2);
      expect(pointActions[0].amount).toBe(-POINT_PRICE);
      expect(pointActions[1].amount).toBe(+POINT_PRICE);
      expect(pointActions[1].additionalData).toMatchObject({
        original_point_action_id: pointActions[0].id,
        reason: 'send_failed',
      });
    });

    it('네트워크 에러(throw) → 환불, result_code=NETWORK_ERROR', async () => {
      await setupCuratedGoods();
      couponCreate.mockRejectedValueOnce(new Error('connection timeout'));

      const result = await service.createOrder({
        userId: USER_ID,
        goodsId: GOODS_ID,
      });

      expect(result.send_status).toBe('send_failed');
      expect(result.result_code).toBe('NETWORK_ERROR');
      expect(result.result_msg).toBe('connection timeout');
      expect(pointActions).toHaveLength(2);
      expect(pointActions[1].amount).toBe(+POINT_PRICE);
    });

    it('실패해도 send_logs는 INSERT됨 (시도한 사실 기록)', async () => {
      await setupCuratedGoods();
      couponCreate.mockResolvedValueOnce({
        RESULTCODE: '52',
        RESULTMSG: '수신자 번호 오류',
      });

      const result = await service.createOrder({
        userId: USER_ID,
        goodsId: GOODS_ID,
      });

      const logs = await sendLogRepo.findByExchangeId(result.id);
      expect(logs).toHaveLength(1);
      expect(logs[0].receiver_phone).toBe(PHONE);
    });

    it('환불 후 net = 0 (차감 + 복원 합)', async () => {
      await setupCuratedGoods();
      couponCreate.mockResolvedValueOnce({
        RESULTCODE: '99',
        RESULTMSG: 'fail',
      });

      await service.createOrder({ userId: USER_ID, goodsId: GOODS_ID });

      const net = pointActions.reduce((sum, p) => sum + p.amount, 0);
      expect(net).toBe(0);
    });
  });

  // === 카테고리 4: 어드민 환불 ===
  describe('refund', () => {
    async function createSentOrder() {
      await setupCuratedGoods();
      return service.createOrder({ userId: USER_ID, goodsId: GOODS_ID });
    }

    it('"sent" → "refunded" + 복원 행', async () => {
      const order = await createSentOrder();
      expect(order.send_status).toBe('sent');

      const refunded = await service.refund(order.id);

      expect(refunded.send_status).toBe('refunded');
      // 차감 1 + 복원 1
      expect(pointActions).toHaveLength(2);
      expect(pointActions[1]).toMatchObject({
        userId: USER_ID,
        amount: +POINT_PRICE,
        type: 'GIFTICON_PURCHASE',
      });
      expect(pointActions[1].additionalData).toMatchObject({
        original_point_action_id: pointActions[0].id,
        reason: 'admin_refund',
      });
    });

    it('"pending" → BadRequestException', async () => {
      await setupCuratedGoods();
      const exchange = await exchangeRepo.insert({
        user_id: USER_ID,
        point_action_id: 1,
        amount: POINT_PRICE,
        smartcon_goods_id: GOODS_ID,
        tr_id: 'cashmore-pending-1',
      });

      await expect(service.refund(exchange.id)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('"send_failed" → BadRequestException', async () => {
      await setupCuratedGoods();
      couponCreate.mockResolvedValueOnce({
        RESULTCODE: '99',
        RESULTMSG: 'fail',
      });
      const order = await service.createOrder({
        userId: USER_ID,
        goodsId: GOODS_ID,
      });
      expect(order.send_status).toBe('send_failed');

      await expect(service.refund(order.id)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('"refunded" → BadRequestException (이미 환불)', async () => {
      const order = await createSentOrder();
      await service.refund(order.id);

      await expect(service.refund(order.id)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('미존재 id → NotFoundException', async () => {
      await expect(service.refund(999_999)).rejects.toThrow(NotFoundException);
    });
  });

  // === 카테고리 5: TR_ID ===
  describe('TR_ID', () => {
    it('형식: cashmore + 17자 timestamp + 4자 hex', async () => {
      await setupCuratedGoods();
      await service.createOrder({ userId: USER_ID, goodsId: GOODS_ID });

      const trId = couponCreate.mock.calls[0][0].trId;
      expect(trId).toMatch(/^cashmore\d{17}[0-9a-f]{4}$/);
      expect(trId.length).toBeLessThanOrEqual(50);
    });

    it('동시 다중 호출 → TR_ID 모두 다름', async () => {
      await setupCuratedGoods();

      const orders = await Promise.all([
        service.createOrder({ userId: USER_ID, goodsId: GOODS_ID }),
        service.createOrder({ userId: USER_ID, goodsId: GOODS_ID }),
        service.createOrder({ userId: USER_ID, goodsId: GOODS_ID }),
      ]);

      const trIds = orders.map((o) => o.tr_id);
      expect(new Set(trIds).size).toBe(3);
    });
  });
});
