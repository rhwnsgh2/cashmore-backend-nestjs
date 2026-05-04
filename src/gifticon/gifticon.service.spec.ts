import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GifticonService } from './gifticon.service';
import { GIFTICON_PRODUCT_REPOSITORY } from './interfaces/gifticon-product-repository.interface';
import { StubGifticonProductRepository } from './repositories/stub-gifticon-product.repository';
import { SMARTCON_GOODS_REPOSITORY } from '../smartcon/interfaces/smartcon-goods-repository.interface';
import { StubSmartconGoodsRepository } from '../smartcon/repositories/stub-smartcon-goods.repository';
import type { SmartconGoodsResponseItem } from '../smartcon/dto/smartcon-goods.dto';

const EVENT_ID = '64385';

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
    IMG_URL: 'http://example/img.jpg',
    IMG_URL_HTTPS: 'https://example/img.jpg',
    GOODS_SALE_TYPE: 'BARCODE',
    GOODS_USE_TYPE: 'EXCHANGE',
    SC_LIMIT_DATE: 30,
    B2C_ITEM_NO: null,
  };
}

describe('GifticonService', () => {
  let service: GifticonService;
  let productRepo: StubGifticonProductRepository;
  let smartconRepo: StubSmartconGoodsRepository;

  beforeEach(async () => {
    productRepo = new StubGifticonProductRepository();
    smartconRepo = new StubSmartconGoodsRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GifticonService,
        { provide: GIFTICON_PRODUCT_REPOSITORY, useValue: productRepo },
        { provide: SMARTCON_GOODS_REPOSITORY, useValue: smartconRepo },
      ],
    }).compile();

    service = module.get<GifticonService>(GifticonService);
  });

  describe('curate', () => {
    beforeEach(async () => {
      // smartcon_goods에 A 상품 셋업
      await smartconRepo.syncByEvent({
        eventId: EVENT_ID,
        items: [
          {
            goods_id: 'A',
            event_id: EVENT_ID,
            brand_name: '컴포즈커피',
            goods_name: '상품-A',
            msg: null,
            price: 1800,
            disc_price: 1710,
            disc_rate: 5,
            extra_charge: 0,
            img_url: null,
            img_url_https: null,
            goods_sale_type: null,
            goods_use_type: null,
            sc_limit_date: null,
            b2c_item_no: null,
            raw_data: makeRawItem('A'),
            last_synced_at: new Date().toISOString(),
          },
        ],
      });
      // stub product repo가 카탈로그 JOIN을 흉내내려면 goods 시드 필요
      productRepo.seedGoods([
        {
          goods_id: 'A',
          event_id: EVENT_ID,
          brand_name: '컴포즈커피',
          goods_name: '상품-A',
          msg: null,
          price: 1800,
          disc_price: 1710,
          img_url_https: 'https://example/img.jpg',
          cached_img_url: null,
          is_active: true,
        },
      ]);
    });

    it('처음 큐레이션 → INSERT', async () => {
      const result = await service.curate({
        goods_id: 'A',
        point_price: 1500,
        is_visible: true,
      });

      expect(result).toMatchObject({
        smartcon_goods_id: 'A',
        point_price: 1500,
        is_visible: true,
      });
      expect(result.id).toBeGreaterThan(0);
    });

    it('두 번째 호출 → UPDATE (id 유지)', async () => {
      const first = await service.curate({
        goods_id: 'A',
        point_price: 1500,
        is_visible: true,
      });
      const second = await service.curate({
        goods_id: 'A',
        point_price: 2000,
        is_visible: false,
      });

      expect(second.id).toBe(first.id);
      expect(second.point_price).toBe(2000);
      expect(second.is_visible).toBe(false);
    });

    it('존재하지 않는 goods_id → NotFoundException', async () => {
      await expect(
        service.curate({
          goods_id: 'UNKNOWN',
          point_price: 1500,
          is_visible: true,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('비활성 상품 → NotFoundException', async () => {
      // A 비활성화
      await smartconRepo.syncByEvent({ eventId: EVENT_ID, items: [] });

      await expect(
        service.curate({
          goods_id: 'A',
          point_price: 1500,
          is_visible: true,
        }),
      ).rejects.toThrow(/inactive/);
    });
  });

  describe('listCatalogForAdmin', () => {
    beforeEach(() => {
      productRepo.seedGoods([
        {
          goods_id: 'A',
          event_id: EVENT_ID,
          brand_name: '컴포즈커피',
          goods_name: '상품-A',
          msg: null,
          price: 1800,
          disc_price: 1710,
          img_url_https: 'https://example/A.jpg',
          cached_img_url: null,
          is_active: true,
        },
        {
          goods_id: 'B',
          event_id: EVENT_ID,
          brand_name: '이마트24',
          goods_name: '상품-B',
          msg: null,
          price: 300,
          disc_price: 285,
          img_url_https: 'https://example/B.jpg',
          cached_img_url: 'https://cdn/B.jpg',
          is_active: true,
        },
      ]);
    });

    it('전체 상품 반환 — 큐레이션 안 된 상품은 id, point_price가 null', async () => {
      const list = await service.listCatalogForAdmin(EVENT_ID);

      expect(list).toHaveLength(2);
      const a = list.find((c) => c.goods_id === 'A')!;
      expect(a.id).toBeNull();
      expect(a.point_price).toBeNull();
      expect(a.is_visible).toBe(false);
      expect(a.img_url).toBe('https://example/A.jpg');
    });

    it('cached_img_url이 있으면 그것 우선', async () => {
      const list = await service.listCatalogForAdmin(EVENT_ID);
      const b = list.find((c) => c.goods_id === 'B')!;
      expect(b.img_url).toBe('https://cdn/B.jpg');
    });

    it('큐레이션된 상품은 id, point_price 채워짐', async () => {
      await productRepo.upsertCuration({
        smartcon_goods_id: 'A',
        point_price: 1500,
        is_visible: true,
      });

      const list = await service.listCatalogForAdmin(EVENT_ID);
      const a = list.find((c) => c.goods_id === 'A')!;
      expect(a.id).not.toBeNull();
      expect(a.point_price).toBe(1500);
      expect(a.is_visible).toBe(true);
    });
  });

  describe('listVisible', () => {
    beforeEach(() => {
      productRepo.seedGoods([
        {
          goods_id: 'A',
          event_id: EVENT_ID,
          brand_name: '컴포즈커피',
          goods_name: '상품-A',
          msg: null,
          price: null,
          disc_price: null,
          img_url_https: 'https://example/A.jpg',
          cached_img_url: null,
          is_active: true,
        },
        {
          goods_id: 'B',
          event_id: EVENT_ID,
          brand_name: '이마트24',
          goods_name: '상품-B',
          msg: null,
          price: null,
          disc_price: null,
          img_url_https: 'https://example/B.jpg',
          cached_img_url: null,
          is_active: false, // 단종
        },
      ]);
    });

    it('is_visible=true이면서 is_active=true인 상품만 반환', async () => {
      await productRepo.upsertCuration({
        smartcon_goods_id: 'A',
        point_price: 1500,
        is_visible: true,
      });
      // B도 큐레이션됐지만 is_active=false라 제외돼야
      await productRepo.upsertCuration({
        smartcon_goods_id: 'B',
        point_price: 200,
        is_visible: true,
      });

      const list = await service.listVisible(EVENT_ID);
      expect(list).toHaveLength(1);
      expect(list[0].goods_id).toBe('A');
      expect(list[0].point_price).toBe(1500);
    });

    it('is_visible=false인 상품은 반환되지 않는다', async () => {
      await productRepo.upsertCuration({
        smartcon_goods_id: 'A',
        point_price: 1500,
        is_visible: false,
      });

      const list = await service.listVisible(EVENT_ID);
      expect(list).toHaveLength(0);
    });

    it('큐레이션 안 된 상품은 반환되지 않는다', async () => {
      const list = await service.listVisible(EVENT_ID);
      expect(list).toHaveLength(0);
    });
  });
});
