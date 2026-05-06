import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getTestSupabaseAdminClient } from './supabase-client';
import { truncateAllTables } from './setup';
import { createTestUser, TestUser } from './helpers/user.helper';
import { generateTestToken } from './helpers/auth.helper';

const EVENT_ID = '64385';

interface SeedGoodsInput {
  goods_id: string;
  brand_name?: string | null;
  goods_name?: string | null;
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
    price: 1800,
    disc_price: 1710,
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

async function curate(
  supabase: ReturnType<typeof getTestSupabaseAdminClient>,
  goodsId: string,
  pointPrice: number,
  isVisible: boolean,
): Promise<void> {
  const { error } = await supabase.from('gifticon_products').insert({
    smartcon_goods_id: goodsId,
    point_price: pointPrice,
    is_visible: isVisible,
  });
  if (error) throw error;
}

describe('Gifticon (e2e) - Real DB', () => {
  let app: INestApplication;
  const supabase = getTestSupabaseAdminClient();
  let testUser: TestUser;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
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
  });

  describe('GET /gifticon/products', () => {
    it('인증 없이 호출 → 401', async () => {
      await request(app.getHttpServer()).get('/gifticon/products').expect(401);
    });

    it('큐레이션 안 된 상품은 반환되지 않는다', async () => {
      await seedGoods(supabase, [{ goods_id: 'A' }]);
      // gifticon_products 행 없음

      const response = await request(app.getHttpServer())
        .get('/gifticon/products')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('is_visible=true && is_active=true인 상품만 반환', async () => {
      await seedGoods(supabase, [
        { goods_id: 'A' },
        { goods_id: 'B' },
        { goods_id: 'C', is_active: false }, // 단종
      ]);
      await curate(supabase, 'A', 1500, true);
      await curate(supabase, 'B', 2000, false); // 노출 OFF
      await curate(supabase, 'C', 300, true); // 단종이라 제외

      const response = await request(app.getHttpServer())
        .get('/gifticon/products')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        goods_id: 'A',
        point_price: 1500,
        brand_name: '컴포즈커피',
        original_price: 1800, // smartcon_goods.price
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
      await curate(supabase, 'A', 1500, true);

      const response = await request(app.getHttpServer())
        .get('/gifticon/products')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body[0].img_url).toBe('https://cdn/A.jpg');
    });

    it('id 오름차순으로 정렬된다', async () => {
      await seedGoods(supabase, [{ goods_id: 'A' }, { goods_id: 'B' }]);
      // B를 먼저 큐레이션 → B.id < A.id
      await curate(supabase, 'B', 200, true);
      await curate(supabase, 'A', 1500, true);

      const response = await request(app.getHttpServer())
        .get('/gifticon/products')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(
        response.body.map((p: { goods_id: string }) => p.goods_id),
      ).toEqual(['B', 'A']);
    });
  });
});
