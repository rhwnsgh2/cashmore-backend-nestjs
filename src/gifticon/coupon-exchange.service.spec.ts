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

  // === 카테고리 1: 주문 생성 (pending) ===
  describe('createOrder → pending (승인 대기)', () => {
    it('정상: status=pending, 스마트콘 호출 X, send_logs INSERT X', async () => {
      await setupCuratedGoods();

      const result = await service.createOrder({
        userId: USER_ID,
        goodsId: GOODS_ID,
      });

      expect(result.send_status).toBe('pending');
      expect(result.barcode_num).toBeNull();
      expect(result.exp_date).toBeNull();
      expect(couponCreate).not.toHaveBeenCalled();

      const logs = await sendLogRepo.findByExchangeId(result.id);
      expect(logs).toHaveLength(0);
    });

    it('차감 행 1개 INSERT (음수, type=GIFTICON_PURCHASE)', async () => {
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

    it('coupon_exchanges.amount = 호출 시점 point_price 박제', async () => {
      await setupCuratedGoods();
      const order = await service.createOrder({
        userId: USER_ID,
        goodsId: GOODS_ID,
      });

      expect(order.amount).toBe(POINT_PRICE);
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

  // === 카테고리 3: 승인 (approve) ===
  describe('approve (어드민 승인 → 스마트콘 발송)', () => {
    async function placePending() {
      await setupCuratedGoods();
      return service.createOrder({ userId: USER_ID, goodsId: GOODS_ID });
    }

    it('pending → 스마트콘 호출 → sent + send_logs INSERT', async () => {
      const order = await placePending();
      expect(order.send_status).toBe('pending');

      const result = await service.approve(order.id);

      expect(result.send_status).toBe('sent');
      expect(result.barcode_num).toBe('1234567890123');
      expect(result.order_id).toBe('SC0001');
      expect(result.exp_date).toBe('2026-06-05');
      expect(result.result_code).toBe('00');

      expect(couponCreate).toHaveBeenCalledTimes(1);
      const logs = await sendLogRepo.findByExchangeId(order.id);
      expect(logs).toHaveLength(1);
      expect(logs[0].receiver_phone).toBe(PHONE);
    });

    it('스마트콘에 createOrder의 tr_id 그대로 사용', async () => {
      const order = await placePending();
      await service.approve(order.id);

      const call = couponCreate.mock.calls[0][0];
      expect(call.trId).toBe(order.tr_id);
      expect(call.goodsId).toBe(GOODS_ID);
      expect(call.receiverMobile).toBe(PHONE);
    });

    it('contents에 display_name 우선 사용', async () => {
      await setupCuratedGoods();
      await productRepo.upsertCuration({
        smartcon_goods_id: GOODS_ID,
        point_price: POINT_PRICE,
        is_visible: true,
        display_name: '아메리카노 ICE',
      });
      const order = await service.createOrder({
        userId: USER_ID,
        goodsId: GOODS_ID,
      });
      await service.approve(order.id);

      const call = couponCreate.mock.calls[0][0];
      expect(call.contents).toBe(
        '[캐시모어]\n아메리카노 ICE 기프티콘이 도착했어요.',
      );
    });

    it('RESULTCODE=99 → send_failed + 자동 환불 (복원 행 INSERT)', async () => {
      const order = await placePending();
      couponCreate.mockResolvedValueOnce({
        RESULTCODE: '99',
        RESULTMSG: '잘못된 URL 입니다.',
      });

      const result = await service.approve(order.id);

      expect(result.send_status).toBe('send_failed');
      expect(result.result_code).toBe('99');
      expect(result.result_msg).toBe('잘못된 URL 입니다.');

      // 차감(1) + 복원(2)
      expect(pointActions).toHaveLength(2);
      expect(pointActions[0].amount).toBe(-POINT_PRICE);
      expect(pointActions[1].amount).toBe(+POINT_PRICE);
      expect(pointActions[1].additionalData).toMatchObject({
        original_point_action_id: pointActions[0].id,
        reason: 'send_failed',
      });
    });

    it('네트워크 에러 → send_failed + 환불, result_code=NETWORK_ERROR', async () => {
      const order = await placePending();
      couponCreate.mockRejectedValueOnce(new Error('connection timeout'));

      const result = await service.approve(order.id);

      expect(result.send_status).toBe('send_failed');
      expect(result.result_code).toBe('NETWORK_ERROR');
      expect(result.result_msg).toBe('connection timeout');
      expect(pointActions).toHaveLength(2);
      expect(pointActions[1].amount).toBe(+POINT_PRICE);
    });

    it('실패해도 send_logs는 INSERT (시도 사실 기록)', async () => {
      const order = await placePending();
      couponCreate.mockResolvedValueOnce({
        RESULTCODE: '52',
        RESULTMSG: '수신자 번호 오류',
      });

      const result = await service.approve(order.id);
      const logs = await sendLogRepo.findByExchangeId(result.id);
      expect(logs).toHaveLength(1);
    });

    it('이미 sent → BadRequestException (재승인 차단)', async () => {
      const order = await placePending();
      await service.approve(order.id);

      await expect(service.approve(order.id)).rejects.toThrow(
        BadRequestException,
      );
      expect(couponCreate).toHaveBeenCalledTimes(1);
    });

    it('rejected → BadRequestException', async () => {
      const order = await placePending();
      await service.reject(order.id);

      await expect(service.approve(order.id)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('미존재 id → NotFoundException', async () => {
      await expect(service.approve(999_999)).rejects.toThrow(NotFoundException);
    });

    it('승인 시점 phone 미등록 → BadRequestException, 스마트콘 호출 X', async () => {
      const order = await placePending();
      getPhone.mockResolvedValueOnce(null);

      await expect(service.approve(order.id)).rejects.toThrow(
        BadRequestException,
      );
      expect(couponCreate).not.toHaveBeenCalled();
    });
  });

  // === 카테고리 4: 거절 (reject) ===
  describe('reject (어드민 거절 → 환불)', () => {
    async function placePending() {
      await setupCuratedGoods();
      return service.createOrder({ userId: USER_ID, goodsId: GOODS_ID });
    }

    it('pending → rejected + 복원 행, 스마트콘 호출 X', async () => {
      const order = await placePending();
      const result = await service.reject(order.id, '재고 소진');

      expect(result.send_status).toBe('rejected');
      expect(result.result_code).toBe('ADMIN_REJECTED');
      expect(result.result_msg).toBe('재고 소진');

      expect(pointActions).toHaveLength(2);
      expect(pointActions[1].amount).toBe(+POINT_PRICE);
      expect(pointActions[1].additionalData).toMatchObject({
        original_point_action_id: pointActions[0].id,
        reason: 'admin_rejected',
      });
      expect(couponCreate).not.toHaveBeenCalled();
    });

    it('reason 미전송 → result_msg = null', async () => {
      const order = await placePending();
      const result = await service.reject(order.id);
      expect(result.result_msg).toBeNull();
    });

    it('net = 0 (차감 + 복원)', async () => {
      const order = await placePending();
      await service.reject(order.id);
      const net = pointActions.reduce((s, p) => s + p.amount, 0);
      expect(net).toBe(0);
    });

    it('sent → BadRequestException (이미 승인된 건은 reject 불가)', async () => {
      const order = await placePending();
      await service.approve(order.id);

      await expect(service.reject(order.id)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('이미 rejected → BadRequestException', async () => {
      const order = await placePending();
      await service.reject(order.id);

      await expect(service.reject(order.id)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('미존재 id → NotFoundException', async () => {
      await expect(service.reject(999_999)).rejects.toThrow(NotFoundException);
    });
  });

  // === 카테고리 5: 어드민 환불 (sent → refunded) ===
  describe('refund (sent → refunded)', () => {
    async function placeSentOrder() {
      await setupCuratedGoods();
      const o = await service.createOrder({
        userId: USER_ID,
        goodsId: GOODS_ID,
      });
      return service.approve(o.id);
    }

    it('"sent" → "refunded" + 복원 행', async () => {
      const order = await placeSentOrder();
      expect(order.send_status).toBe('sent');

      const refunded = await service.refund(order.id);
      expect(refunded.send_status).toBe('refunded');
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

    it('"pending" → BadRequestException (reject로 처리해야 함)', async () => {
      await setupCuratedGoods();
      const order = await service.createOrder({
        userId: USER_ID,
        goodsId: GOODS_ID,
      });

      await expect(service.refund(order.id)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('"send_failed" → BadRequestException (이미 환불됨)', async () => {
      await setupCuratedGoods();
      const order = await service.createOrder({
        userId: USER_ID,
        goodsId: GOODS_ID,
      });
      couponCreate.mockResolvedValueOnce({
        RESULTCODE: '99',
        RESULTMSG: 'fail',
      });
      await service.approve(order.id);

      await expect(service.refund(order.id)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('"rejected" → BadRequestException', async () => {
      await setupCuratedGoods();
      const order = await service.createOrder({
        userId: USER_ID,
        goodsId: GOODS_ID,
      });
      await service.reject(order.id);

      await expect(service.refund(order.id)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('"refunded" → BadRequestException', async () => {
      const order = await placeSentOrder();
      await service.refund(order.id);

      await expect(service.refund(order.id)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('미존재 id → NotFoundException', async () => {
      await expect(service.refund(999_999)).rejects.toThrow(NotFoundException);
    });
  });

  // === 카테고리 6: listByStatus (어드민 큐 조회) ===
  describe('listByStatus', () => {
    it('pending은 오래된 순(created_at ASC), sent/rejected는 제외', async () => {
      await setupCuratedGoods();
      const a = await service.createOrder({
        userId: USER_ID,
        goodsId: GOODS_ID,
      });
      await new Promise((r) => setTimeout(r, 5));
      const b = await service.createOrder({
        userId: USER_ID,
        goodsId: GOODS_ID,
      });
      await new Promise((r) => setTimeout(r, 5));
      const c = await service.createOrder({
        userId: USER_ID,
        goodsId: GOODS_ID,
      });

      // b는 승인 → sent, c는 거절 → rejected
      await service.approve(b.id);
      await service.reject(c.id);

      const pending = await service.listByStatus('pending');
      expect(pending.map((r) => r.id)).toEqual([a.id]);

      const sent = await service.listByStatus('sent');
      expect(sent.map((r) => r.id)).toEqual([b.id]);

      const rejected = await service.listByStatus('rejected');
      expect(rejected.map((r) => r.id)).toEqual([c.id]);
    });
  });

  // === 카테고리 7: TR_ID ===
  describe('TR_ID', () => {
    it('형식: cashmore + 17자 timestamp + 4자 hex', async () => {
      await setupCuratedGoods();
      const order = await service.createOrder({
        userId: USER_ID,
        goodsId: GOODS_ID,
      });
      expect(order.tr_id).toMatch(/^cashmore\d{17}[0-9a-f]{4}$/);
      expect(order.tr_id.length).toBeLessThanOrEqual(50);
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

  // === 카테고리 8: Idempotency Key ===
  describe('idempotencyKey', () => {
    const KEY = 'idem-550e8400-e29b-41d4';

    it('같은 키로 두 번 호출 → 같은 행 반환, 차감 1번만', async () => {
      await setupCuratedGoods();

      const first = await service.createOrder({
        userId: USER_ID,
        goodsId: GOODS_ID,
        idempotencyKey: KEY,
      });
      const second = await service.createOrder({
        userId: USER_ID,
        goodsId: GOODS_ID,
        idempotencyKey: KEY,
      });

      expect(second.id).toBe(first.id);
      expect(second.tr_id).toBe(first.tr_id);
      expect(pointActions).toHaveLength(1);
      // 승인 전이므로 스마트콘은 한 번도 호출 안됨
      expect(couponCreate).not.toHaveBeenCalled();
    });

    it('동시 호출 (race) → 한 행만 만들어지고 차감 1번', async () => {
      await setupCuratedGoods();

      const results = await Promise.all([
        service.createOrder({
          userId: USER_ID,
          goodsId: GOODS_ID,
          idempotencyKey: KEY,
        }),
        service.createOrder({
          userId: USER_ID,
          goodsId: GOODS_ID,
          idempotencyKey: KEY,
        }),
        service.createOrder({
          userId: USER_ID,
          goodsId: GOODS_ID,
          idempotencyKey: KEY,
        }),
      ]);

      const ids = new Set(results.map((r) => r.id));
      expect(ids.size).toBe(1);
      expect(pointActions).toHaveLength(1);
    });

    it('coupon_exchanges.idempotency_key 컬럼에 키 박제', async () => {
      await setupCuratedGoods();
      const order = await service.createOrder({
        userId: USER_ID,
        goodsId: GOODS_ID,
        idempotencyKey: KEY,
      });
      expect(order.idempotency_key).toBe(KEY);
    });

    it('다른 키 → 서로 다른 주문', async () => {
      await setupCuratedGoods();
      const a = await service.createOrder({
        userId: USER_ID,
        goodsId: GOODS_ID,
        idempotencyKey: 'k1',
      });
      const b = await service.createOrder({
        userId: USER_ID,
        goodsId: GOODS_ID,
        idempotencyKey: 'k2',
      });
      expect(a.id).not.toBe(b.id);
      expect(pointActions).toHaveLength(2);
    });

    it('승인 후 같은 키 재요청 → 기존 sent 행 그대로 반환', async () => {
      await setupCuratedGoods();
      const first = await service.createOrder({
        userId: USER_ID,
        goodsId: GOODS_ID,
        idempotencyKey: KEY,
      });
      await service.approve(first.id);

      const second = await service.createOrder({
        userId: USER_ID,
        goodsId: GOODS_ID,
        idempotencyKey: KEY,
      });
      expect(second.id).toBe(first.id);
      expect(second.send_status).toBe('sent');
      expect(couponCreate).toHaveBeenCalledTimes(1);
    });
  });
});
