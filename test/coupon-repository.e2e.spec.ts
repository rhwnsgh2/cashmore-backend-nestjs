import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { COUPON_EXCHANGE_REPOSITORY } from '../src/gifticon/interfaces/coupon-exchange-repository.interface';
import type { ICouponExchangeRepository } from '../src/gifticon/interfaces/coupon-exchange-repository.interface';
import { COUPON_SEND_LOG_REPOSITORY } from '../src/gifticon/interfaces/coupon-send-log-repository.interface';
import type { ICouponSendLogRepository } from '../src/gifticon/interfaces/coupon-send-log-repository.interface';
import { getTestSupabaseAdminClient } from './supabase-client';
import { truncateAllTables } from './setup';
import { createTestUser, TestUser } from './helpers/user.helper';

const EVENT_ID = '64385';

async function seedGoods(
  supabase: ReturnType<typeof getTestSupabaseAdminClient>,
  goodsId: string,
): Promise<void> {
  const { error } = await supabase.from('smartcon_goods').insert({
    goods_id: goodsId,
    event_id: EVENT_ID,
    raw_data: { GOODS_ID: goodsId },
    is_active: true,
  });
  if (error) throw error;
}

describe('Coupon Repositories (e2e) - Real DB', () => {
  let app: INestApplication;
  let exchangeRepo: ICouponExchangeRepository;
  let sendLogRepo: ICouponSendLogRepository;
  const supabase = getTestSupabaseAdminClient();
  let testUser: TestUser;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    exchangeRepo = app.get<ICouponExchangeRepository>(
      COUPON_EXCHANGE_REPOSITORY,
    );
    sendLogRepo = app.get<ICouponSendLogRepository>(COUPON_SEND_LOG_REPOSITORY);
  });

  afterAll(async () => {
    await truncateAllTables();
    await app.close();
  });

  beforeEach(async () => {
    await truncateAllTables();
    testUser = await createTestUser(supabase);
    await seedGoods(supabase, 'A');
  });

  describe('CouponExchangeRepository', () => {
    it('insert → 기본값(send_status="pending", null들) 채워서 반환', async () => {
      const row = await exchangeRepo.insert({
        user_id: testUser.id,
        point_action_id: null,
        amount: 1500,
        smartcon_goods_id: 'A',
        tr_id: 'cashmore-tr-1',
      });

      expect(row).toMatchObject({
        user_id: testUser.id,
        point_action_id: null,
        amount: 1500,
        smartcon_goods_id: 'A',
        tr_id: 'cashmore-tr-1',
        send_status: 'pending',
        order_id: null,
        barcode_num: null,
      });
      expect(row.id).toBeGreaterThan(0);
    });

    it('동일 tr_id 두 번 insert → 두 번째는 UNIQUE 위반', async () => {
      await exchangeRepo.insert({
        user_id: testUser.id,
        point_action_id: null,
        amount: 1000,
        smartcon_goods_id: 'A',
        tr_id: 'cashmore-tr-2',
      });

      await expect(
        exchangeRepo.insert({
          user_id: testUser.id,
          point_action_id: null,
          amount: 2000,
          smartcon_goods_id: 'A',
          tr_id: 'cashmore-tr-2',
        }),
      ).rejects.toThrow();
    });

    it('updateSendResult → status + 응답 필드 갱신, updated_at 변경', async () => {
      const row = await exchangeRepo.insert({
        user_id: testUser.id,
        point_action_id: null,
        amount: 1500,
        smartcon_goods_id: 'A',
        tr_id: 'cashmore-tr-3',
      });

      const updated = await exchangeRepo.updateSendResult(row.id, {
        send_status: 'sent',
        order_id: 'SC0001',
        barcode_num: '111122223333',
        exp_date: '2026-06-05',
        result_code: '00',
        result_msg: '처리완료',
      });

      expect(updated).toMatchObject({
        id: row.id,
        send_status: 'sent',
        order_id: 'SC0001',
        barcode_num: '111122223333',
        exp_date: '2026-06-05',
        result_code: '00',
        result_msg: '처리완료',
      });
      expect(updated.updated_at >= row.updated_at).toBe(true);
    });

    it('잘못된 send_status → CHECK constraint 위반', async () => {
      const row = await exchangeRepo.insert({
        user_id: testUser.id,
        point_action_id: null,
        amount: 1500,
        smartcon_goods_id: 'A',
        tr_id: 'cashmore-tr-4',
      });

      await expect(
        exchangeRepo.updateSendResult(row.id, {
          send_status: 'unknown' as 'sent',
        }),
      ).rejects.toThrow();
    });

    it('findById → 존재하면 반환, 없으면 null', async () => {
      const row = await exchangeRepo.insert({
        user_id: testUser.id,
        point_action_id: null,
        amount: 1500,
        smartcon_goods_id: 'A',
        tr_id: 'cashmore-tr-5',
      });

      expect(await exchangeRepo.findById(row.id)).toMatchObject({ id: row.id });
      expect(await exchangeRepo.findById(999_999)).toBeNull();
    });

    it('findByUserId → 최신순, limit 적용', async () => {
      const r1 = await exchangeRepo.insert({
        user_id: testUser.id,
        point_action_id: null,
        amount: 1000,
        smartcon_goods_id: 'A',
        tr_id: 'cashmore-tr-list-1',
      });
      // created_at 차이 보장
      await new Promise((r) => setTimeout(r, 10));
      const r2 = await exchangeRepo.insert({
        user_id: testUser.id,
        point_action_id: null,
        amount: 2000,
        smartcon_goods_id: 'A',
        tr_id: 'cashmore-tr-list-2',
      });

      const list = await exchangeRepo.findByUserId(testUser.id);
      expect(list.map((r) => r.id)).toEqual([r2.id, r1.id]);

      const limited = await exchangeRepo.findByUserId(testUser.id, 1);
      expect(limited).toHaveLength(1);
      expect(limited[0].id).toBe(r2.id);
    });
  });

  describe('CouponSendLogRepository', () => {
    it('insert → 행 생성, sent_at 자동, FK 연결', async () => {
      const exchange = await exchangeRepo.insert({
        user_id: testUser.id,
        point_action_id: null,
        amount: 1500,
        smartcon_goods_id: 'A',
        tr_id: 'cashmore-tr-log-1',
      });

      const log = await sendLogRepo.insert(exchange.id, '01012345678');

      expect(log).toMatchObject({
        exchange_id: exchange.id,
        receiver_phone: '01012345678',
      });
      expect(log.id).toBeGreaterThan(0);
      expect(log.sent_at).toBeTruthy();
    });

    it('한 exchange에 여러 send_logs 누적 가능', async () => {
      const exchange = await exchangeRepo.insert({
        user_id: testUser.id,
        point_action_id: null,
        amount: 1500,
        smartcon_goods_id: 'A',
        tr_id: 'cashmore-tr-log-2',
      });

      await sendLogRepo.insert(exchange.id, '01011111111');
      await new Promise((r) => setTimeout(r, 5));
      await sendLogRepo.insert(exchange.id, '01022222222');

      const logs = await sendLogRepo.findByExchangeId(exchange.id);
      expect(logs).toHaveLength(2);
      expect(logs[0].receiver_phone).toBe('01011111111');
      expect(logs[1].receiver_phone).toBe('01022222222');
    });

    it('exchange 삭제 시 send_logs도 CASCADE', async () => {
      const exchange = await exchangeRepo.insert({
        user_id: testUser.id,
        point_action_id: null,
        amount: 1500,
        smartcon_goods_id: 'A',
        tr_id: 'cashmore-tr-log-3',
      });
      await sendLogRepo.insert(exchange.id, '01012345678');

      const { error } = await supabase
        .from('coupon_exchanges')
        .delete()
        .eq('id', exchange.id);
      expect(error).toBeNull();

      const logs = await sendLogRepo.findByExchangeId(exchange.id);
      expect(logs).toHaveLength(0);
    });

    it('존재하지 않는 exchange_id로 insert → FK 위반', async () => {
      await expect(
        sendLogRepo.insert(999_999, '01012345678'),
      ).rejects.toThrow();
    });
  });
});
