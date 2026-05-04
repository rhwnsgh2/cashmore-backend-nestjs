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
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { SmartconApiService } from '../src/smartcon/smartcon-api.service';
import { GIFTICON_IMAGE_STORAGE } from '../src/storage/interfaces/gifticon-image-storage.interface';
import { StubGifticonImageStorage } from '../src/storage/stub-gifticon-image-storage.service';
import { getTestSupabaseAdminClient } from './supabase-client';
import { truncateAllTables } from './setup';
import type { SmartconGoodsResponseItem } from '../src/smartcon/dto/smartcon-goods.dto';

const ADMIN_API_KEY = process.env.BATCH_API_KEY ?? 'test-batch-api-key';

function makeItem(
  goodsId: string,
  overrides: Partial<SmartconGoodsResponseItem> = {},
): SmartconGoodsResponseItem {
  return {
    GOODS_ID: goodsId,
    BRAND_NAME: '컴포즈커피',
    GOODS_NAME: `상품-${goodsId}`,
    MSG: '안내',
    PRICE: 1800,
    DISC_PRICE: 1710,
    DISC_RATE: 5,
    EXTRA_CHARGE: 0,
    IMG_URL: 'http://example/img.jpg',
    IMG_URL_HTTPS: 'https://example/img.jpg',
    GOODS_SALE_TYPE: 'BARCODE',
    GOODS_USE_TYPE: 'EXCHANGE',
    SC_LIMIT_DATE: 30,
    B2C_ITEM_NO: null,
    ...overrides,
  };
}

