import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getTestSupabaseAdminClient } from './supabase-client';
import { truncateAllTables } from './setup';

describe('Coupang Partners API (e2e)', () => {
  let app: INestApplication;
  const supabase = getTestSupabaseAdminClient();

  const validPostback = {
    afcode: 'AF000001',
    subid: 'cashmore',
    os: 'Android',
    adid: '12345-abcde-67890',
    click_id: 'click-001',
    order_time: '2026-03-27 12:00:00',
    order_price: 29900,
    purchase_cancel: 'purchase',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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
  });

  describe('POST /coupang/postback', () => {
    it('정상 포스트백 수신 시 result: S를 반환한다', async () => {
      const response = await request(app.getHttpServer())
        .post('/coupang/postback')
        .send(validPostback)
        .expect(200);

      expect(response.body).toEqual({ result: 'S', message: 'OK' });
    });

    it('포스트백 데이터가 coupang_postbacks 테이블에 저장된다', async () => {
      await request(app.getHttpServer())
        .post('/coupang/postback')
        .send(validPostback)
        .expect(200);

      const { data } = await supabase
        .from('coupang_postbacks')
        .select('*')
        .single();

      expect(data).not.toBeNull();
      expect(data!.afcode).toBe('AF000001');
      expect(data!.subid).toBe('cashmore');
      expect(data!.os).toBe('Android');
      expect(data!.adid).toBe('12345-abcde-67890');
      expect(data!.click_id).toBe('click-001');
      expect(data!.order_time).toBe('2026-03-27 12:00:00');
      expect(data!.order_price).toBe(29900);
      expect(data!.purchase_cancel).toBe('purchase');
    });

    it('cancel 포스트백도 정상 저장된다', async () => {
      await request(app.getHttpServer())
        .post('/coupang/postback')
        .send({ ...validPostback, purchase_cancel: 'cancel' })
        .expect(200);

      const { data } = await supabase
        .from('coupang_postbacks')
        .select('*')
        .single();

      expect(data!.purchase_cancel).toBe('cancel');
    });

    it('click_id가 빈 문자열이어도 저장된다', async () => {
      await request(app.getHttpServer())
        .post('/coupang/postback')
        .send({ ...validPostback, click_id: '' })
        .expect(200);

      const { data } = await supabase
        .from('coupang_postbacks')
        .select('*')
        .single();

      expect(data!.click_id).toBe('');
    });

    it('order_price가 0이어도 저장된다', async () => {
      await request(app.getHttpServer())
        .post('/coupang/postback')
        .send({ ...validPostback, order_price: 0 })
        .expect(200);

      const { data } = await supabase
        .from('coupang_postbacks')
        .select('*')
        .single();

      expect(data!.order_price).toBe(0);
    });

    it('여러 포스트백을 연속 수신하면 모두 개별 저장된다', async () => {
      await request(app.getHttpServer())
        .post('/coupang/postback')
        .send(validPostback)
        .expect(200);

      await request(app.getHttpServer())
        .post('/coupang/postback')
        .send({ ...validPostback, afcode: 'AF000002', order_price: 50000 })
        .expect(200);

      await request(app.getHttpServer())
        .post('/coupang/postback')
        .send({
          ...validPostback,
          afcode: 'AF000003',
          purchase_cancel: 'cancel',
        })
        .expect(200);

      const { data } = await supabase
        .from('coupang_postbacks')
        .select('*')
        .order('id', { ascending: true });

      expect(data).toHaveLength(3);
      expect(data![0].afcode).toBe('AF000001');
      expect(data![1].afcode).toBe('AF000002');
      expect(data![1].order_price).toBe(50000);
      expect(data![2].afcode).toBe('AF000003');
      expect(data![2].purchase_cancel).toBe('cancel');
    });

    it('iOS 포스트백도 정상 처리된다', async () => {
      await request(app.getHttpServer())
        .post('/coupang/postback')
        .send({
          ...validPostback,
          os: 'iOS',
          adid: 'AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE',
        })
        .expect(200);

      const { data } = await supabase
        .from('coupang_postbacks')
        .select('*')
        .single();

      expect(data!.os).toBe('iOS');
      expect(data!.adid).toBe('AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE');
    });

    it('인증 없이 요청해도 200을 반환한다 (인증 불필요)', async () => {
      const response = await request(app.getHttpServer())
        .post('/coupang/postback')
        .send(validPostback)
        .expect(200);

      expect(response.body.result).toBe('S');
    });

    it('created_at이 자동으로 설정된다', async () => {
      const before = new Date();

      await request(app.getHttpServer())
        .post('/coupang/postback')
        .send(validPostback)
        .expect(200);

      const after = new Date();

      const { data } = await supabase
        .from('coupang_postbacks')
        .select('*')
        .single();

      const createdAt = new Date(data!.created_at);
      expect(createdAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime() - 1000,
      );
      expect(createdAt.getTime()).toBeLessThanOrEqual(after.getTime() + 1000);
    });

    it('동일한 adid로 purchase와 cancel이 각각 저장된다', async () => {
      await request(app.getHttpServer())
        .post('/coupang/postback')
        .send(validPostback)
        .expect(200);

      await request(app.getHttpServer())
        .post('/coupang/postback')
        .send({ ...validPostback, purchase_cancel: 'cancel' })
        .expect(200);

      const { data } = await supabase
        .from('coupang_postbacks')
        .select('*')
        .eq('adid', validPostback.adid)
        .order('id', { ascending: true });

      expect(data).toHaveLength(2);
      expect(data![0].purchase_cancel).toBe('purchase');
      expect(data![1].purchase_cancel).toBe('cancel');
    });

    it('큰 주문 금액도 정상 저장된다', async () => {
      await request(app.getHttpServer())
        .post('/coupang/postback')
        .send({ ...validPostback, order_price: 9999999 })
        .expect(200);

      const { data } = await supabase
        .from('coupang_postbacks')
        .select('*')
        .single();

      expect(data!.order_price).toBe(9999999);
    });

    // Validation 테스트
    it('afcode가 누락되면 400을 반환한다', async () => {
      const { afcode: _afcode, ...dto } = validPostback;

      await request(app.getHttpServer())
        .post('/coupang/postback')
        .send(dto)
        .expect(400);
    });

    it('order_price가 문자열이면 400을 반환한다', async () => {
      await request(app.getHttpServer())
        .post('/coupang/postback')
        .send({ ...validPostback, order_price: 'not-a-number' })
        .expect(400);
    });

    it('purchase_cancel이 purchase/cancel 외의 값이면 400을 반환한다', async () => {
      await request(app.getHttpServer())
        .post('/coupang/postback')
        .send({ ...validPostback, purchase_cancel: 'refund' })
        .expect(400);
    });

    it('빈 body로 요청하면 400을 반환한다', async () => {
      await request(app.getHttpServer())
        .post('/coupang/postback')
        .send({})
        .expect(400);
    });
  });
});
