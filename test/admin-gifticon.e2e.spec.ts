import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getTestSupabaseAdminClient } from './supabase-client';
import { truncateAllTables } from './setup';

const ADMIN_API_KEY = process.env.BATCH_API_KEY ?? 'test-batch-api-key';
const EVENT_ID = '64385';

interface SeedGoodsInput {
  goods_id: string;
  brand_name?: string | null;
  goods_name?: string | null;
  price?: number | null;
  disc_price?: number | null;
  img_url_https?: string | null;
  cached_img_url?: string | null;
  is_active?: boolean;
}

async function seedGoods(
  supabase: ReturnType<typeof getTestSupabaseAdminClient>,
  inputs: SeedGoodsInput[],
): Promise<void> {
  const now = new Date().toISOString();
  const rows = inputs.map((it) => ({
    goods_id: it.goods_id,
    event_id: EVENT_ID,
    brand_name: it.brand_name ?? '컴포즈커피',
    goods_name: it.goods_name ?? `상품-${it.goods_id}`,
    msg: '안내',
    price: it.price ?? 1800,
    disc_price: it.disc_price ?? 1710,
    disc_rate: 5,
    extra_charge: 0,
    img_url: 'http://example/img.jpg',
    img_url_https: it.img_url_https ?? 'https://example/img.jpg',
    cached_img_url: it.cached_img_url ?? null,
    cached_img_at: it.cached_img_url ? now : null,
    goods_sale_type: 'BARCODE',
    goods_use_type: 'EXCHANGE',
    sc_limit_date: 30,
    b2c_item_no: null,
    raw_data: { GOODS_ID: it.goods_id },
    is_active: it.is_active ?? true,
    last_synced_at: now,
  }));
  const { error } = await supabase.from('smartcon_goods').insert(rows);
  if (error) throw error;
}