describe('Admin Smartcon (e2e) - Real DB', () => {
  let app: INestApplication;
  const supabase = getTestSupabaseAdminClient();
  const getEventGoods = vi.fn();
  const imageStorage = new StubGifticonImageStorage();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SmartconApiService)
      .useValue({ getEventGoods })
      .overrideProvider(GIFTICON_IMAGE_STORAGE)
      .useValue(imageStorage)
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
    getEventGoods.mockReset();
    imageStorage.clear();
  });

  describe('POST /admin/smartcon/sync', () => {
    it('잘못된 API 키 → 401', async () => {
      await request(app.getHttpServer())
        .post('/admin/smartcon/sync')
        .set('x-admin-api-key', 'wrong-key')
        .expect(401);
    });

    it('API 키 미전송 → 401', async () => {
      await request(app.getHttpServer())
        .post('/admin/smartcon/sync')
        .expect(401);
    });

    it('신규 응답 → smartcon_goods에 INSERT', async () => {
      getEventGoods.mockResolvedValueOnce([
        makeItem('A', { PRICE: 1000 }),
        makeItem('B', { PRICE: 2000 }),
      ]);

      const response = await request(app.getHttpServer())
        .post('/admin/smartcon/sync?eventId=64385')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(201);

      expect(response.body).toEqual({
        fetched: 2,
        upserted: 2,
        deactivated: 0,
        imagesCached: 2,
        imagesFailed: 0,
      });

      const { data: rows } = await supabase
        .from('smartcon_goods')
        .select('*')
        .eq('event_id', '64385')
        .order('goods_id');

      expect(rows).toHaveLength(2);
      expect(rows?.[0]).toMatchObject({
        goods_id: 'A',
        event_id: '64385',
        price: 1000,
        is_active: true,
        cached_img_url: 'https://stub-cdn.example/gifticon/A',
      });
      expect(rows?.[1]).toMatchObject({
        goods_id: 'B',
        price: 2000,
        is_active: true,
        cached_img_url: 'https://stub-cdn.example/gifticon/B',
      });
      expect(rows?.[0].cached_img_at).not.toBeNull();
      expect(imageStorage.uploads).toEqual([
        { path: 'gifticon/A', sourceUrl: 'https://example/img.jpg' },
        { path: 'gifticon/B', sourceUrl: 'https://example/img.jpg' },
      ]);
    });

    it('동일 goods_id 재호출 → UPSERT (가격 갱신)', async () => {
      getEventGoods.mockResolvedValueOnce([makeItem('A', { PRICE: 1000 })]);
      await request(app.getHttpServer())
        .post('/admin/smartcon/sync?eventId=64385')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(201);

      getEventGoods.mockResolvedValueOnce([makeItem('A', { PRICE: 9999 })]);
      const response = await request(app.getHttpServer())
        .post('/admin/smartcon/sync?eventId=64385')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(201);

      expect(response.body).toEqual({
        fetched: 1,
        upserted: 1,
        deactivated: 0,
        imagesCached: 0,
        imagesFailed: 0,
      });

      const { data: row } = await supabase
        .from('smartcon_goods')
        .select('*')
        .eq('goods_id', 'A')
        .single();
      expect(row?.price).toBe(9999);
      // 첫 호출에서 캐시되었으므로 두 번째 호출에서는 다시 받지 않음
      expect(imageStorage.uploads).toHaveLength(1);
    });

    it('응답에서 빠진 상품은 is_active=false', async () => {
      getEventGoods.mockResolvedValueOnce([makeItem('A'), makeItem('B')]);
      await request(app.getHttpServer())
        .post('/admin/smartcon/sync?eventId=64385')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(201);

      getEventGoods.mockResolvedValueOnce([makeItem('A')]);
      const response = await request(app.getHttpServer())
        .post('/admin/smartcon/sync?eventId=64385')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(201);

      expect(response.body).toEqual({
        fetched: 1,
        upserted: 1,
        deactivated: 1,
        imagesCached: 0,
        imagesFailed: 0,
      });

      const { data: rowA } = await supabase
        .from('smartcon_goods')
        .select('is_active')
        .eq('goods_id', 'A')
        .single();
      const { data: rowB } = await supabase
        .from('smartcon_goods')
        .select('is_active')
        .eq('goods_id', 'B')
        .single();
      expect(rowA?.is_active).toBe(true);
      expect(rowB?.is_active).toBe(false);
    });

    it('빈 응답 → EVENT의 모든 활성 상품이 비활성화', async () => {
      getEventGoods.mockResolvedValueOnce([makeItem('A'), makeItem('B')]);
      await request(app.getHttpServer())
        .post('/admin/smartcon/sync?eventId=64385')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(201);

      getEventGoods.mockResolvedValueOnce([]);
      const response = await request(app.getHttpServer())
        .post('/admin/smartcon/sync?eventId=64385')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(201);

      expect(response.body).toEqual({
        fetched: 0,
        upserted: 0,
        deactivated: 2,
        imagesCached: 0,
        imagesFailed: 0,
      });

      const { data: rows } = await supabase
        .from('smartcon_goods')
        .select('is_active')
        .eq('event_id', '64385');
      expect(rows).toHaveLength(2);
      expect(rows?.every((r) => r.is_active === false)).toBe(true);
    });

    it('다른 EVENT 상품은 비활성화되지 않는다', async () => {
      // EVENT 64385에 A 등록
      getEventGoods.mockResolvedValueOnce([makeItem('A')]);
      await request(app.getHttpServer())
        .post('/admin/smartcon/sync?eventId=64385')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(201);

      // EVENT 99999 빈 응답
      getEventGoods.mockResolvedValueOnce([]);
      const response = await request(app.getHttpServer())
        .post('/admin/smartcon/sync?eventId=99999')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(201);

      expect(response.body).toEqual({
        fetched: 0,
        upserted: 0,
        deactivated: 0,
        imagesCached: 0,
        imagesFailed: 0,
      });

      const { data: rowA } = await supabase
        .from('smartcon_goods')
        .select('is_active')
        .eq('goods_id', 'A')
        .single();
      expect(rowA?.is_active).toBe(true);
    });

    it('raw_data에 응답 원본이 그대로 박제된다', async () => {
      const item = makeItem('A', { PRICE: 1234, DISC_PRICE: 1100 });
      getEventGoods.mockResolvedValueOnce([item]);

      await request(app.getHttpServer())
        .post('/admin/smartcon/sync?eventId=64385')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(201);

      const { data: row } = await supabase
        .from('smartcon_goods')
        .select('raw_data')
        .eq('goods_id', 'A')
        .single();

      expect(row?.raw_data).toEqual(item);
    });

    it('비활성화된 상품이 응답에 다시 들어오면 is_active=true로 복구된다', async () => {
      getEventGoods.mockResolvedValueOnce([makeItem('A')]);
      await request(app.getHttpServer())
        .post('/admin/smartcon/sync?eventId=64385')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(201);

      // A 비활성화
      getEventGoods.mockResolvedValueOnce([]);
      await request(app.getHttpServer())
        .post('/admin/smartcon/sync?eventId=64385')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(201);

      // 다시 A 응답
      getEventGoods.mockResolvedValueOnce([makeItem('A')]);
      const response = await request(app.getHttpServer())
        .post('/admin/smartcon/sync?eventId=64385')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(201);

      expect(response.body).toEqual({
        fetched: 1,
        upserted: 1,
        deactivated: 0,
        imagesCached: 0,
        imagesFailed: 0,
      });
      const { data: row } = await supabase
        .from('smartcon_goods')
        .select('is_active')
        .eq('goods_id', 'A')
        .single();
      expect(row?.is_active).toBe(true);
    });

    it('img_url_https가 없는 상품은 캐시되지 않는다', async () => {
      getEventGoods.mockResolvedValueOnce([
        makeItem('A', { IMG_URL_HTTPS: null }),
      ]);

      const response = await request(app.getHttpServer())
        .post('/admin/smartcon/sync?eventId=64385')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(201);

      expect(response.body).toEqual({
        fetched: 1,
        upserted: 1,
        deactivated: 0,
        imagesCached: 0,
        imagesFailed: 0,
      });
      expect(imageStorage.uploads).toHaveLength(0);

      const { data: row } = await supabase
        .from('smartcon_goods')
        .select('cached_img_url, cached_img_at')
        .eq('goods_id', 'A')
        .single();
      expect(row?.cached_img_url).toBeNull();
      expect(row?.cached_img_at).toBeNull();
    });
  });
});
