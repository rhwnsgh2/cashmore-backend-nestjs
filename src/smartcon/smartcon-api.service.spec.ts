import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { SmartconApiService } from './smartcon-api.service';
import { SMARTCON_CONFIG } from './smartcon.constants';
import type { SmartconGoodsResponseItem } from './dto/smartcon-goods.dto';

describe('SmartconApiService', () => {
  let service: SmartconApiService;
  let httpGet: ReturnType<typeof vi.fn>;

  const sampleItem: SmartconGoodsResponseItem = {
    GOODS_ID: '0000128425',
    BRAND_NAME: '컴포즈커피',
    GOODS_NAME: '[컴포즈커피] 아메리카노(ICE)',
    MSG: '[이용안내] ...',
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

  beforeEach(async () => {
    httpGet = vi.fn().mockReturnValue(of({ data: [sampleItem] }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmartconApiService,
        { provide: HttpService, useValue: { get: httpGet } },
      ],
    }).compile();

    service = module.get<SmartconApiService>(SmartconApiService);
  });

  describe('getEventGoods', () => {
    it('지정한 eventId로 GetEventGoods.sc를 호출한다', async () => {
      await service.getEventGoods('99999');

      expect(httpGet).toHaveBeenCalledOnce();
      const [url, config] = httpGet.mock.calls[0];
      expect(url).toBe(
        `${SMARTCON_CONFIG.apiBaseUrl}/goodsinfosvc/GetEventGoods.sc`,
      );
      expect(config.params).toEqual({ event_id: '99999' });
    });

    it('eventId 미지정 시 SMARTCON_CONFIG.eventId 기본값을 사용한다', async () => {
      await service.getEventGoods();
      const config = httpGet.mock.calls[0][1];
      expect(config.params.event_id).toBe(SMARTCON_CONFIG.eventId);
    });

    it('응답 배열을 그대로 반환한다', async () => {
      const result = await service.getEventGoods('64385');
      expect(result).toEqual([sampleItem]);
    });

    it('빈 응답이어도 배열을 반환한다', async () => {
      httpGet.mockReturnValueOnce(of({ data: [] }));
      const result = await service.getEventGoods('64385');
      expect(result).toEqual([]);
    });
  });
});