describe('Admin Gifticon (e2e) - Real DB', () => {
  let app: INestApplication;
  const supabase = getTestSupabaseAdminClient();

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

  describe('GET /admin/gifticon/products', () => {
    it('잘못된 API 키 → 401', async () => {
      await request(app.getHttpServer())
        .get('/admin/gifticon/products')
        .set('x-admin-api-key', 'wrong')
        .expect(401);
    });

    it('전체 상품 반환 — 큐레이션 안 된 상품은 id, point_price가 null', async () => {
      await seedGoods(supabase, [{ goods_id: 'A' }, { goods_id: 'B' }]);

      const response = await request(app.getHttpServer())
        .get(`/admin/gifticon/products`)
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(200);

      expect(response.body).toHaveLength(2);
      const a = response.body.find(
        (c: { goods_id: string }) => c.goods_id === 'A',
      );
      expect(a).toMatchObject({
        id: null,
        point_price: null,
        is_visible: false,
        is_active: true,
      });
    });

    it('cached_img_url이 있으면 그것을 img_url로 노출', async () => {
      await seedGoods(supabase, [
        {
          goods_id: 'A',
          img_url_https: 'https://orig/A.jpg',
          cached_img_url: 'https://cdn/A.jpg',
        },
      ]);

      const response = await request(app.getHttpServer())
        .get(`/admin/gifticon/products`)
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(200);

      const a = response.body.find(
        (c: { goods_id: string }) => c.goods_id === 'A',
      );
      expect(a.img_url).toBe('https://cdn/A.jpg');
    });

    it('단종 상품(is_active=false)도 포함되며 is_active 필드로 구분 가능', async () => {
      await seedGoods(supabase, [
        { goods_id: 'A', is_active: false },
        { goods_id: 'B', is_active: true },
      ]);

      const response = await request(app.getHttpServer())
        .get(`/admin/gifticon/products`)
        .set('x-admin-api-key', ADMIN_API_KEY)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(
        response.body.find((c: { goods_id: string }) => c.goods_id === 'A')
          .is_active,
      ).toBe(false);
    });
  });

  describe('PUT /admin/gifticon/products/:goodsId', () => {
    it('잘못된 API 키 → 401', async () => {
      await request(app.getHttpServer())
        .put('/admin/gifticon/products/A')
        .set('x-admin-api-key', 'wrong')
        .send({ point_price: 1500, is_visible: true })
        .expect(401);
    });

    it('처음 큐레이션 → 201/200, gifticon_products INSERT', async () => {
      await seedGoods(supabase, [{ goods_id: 'A' }]);

      const response = await request(app.getHttpServer())
        .put('/admin/gifticon/products/A')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .send({ point_price: 1500, is_visible: true });

      expect(response.status).toBeLessThan(300);
      expect(response.body).toMatchObject({
        smartcon_goods_id: 'A',
        point_price: 1500,
        is_visible: true,
      });

      const { data } = await supabase
        .from('gifticon_products')
        .select('*')
        .eq('smartcon_goods_id', 'A')
        .single();
      expect(data?.point_price).toBe(1500);
    });

    it('display_name 입력 시 저장 + 빈 문자열은 NULL', async () => {
      await seedGoods(supabase, [{ goods_id: 'A' }]);

      const r1 = await request(app.getHttpServer())
        .put('/admin/gifticon/products/A')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .send({
          point_price: 1500,
          is_visible: true,
          display_name: '아메리카노 ICE',
        });
      expect(r1.body.display_name).toBe('아메리카노 ICE');

      const r2 = await request(app.getHttpServer())
        .put('/admin/gifticon/products/A')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .send({
          point_price: 1500,
          is_visible: true,
          display_name: '',
        });
      expect(r2.body.display_name).toBeNull();
    });

    it('두 번째 호출 → UPDATE (id 유지)', async () => {
      await seedGoods(supabase, [{ goods_id: 'A' }]);

      const first = await request(app.getHttpServer())
        .put('/admin/gifticon/products/A')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .send({ point_price: 1500, is_visible: true });

      const second = await request(app.getHttpServer())
        .put('/admin/gifticon/products/A')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .send({ point_price: 2000, is_visible: false });

      expect(second.body.id).toBe(first.body.id);
      expect(second.body.point_price).toBe(2000);
      expect(second.body.is_visible).toBe(false);
    });

    it('존재하지 않는 goods_id → 404', async () => {
      await request(app.getHttpServer())
        .put('/admin/gifticon/products/UNKNOWN')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .send({ point_price: 1500, is_visible: true })
        .expect(404);
    });

    it('비활성 상품 → 404', async () => {
      await seedGoods(supabase, [{ goods_id: 'A', is_active: false }]);

      await request(app.getHttpServer())
        .put('/admin/gifticon/products/A')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .send({ point_price: 1500, is_visible: true })
        .expect(404);
    });

    it('reorder (브랜드 단위) → 해당 브랜드만 display_order 부여, 다른 브랜드 영향 X', async () => {
      await seedGoods(supabase, [
        { goods_id: 'A', brand_name: '컴포즈커피' },
        { goods_id: 'B', brand_name: '컴포즈커피' },
        { goods_id: 'X', brand_name: 'BHC' },
        { goods_id: 'Y', brand_name: 'BHC' },
      ]);
      for (const id of ['A', 'B', 'X', 'Y']) {
        await request(app.getHttpServer())
          .put(`/admin/gifticon/products/${id}`)
          .set('x-admin-api-key', ADMIN_API_KEY)
          .send({ point_price: 1000, is_visible: true });
      }

      // BHC 먼저 정렬해서 다른 브랜드 값 확보
      await request(app.getHttpServer())
        .put('/admin/gifticon/products/order')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .send({ brand: 'BHC', goodsIds: ['Y', 'X'] })
        .expect(200);

      // 잘못된 API 키
      await request(app.getHttpServer())
        .put('/admin/gifticon/products/order')
        .set('x-admin-api-key', 'wrong')
        .send({ brand: '컴포즈커피', goodsIds: ['B', 'A'] })
        .expect(401);

      // 컴포즈커피 정렬
      await request(app.getHttpServer())
        .put('/admin/gifticon/products/order')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .send({ brand: '컴포즈커피', goodsIds: ['B', 'A'] })
        .expect(200);

      const { data: rows } = await supabase
        .from('gifticon_products')
        .select('smartcon_goods_id, display_order')
        .order('smartcon_goods_id');
      const byId = new Map(
        rows?.map((r) => [r.smartcon_goods_id, r.display_order]),
      );
      // 컴포즈커피: B=1, A=2
      expect(byId.get('B')).toBe(1);
      expect(byId.get('A')).toBe(2);
      // BHC는 그대로: Y=1, X=2
      expect(byId.get('Y')).toBe(1);
      expect(byId.get('X')).toBe(2);
    });

    it('다른 브랜드 goodsId가 섞이면 400 (display_order 변경 X)', async () => {
      await seedGoods(supabase, [
        { goods_id: 'A', brand_name: '컴포즈커피' },
        { goods_id: 'X', brand_name: 'BHC' },
      ]);
      for (const id of ['A', 'X']) {
        await request(app.getHttpServer())
          .put(`/admin/gifticon/products/${id}`)
          .set('x-admin-api-key', ADMIN_API_KEY)
          .send({ point_price: 1000, is_visible: true });
      }

      await request(app.getHttpServer())
        .put('/admin/gifticon/products/order')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .send({ brand: '컴포즈커피', goodsIds: ['A', 'X'] })
        .expect(400);

      const { data: a } = await supabase
        .from('gifticon_products')
        .select('display_order')
        .eq('smartcon_goods_id', 'A')
        .single();
      expect(a?.display_order).toBeNull();
    });

    it('존재하지 않는 브랜드 → 404', async () => {
      await request(app.getHttpServer())
        .put('/admin/gifticon/products/order')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .send({ brand: '없는브랜드', goodsIds: [] })
        .expect(404);
    });

    it('잘못된 body (음수 point_price) → 400', async () => {
      await seedGoods(supabase, [{ goods_id: 'A' }]);

      await request(app.getHttpServer())
        .put('/admin/gifticon/products/A')
        .set('x-admin-api-key', ADMIN_API_KEY)
        .send({ point_price: -1, is_visible: true })
        .expect(400);
    });
  });
});
