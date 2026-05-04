import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { SmartconService } from './smartcon.service';
import { SmartconApiService } from './smartcon-api.service';
import { SMARTCON_CONFIG } from './smartcon.constants';
import { SMARTCON_GOODS_REPOSITORY } from './interfaces/smartcon-goods-repository.interface';
import { StubSmartconGoodsRepository } from './repositories/stub-smartcon-goods.repository';
import { GIFTICON_IMAGE_STORAGE } from '../storage/interfaces/gifticon-image-storage.interface';
import { StubGifticonImageStorage } from '../storage/stub-gifticon-image-storage.service';
import type { SmartconGoodsResponseItem } from './dto/smartcon-goods.dto';

const EVENT_ID = '64385';

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

describe('SmartconService', () => {
  let service: SmartconService;
  let repo: StubSmartconGoodsRepository;
  let imageStorage: StubGifticonImageStorage;
  let getEventGoods: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    repo = new StubSmartconGoodsRepository();
    imageStorage = new StubGifticonImageStorage();
    getEventGoods = vi.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmartconService,
        {
          provide: SmartconApiService,
          useValue: { getEventGoods },
        },
        { provide: SMARTCON_GOODS_REPOSITORY, useValue: repo },
        { provide: GIFTICON_IMAGE_STORAGE, useValue: imageStorage },
      ],
    }).compile();

    service = module.get<SmartconService>(SmartconService);
  });

  describe('syncEventGoods', () => {
    it('신규 응답 → 모두 INSERT 되고 이미지도 캐시된다', async () => {
      getEventGoods.mockResolvedValueOnce([makeItem('A'), makeItem('B')]);

      const result = await service.syncEventGoods(EVENT_ID);

      expect(result).toEqual({
        fetched: 2,
        upserted: 2,
        deactivated: 0,
        imagesCached: 2,
        imagesFailed: 0,
      });
      expect(await repo.findAllByEvent(EVENT_ID)).toHaveLength(2);
      expect(imageStorage.uploads).toHaveLength(2);
      expect(imageStorage.uploads).toEqual([
        { path: 'gifticon/A', sourceUrl: 'https://example/img.jpg' },
        { path: 'gifticon/B', sourceUrl: 'https://example/img.jpg' },
      ]);
    });

    it('기존 상품을 다시 받으면 UPDATE만 하고 이미지는 다시 받지 않는다', async () => {
      getEventGoods.mockResolvedValueOnce([makeItem('A', { PRICE: 1000 })]);
      await service.syncEventGoods(EVENT_ID);
      imageStorage.clear();

      getEventGoods.mockResolvedValueOnce([makeItem('A', { PRICE: 2000 })]);
      const result = await service.syncEventGoods(EVENT_ID);

      expect(result).toEqual({
        fetched: 1,
        upserted: 1,
        deactivated: 0,
        imagesCached: 0,
        imagesFailed: 0,
      });
      const row = await repo.findById('A');
      expect(row?.price).toBe(2000);
      expect(row?.is_active).toBe(true);
      expect(imageStorage.uploads).toHaveLength(0);
    });

    it('응답에서 빠진 상품은 is_active=false로 비활성화된다', async () => {
      getEventGoods.mockResolvedValueOnce([makeItem('A'), makeItem('B')]);
      await service.syncEventGoods(EVENT_ID);

      getEventGoods.mockResolvedValueOnce([makeItem('A')]);
      const result = await service.syncEventGoods(EVENT_ID);

      expect(result).toEqual({
        fetched: 1,
        upserted: 1,
        deactivated: 1,
        imagesCached: 0,
        imagesFailed: 0,
      });
      expect((await repo.findById('A'))?.is_active).toBe(true);
      expect((await repo.findById('B'))?.is_active).toBe(false);
    });

    it('빈 응답이면 EVENT의 모든 활성 상품이 비활성화된다', async () => {
      getEventGoods.mockResolvedValueOnce([makeItem('A'), makeItem('B')]);
      await service.syncEventGoods(EVENT_ID);

      getEventGoods.mockResolvedValueOnce([]);
      const result = await service.syncEventGoods(EVENT_ID);

      expect(result).toEqual({
        fetched: 0,
        upserted: 0,
        deactivated: 2,
        imagesCached: 0,
        imagesFailed: 0,
      });
      expect((await repo.findById('A'))?.is_active).toBe(false);
      expect((await repo.findById('B'))?.is_active).toBe(false);
    });

    it('다른 EVENT의 상품은 비활성화되지 않는다', async () => {
      getEventGoods.mockResolvedValueOnce([makeItem('A')]);
      await service.syncEventGoods('64385');

      getEventGoods.mockResolvedValueOnce([]);
      const result = await service.syncEventGoods('99999');

      expect(result).toEqual({
        fetched: 0,
        upserted: 0,
        deactivated: 0,
        imagesCached: 0,
        imagesFailed: 0,
      });
      expect((await repo.findById('A'))?.is_active).toBe(true);
    });

    it('이미 비활성화된 상품은 다시 비활성화 카운트에 포함되지 않는다', async () => {
      getEventGoods.mockResolvedValueOnce([makeItem('A'), makeItem('B')]);
      await service.syncEventGoods(EVENT_ID);

      getEventGoods.mockResolvedValueOnce([makeItem('A')]);
      await service.syncEventGoods(EVENT_ID);

      getEventGoods.mockResolvedValueOnce([makeItem('A')]);
      const result = await service.syncEventGoods(EVENT_ID);

      expect(result).toEqual({
        fetched: 1,
        upserted: 1,
        deactivated: 0,
        imagesCached: 0,
        imagesFailed: 0,
      });
    });

    it('비활성화된 상품이 응답에 다시 들어오면 is_active=true로 복구된다', async () => {
      getEventGoods.mockResolvedValueOnce([makeItem('A')]);
      await service.syncEventGoods(EVENT_ID);

      getEventGoods.mockResolvedValueOnce([]);
      await service.syncEventGoods(EVENT_ID);
      expect((await repo.findById('A'))?.is_active).toBe(false);

      getEventGoods.mockResolvedValueOnce([makeItem('A')]);
      const result = await service.syncEventGoods(EVENT_ID);

      expect(result).toEqual({
        fetched: 1,
        upserted: 1,
        deactivated: 0,
        imagesCached: 0,
        imagesFailed: 0,
      });
      expect((await repo.findById('A'))?.is_active).toBe(true);
    });

    it('이미지 캐시에 실패해도 sync 자체는 성공이며 imagesFailed 카운트가 잡힌다', async () => {
      const failingStorage = {
        uploadFromUrl: vi.fn().mockRejectedValue(new Error('S3 down')),
      };
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SmartconService,
          { provide: SmartconApiService, useValue: { getEventGoods } },
          { provide: SMARTCON_GOODS_REPOSITORY, useValue: repo },
          { provide: GIFTICON_IMAGE_STORAGE, useValue: failingStorage },
        ],
      }).compile();
      const failSvc = module.get<SmartconService>(SmartconService);

      getEventGoods.mockResolvedValueOnce([makeItem('A'), makeItem('B')]);
      const result = await failSvc.syncEventGoods(EVENT_ID);

      expect(result).toEqual({
        fetched: 2,
        upserted: 2,
        deactivated: 0,
        imagesCached: 0,
        imagesFailed: 2,
      });
      expect(failingStorage.uploadFromUrl).toHaveBeenCalledTimes(2);
    });

    it('img_url_https가 없는 상품은 캐시 시도하지 않는다', async () => {
      getEventGoods.mockResolvedValueOnce([
        makeItem('A', { IMG_URL_HTTPS: null }),
      ]);

      const result = await service.syncEventGoods(EVENT_ID);

      expect(result).toEqual({
        fetched: 1,
        upserted: 1,
        deactivated: 0,
        imagesCached: 0,
        imagesFailed: 0,
      });
      expect(imageStorage.uploads).toHaveLength(0);
    });

    it('raw_data에 응답 원본이 그대로 박제된다', async () => {
      const item = makeItem('A', { PRICE: 1234 });
      getEventGoods.mockResolvedValueOnce([item]);

      await service.syncEventGoods(EVENT_ID);

      const row = await repo.findById('A');
      expect(row?.raw_data).toEqual(item);
    });

    it('eventId 미지정 시 SMARTCON_CONFIG.eventId 기본값을 사용한다', async () => {
      getEventGoods.mockResolvedValueOnce([]);
      await service.syncEventGoods();
      expect(getEventGoods).toHaveBeenCalledWith(SMARTCON_CONFIG.eventId);
    });
  });
});
